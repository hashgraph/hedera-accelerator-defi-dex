import AssetsHolder from "../artifacts/contracts/holder/AssetsHolder.sol/AssetsHolder.json";

import { ethers } from "hardhat";
import { Helper } from "../utils/Helper";
import { expect } from "chai";
import { Contract } from "ethers";
import { TestHelper } from "./TestHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

interface CreationInputs {
  proposalType: number;
  title: string;
  description: string;
  discussionLink: string;
  metadata: string;
  amountOrId: number;
  targets: string[];
  values: number[];
  calldatas: Uint8Array[];
}

describe("Governor Tests", function () {
  const QUORUM_THRESHOLD = 5;
  const QUORUM_THRESHOLD_BSP = QUORUM_THRESHOLD * 100;

  const TOTAL_SUPPLY = TestHelper.toPrecision(100);
  const LOCKED_TOKEN = TOTAL_SUPPLY / 2;

  const DESC = "Test";
  const LINK = "Link";
  const TITLE = "Title";
  const META_DATA = "Metadata";

  const VOTING_DELAY_IN_SECONDS = 0;
  const VOTING_PERIOD_IN_SECONDS = 12;

  async function deployFixture() {
    const signers = await TestHelper.getSigners();

    const creator = signers[0];
    const receiver = signers[7];

    const ftAsGodToken = await TestHelper.deployERC20Mock(TOTAL_SUPPLY);
    await ftAsGodToken.setUserBalance(signers[0].address, TOTAL_SUPPLY);

    const nftAsGodToken = await TestHelper.deployERC721Mock(creator);
    const ftTokenToTransfer = await TestHelper.deployERC20Mock(TOTAL_SUPPLY);

    const hederaService = await TestHelper.deployMockHederaService();
    const ftTokenHolder = await TestHelper.deployGodHolder(
      hederaService,
      ftAsGodToken,
    );

    const nftTokenHolder = await TestHelper.deployNftGodHolder(
      hederaService,
      nftAsGodToken,
    );

    const roleBasedAccess = await TestHelper.deploySystemRoleBasedAccess();
    const ftAssetsHolder = await TestHelper.deployAssetsHolder();
    const nftAssetsHolder = await TestHelper.deployAssetsHolder();

    const FT_ARGS = [
      VOTING_DELAY_IN_SECONDS,
      VOTING_PERIOD_IN_SECONDS,
      QUORUM_THRESHOLD_BSP,
      ftTokenHolder.address,
      ftAssetsHolder.address,
      hederaService.address,
      roleBasedAccess.address,
    ];

    const NFT_ARGS = [
      VOTING_DELAY_IN_SECONDS,
      VOTING_PERIOD_IN_SECONDS,
      QUORUM_THRESHOLD_BSP,
      nftTokenHolder.address,
      nftAssetsHolder.address,
      hederaService.address,
      roleBasedAccess.address,
    ];

    // FT governor
    const ftGovernor = await TestHelper.deployLogic("HederaGovernor");
    await ftGovernor.initialize(...FT_ARGS);

    // NFT governor
    const nftGovernor = await TestHelper.deployLogic("HederaGovernor");
    await nftGovernor.initialize(...NFT_ARGS);

    const systemUsersSigners = await TestHelper.systemUsersSigners();
    const governorTestProxy = await TestHelper.deployLogic(
      "ProxyPatternMock",
      ftGovernor.address,
      systemUsersSigners.proxyAdmin.address,
    );

    return {
      FT_ARGS,
      NFT_ARGS,

      ftAsGodToken,
      ftAssetsHolder,
      ftTokenHolder,
      ftGovernor,

      nftAsGodToken,
      nftAssetsHolder,
      nftTokenHolder,
      nftGovernor,

      hederaService,
      signers,

      creator,
      receiver,

      ftTokenToTransfer,
      governorTestProxy,
      systemUsersSigners,
      roleBasedAccess,
    };
  }

  async function encodeFunctionData(
    functionName: string,
    data: any[],
    defaultAbi: any = AssetsHolder.abi,
  ): Promise<{ bytes: Uint8Array; hex: string }> {
    const iface = new ethers.utils.Interface(defaultAbi);
    const hex = iface.encodeFunctionData(functionName, data);
    return { bytes: ethers.utils.arrayify(hex), hex };
  }

  const verifyProposalVotes = async (
    instance: Contract,
    proposalId: any,
    result: any,
  ) => {
    const r = await instance.proposalVotes(proposalId);
    expect(r.abstainVotes, "abstainVotes").equals(result.abstainVotes);
    expect(r.againstVotes, "againstVotes").equals(result.againstVotes);
    expect(r.forVotes, "forVotes").equals(result.forVotes);
  };

  const verifyAccountBalance = async (
    token: Contract,
    account: string,
    targetBalance: number,
  ) => {
    const balance = await token.balanceOf(account);
    expect(balance).equals(targetBalance);
  };

  const verifyProposalCoreInformationEvent = async (
    tx: any,
    creator: string,
    blockedAmountOrId: number,
    inputs: CreationInputs,
  ) => {
    const events = await TestHelper.readEvents(tx, ["ProposalCoreInformation"]);
    const { args } = events.pop()!;
    expect(args.length).equals(2);

    const proposalId = args.proposalId;
    expect(proposalId).not.equals("0");

    const coreInformation = args.coreInformation;
    expect(coreInformation.creator).equals(creator);
    expect(coreInformation.voteStart).greaterThan(0);
    expect(coreInformation.voteEnd).greaterThan(0);
    expect(coreInformation.blockedAmountOrId).equals(blockedAmountOrId);

    const eventInputs = coreInformation.inputs;

    expect(eventInputs.proposalType.toNumber()).equals(inputs.proposalType);
    expect(eventInputs.title).equals(TITLE);
    expect(eventInputs.description).equals(DESC);
    expect(eventInputs.discussionLink).equals(LINK);
    expect(eventInputs.metadata).equals(META_DATA);
    expect(eventInputs.amountOrId.toNumber()).equals(inputs.amountOrId);
    expect(eventInputs.targets.toString()).equals(inputs.targets.toString());
    expect(eventInputs._values.length).equals(eventInputs.targets.length);
    expect(eventInputs.calldatas.length).equals(eventInputs.targets.length);

    return { proposalId, inputs };
  };

  async function createProposal(
    governance: Contract,
    account: SignerWithAddress,
    title: string,
    amountOrId: number,
    proposalType: number,
    targets: string[],
    values: number[],
    calldatas: Uint8Array[],
  ) {
    const creationInputs: CreationInputs = {
      proposalType,
      title,
      description: DESC,
      discussionLink: LINK,
      metadata: META_DATA,
      amountOrId,
      targets,
      values,
      calldatas,
    };
    const tx = await governance
      .connect(account)
      .createProposal(Object.values(creationInputs));
    const blockedAmountOrId = amountOrId === 0 ? 1e8 : amountOrId;
    return verifyProposalCoreInformationEvent(
      tx,
      account.address,
      blockedAmountOrId,
      creationInputs,
    );
  }

  async function createTextProposal(
    governance: Contract,
    account: SignerWithAddress,
    title: string = TITLE,
    amountOrId: number = 0,
  ) {
    const assetsAddress = await governance.getAssetHolderContractAddress();
    const calldata = await encodeFunctionData("setText", []);
    return createProposal(
      governance,
      account,
      title,
      amountOrId,
      1001,
      [assetsAddress],
      [0],
      [calldata.bytes],
    );
  }

  async function createTokenCreateProposal(
    governance: Contract,
    account: SignerWithAddress,
    tokenName: string,
    amountOrId: number = 0,
  ) {
    const assetsAddress = await governance.getAssetHolderContractAddress();
    const calldata = await encodeFunctionData("createToken", [
      tokenName,
      "Symbol",
      TOTAL_SUPPLY,
    ]);
    return createProposal(
      governance,
      account,
      TITLE,
      amountOrId,
      1001,
      [assetsAddress],
      [0],
      [calldata.bytes],
    );
  }

  async function createTokenMintProposal(
    governance: Contract,
    account: SignerWithAddress,
    tokenAddress: string,
    mintAmount: number,
    amountOrId: number = 0,
  ) {
    const assetsAddress = await governance.getAssetHolderContractAddress();
    const calldata = await encodeFunctionData("mintToken", [
      tokenAddress,
      mintAmount,
    ]);
    return createProposal(
      governance,
      account,
      TITLE,
      amountOrId,
      1001,
      [assetsAddress],
      [0],
      [calldata.bytes],
    );
  }

  async function createTokenBurnProposal(
    governance: Contract,
    account: SignerWithAddress,
    tokenAddress: string,
    burnAmount: number,
    amountOrId: number = 0,
  ) {
    const assetsAddress = await governance.getAssetHolderContractAddress();
    const calldata = await encodeFunctionData("burnToken", [
      tokenAddress,
      burnAmount,
    ]);
    return createProposal(
      governance,
      account,
      TITLE,
      amountOrId,
      1001,
      [assetsAddress],
      [0],
      [calldata.bytes],
    );
  }

  async function createAssetsTransferProposal(
    governance: Contract,
    account: SignerWithAddress,
    to: string,
    tokenAddress: string,
    amount: number,
    amountOrId: number = 0,
  ) {
    const assetsAddress = await governance.getAssetHolderContractAddress();
    const calldata = await encodeFunctionData("transfer", [
      to,
      tokenAddress,
      amount,
    ]);
    return createProposal(
      governance,
      account,
      TITLE,
      amountOrId,
      1001,
      [assetsAddress],
      [0],
      [calldata.bytes],
    );
  }

  async function createUpgradeProxyProposal(
    governance: Contract,
    account: SignerWithAddress,
    proxyAddress: string,
    proxyLogicAddress: string,
    proxyAdminAddress: string,
    amountOrId: number = 0,
  ) {
    const assetsAddress = await governance.getAssetHolderContractAddress();
    const calldata = await encodeFunctionData("upgradeProxy", [
      proxyAddress,
      proxyLogicAddress,
      proxyAdminAddress,
    ]);
    return createProposal(
      governance,
      account,
      TITLE,
      amountOrId,
      1001,
      [assetsAddress],
      [0],
      [calldata.bytes],
    );
  }

  const execute = async (contract: Contract, inputs: CreationInputs) => {
    return contract.execute(
      inputs.targets,
      inputs.values,
      inputs.calldatas,
      Helper.role(inputs.title),
    );
  };

  const cancel = async (contract: Contract, inputs: CreationInputs) => {
    return contract.cancel(
      inputs.targets,
      inputs.values,
      inputs.calldatas,
      Helper.role(inputs.title),
    );
  };

  describe("Common tests", async () => {
    it("Verify contract should be reverted for multiple initialization", async function () {
      const { ftGovernor, nftGovernor, FT_ARGS, NFT_ARGS } =
        await loadFixture(deployFixture);
      await expect(ftGovernor.initialize(...FT_ARGS)).revertedWith(
        "Initializable: contract is already initialized",
      );
      await expect(nftGovernor.initialize(...NFT_ARGS)).revertedWith(
        "Initializable: contract is already initialized",
      );
    });

    it("Verify create proposal should be reverted for blank title", async function () {
      const { creator, ftGovernor, nftGovernor } =
        await loadFixture(deployFixture);

      await expect(createTextProposal(ftGovernor, creator, ""))
        .revertedWithCustomError(ftGovernor, "InvalidInput")
        .withArgs("GCSI: title blank");

      await expect(createTextProposal(nftGovernor, creator, ""))
        .revertedWithCustomError(ftGovernor, "InvalidInput")
        .withArgs("GCSI: title blank");
    });

    it("Verify vote casting should be reverted for non-existing proposal id", async function () {
      const { ftGovernor, nftGovernor } = await loadFixture(deployFixture);
      await expect(ftGovernor.castVote(1, 1)).revertedWith(
        "Governor: unknown proposal id",
      );
      await expect(nftGovernor.castVote(1, 1)).revertedWith(
        "Governor: unknown proposal id",
      );
    });

    it("Verify creator balance should be one ft token less after proposal creation", async function () {
      const { ftGovernor, ftAsGodToken, creator } =
        await loadFixture(deployFixture);
      const BALANCE_BEFORE = TOTAL_SUPPLY;
      const BALANCE_AFTER = BALANCE_BEFORE - TestHelper.toPrecision(1);
      await verifyAccountBalance(ftAsGodToken, creator.address, BALANCE_BEFORE);
      await createTextProposal(ftGovernor, creator);
      await verifyAccountBalance(ftAsGodToken, creator.address, BALANCE_AFTER);
    });

    it("Verify creator balance should be one nft token less after proposal creation", async function () {
      const { nftGovernor, nftAsGodToken, creator } =
        await loadFixture(deployFixture);

      const BALANCE_BEFORE = TestHelper.NFT_IDS.length;
      const BALANCE_AFTER = BALANCE_BEFORE - 1;
      await verifyAccountBalance(
        nftAsGodToken,
        creator.address,
        BALANCE_BEFORE,
      );
      await createTextProposal(
        nftGovernor,
        creator,
        TITLE,
        TestHelper.NFT_FOR_PROPOSAL_CREATION,
      );
      await verifyAccountBalance(nftAsGodToken, creator.address, BALANCE_AFTER);
    });

    it("Verify creator balance should be one ft token more after proposal cancellation", async function () {
      const { ftGovernor, ftAsGodToken, creator } =
        await loadFixture(deployFixture);

      const info = await createTextProposal(ftGovernor, creator);

      const BEFORE = await ftAsGodToken.balanceOf(creator.address);
      const AFTER = BEFORE.add(TestHelper.toPrecision(1)).toNumber();

      await verifyAccountBalance(ftAsGodToken, creator.address, BEFORE);
      await cancel(ftGovernor, info.inputs);
      await verifyAccountBalance(ftAsGodToken, creator.address, AFTER);
    });

    it("Verify creator balance should be one nft token more after proposal cancellation", async function () {
      const { nftGovernor, nftAsGodToken, creator } =
        await loadFixture(deployFixture);

      const info = await createTextProposal(
        nftGovernor,
        creator,
        TITLE,
        TestHelper.NFT_FOR_PROPOSAL_CREATION,
      );

      const BEFORE = TestHelper.NFT_IDS.length - 1;
      const AFTER = BEFORE + 1;

      await verifyAccountBalance(nftAsGodToken, creator.address, BEFORE);
      await cancel(nftGovernor, info.inputs);
      await verifyAccountBalance(nftAsGodToken, creator.address, AFTER);
    });

    it("Verify creator balance should be one ft token more after proposal execution", async function () {
      const { creator, ftGovernor, ftTokenHolder, ftAsGodToken } =
        await loadFixture(deployFixture);
      await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);

      const info = await createTextProposal(ftGovernor, creator);
      const BEFORE = await ftAsGodToken.balanceOf(creator.address);
      const AFTER = BEFORE.add(TestHelper.toPrecision(1)).toNumber();

      await ftGovernor.castVote(info.proposalId, 1);
      await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);
      await execute(ftGovernor, info.inputs);
      await verifyAccountBalance(ftAsGodToken, creator.address, AFTER);
    });

    it("Verify creator balance should be one nft token more after proposal execution", async function () {
      const { creator, nftGovernor, nftAsGodToken, nftTokenHolder } =
        await loadFixture(deployFixture);

      await verifyAccountBalance(
        nftAsGodToken,
        creator.address,
        TestHelper.NFT_IDS.length,
      );
      await nftTokenHolder
        .connect(creator)
        .grabTokensFromUser(TestHelper.NFT_FOR_VOTING);

      await verifyAccountBalance(
        nftAsGodToken,
        creator.address,
        TestHelper.NFT_IDS.length - 1,
      );

      const info = await createTextProposal(
        nftGovernor,
        creator,
        TITLE,
        TestHelper.NFT_FOR_PROPOSAL_CREATION,
      );

      await verifyAccountBalance(
        nftAsGodToken,
        creator.address,
        TestHelper.NFT_IDS.length - 2,
      );

      await nftGovernor.castVote(info.proposalId, 1);
      await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);

      await execute(nftGovernor, info.inputs);

      await verifyAccountBalance(
        nftAsGodToken,
        creator.address,
        TestHelper.NFT_IDS.length - 1,
      );

      await nftTokenHolder.connect(creator).revertTokensForVoter(0);
      await verifyAccountBalance(
        nftAsGodToken,
        creator.address,
        TestHelper.NFT_IDS.length,
      );
    });

    it("Verify cast vote should be reverted if voter tokens are not locked", async function () {
      const { creator, ftGovernor } = await loadFixture(deployFixture);
      const { proposalId } = await createTextProposal(ftGovernor, creator);
      await expect(ftGovernor.castVote(proposalId, 1)).revertedWith(
        "GCSI: lock token to vote",
      );
    });

    it("Verify governance common properties (delay, period, threshold) are set properly", async function () {
      const { ftGovernor } = await loadFixture(deployFixture);
      const delay = await ftGovernor.votingDelay();
      const period = await ftGovernor.votingPeriod();
      const threshold = await ftGovernor.proposalThreshold();
      expect(delay).equals(VOTING_DELAY_IN_SECONDS);
      expect(period).equals(VOTING_PERIOD_IN_SECONDS);
      expect(threshold).equals(0);
    });

    it("Verify votes, quorum, vote-succeeded value's should have default values when no vote casted", async function () {
      const { ftGovernor, creator } = await loadFixture(deployFixture);
      const { proposalId } = await createTextProposal(ftGovernor, creator);
      await verifyProposalVotes(ftGovernor, proposalId, {
        abstainVotes: 0,
        againstVotes: 0,
        forVotes: 0,
      });
      const response = await ftGovernor.getVotingInformation(proposalId);
      expect(await response.isQuorumReached).equals(false);
      expect(await response.isVoteSucceeded).equals(false);
    });

    it("Verify votes, quorum, vote-succeeded value's should be updated when vote casted in favour", async function () {
      const { creator, ftGovernor, ftTokenHolder } =
        await loadFixture(deployFixture);
      await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);
      const { proposalId } = await createTextProposal(ftGovernor, creator);
      await ftGovernor.castVote(proposalId, 1);
      await verifyProposalVotes(ftGovernor, proposalId, {
        abstainVotes: 0,
        againstVotes: 0,
        forVotes: LOCKED_TOKEN,
      });
      const response = await ftGovernor.getVotingInformation(proposalId);
      expect(await response.isQuorumReached).equals(true);
      expect(await response.isVoteSucceeded).equals(true);
    });

    it("Verify votes, vote-succeeded value's should be updated when vote casted in favour with less then quorum share", async function () {
      const { creator, ftGovernor, ftTokenHolder } =
        await loadFixture(deployFixture);

      const LOCKED_TOKENS = TestHelper.toPrecision(QUORUM_THRESHOLD - 1);
      await ftTokenHolder.grabTokensFromUser(LOCKED_TOKENS);

      const { proposalId } = await createTextProposal(ftGovernor, creator);
      await ftGovernor.castVote(proposalId, 1);
      await verifyProposalVotes(ftGovernor, proposalId, {
        abstainVotes: 0,
        againstVotes: 0,
        forVotes: LOCKED_TOKENS,
      });
      const response = await ftGovernor.getVotingInformation(proposalId);
      expect(await response.isQuorumReached).equals(false);
      expect(await response.isVoteSucceeded).equals(true);
    });

    it("Verify votes, quorum value's should be updated when vote casted abstain", async function () {
      const { creator, ftGovernor, ftTokenHolder } =
        await loadFixture(deployFixture);

      await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);

      const { proposalId } = await createTextProposal(ftGovernor, creator);
      await ftGovernor.castVote(proposalId, 2);
      await verifyProposalVotes(ftGovernor, proposalId, {
        abstainVotes: LOCKED_TOKEN,
        forVotes: 0,
        againstVotes: 0,
      });
      const response = await ftGovernor.getVotingInformation(proposalId);
      expect(await response.isQuorumReached).equals(true);
      expect(await response.isVoteSucceeded).equals(false);
    });

    it("Verify votes value should be updated when vote casted against", async function () {
      const { creator, ftGovernor, ftTokenHolder } =
        await loadFixture(deployFixture);

      await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);

      const { proposalId } = await createTextProposal(ftGovernor, creator);
      await ftGovernor.castVote(proposalId, 0);
      await verifyProposalVotes(ftGovernor, proposalId, {
        abstainVotes: 0,
        forVotes: 0,
        againstVotes: LOCKED_TOKEN,
      });
      const response = await ftGovernor.getVotingInformation(proposalId);
      expect(await response.isQuorumReached).equals(false);
      expect(await response.isVoteSucceeded).equals(false);
    });

    it("Verify proposal should be in 'Pending' state when proposal created and voting period not started", async function () {
      const { ftGovernor, creator } = await loadFixture(deployFixture);
      const { proposalId } = await createTextProposal(ftGovernor, creator);
      expect(await ftGovernor.state(proposalId)).equals(0);
    });

    it("Verify proposal should be in 'Active' state when proposal created", async function () {
      const { ftGovernor, creator } = await loadFixture(deployFixture);
      const { proposalId } = await createTextProposal(ftGovernor, creator);
      await TestHelper.increaseEVMTime(VOTING_DELAY_IN_SECONDS + 1);
      expect(await ftGovernor.state(proposalId)).equals(1);
    });

    it("Verify proposal should be in 'Cancelled' state when proposal cancelled", async function () {
      const { ftGovernor, creator } = await loadFixture(deployFixture);
      const info = await createTextProposal(ftGovernor, creator);
      await cancel(ftGovernor, info.inputs);
      expect(await ftGovernor.state(info.proposalId)).equals(2);
    });

    it("Verify proposal should be in 'Defeated' state when no vote casted and voting period ended", async function () {
      const { ftGovernor, creator } = await loadFixture(deployFixture);
      const { proposalId } = await createTextProposal(ftGovernor, creator);
      await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS + 1);
      expect(await ftGovernor.state(proposalId)).equals(3);
    });

    it("Verify proposal should be in 'Succeeded' state when vote succeeded and quorum reached", async function () {
      const { creator, ftGovernor, ftTokenHolder } =
        await loadFixture(deployFixture);
      await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);
      const { proposalId } = await createTextProposal(ftGovernor, creator);
      await ftGovernor.castVote(proposalId, 1);
      await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);
      expect(await ftGovernor.state(proposalId)).equals(4);
    });

    it("Verify proposal should be in 'Executed' state when proposal executed", async function () {
      const { creator, ftGovernor, ftTokenHolder } =
        await loadFixture(deployFixture);
      await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);
      const info = await createTextProposal(ftGovernor, creator);
      await ftGovernor.castVote(info.proposalId, 1);
      await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);
      await execute(ftGovernor, info.inputs);
      expect(await ftGovernor.state(info.proposalId)).equals(7);
    });

    it("Verify proposal creation should be reverted when creator having zero GOD token", async function () {
      const { creator, ftGovernor, ftAsGodToken } =
        await loadFixture(deployFixture);
      await ftAsGodToken.setUserBalance(creator.address, 0);
      await verifyAccountBalance(ftAsGodToken, creator.address, 0);
      await ftAsGodToken.setTransaferFailed(true);
      await expect(createTextProposal(ftGovernor, creator)).revertedWith(
        "GCSI: transfer failed to contract",
      );
    });

    it("Verify proposal execution should be reverted when unlocking the god token", async function () {
      const { ftGovernor, creator, ftTokenHolder, ftAsGodToken } =
        await loadFixture(deployFixture);
      await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);

      const info = await createTextProposal(ftGovernor, creator);
      await ftGovernor.castVote(info.proposalId, 1);
      await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);

      await ftAsGodToken.setTransaferFailed(true);
      await expect(execute(ftGovernor, info.inputs)).revertedWith(
        "GCSI: transfer failed from contract.",
      );
    });

    it("Verify proposal cancellation should be reverted if requested by non-creator user", async function () {
      const { ftGovernor, creator, signers } = await loadFixture(deployFixture);
      const info = await createTextProposal(ftGovernor, creator);
      await expect(
        ftGovernor
          .connect(signers[1])
          .cancel(
            info.inputs.targets,
            info.inputs.values,
            info.inputs.calldatas,
            Helper.role(info.inputs.title),
          ),
      ).revertedWith("GCSI: Only proposer can cancel");
    });

    it("Verify getVotingInformation call should return data for valid proposal id", async function () {
      const { ftGovernor, creator, ftTokenHolder } =
        await loadFixture(deployFixture);
      await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);

      const info = await createTextProposal(ftGovernor, creator);

      const voting1 = await ftGovernor.getVotingInformation(info.proposalId);
      expect(voting1.quorumValue).equals(500000000);
      expect(voting1.againstVotes).equals(0);
      expect(voting1.forVotes).equals(0);
      expect(voting1.abstainVotes).equals(0);
      expect(voting1.isQuorumReached).equals(false);
      expect(voting1.isVoteSucceeded).equals(false);
      expect(voting1.hasVoted).equals(false);
      expect(voting1.proposalState).equals(0);

      await ftGovernor.castVote(info.proposalId, 1);

      const voting2 = await ftGovernor.getVotingInformation(info.proposalId);
      expect(voting2.quorumValue).equals(500000000);
      expect(voting2.againstVotes).equals(0);
      expect(voting2.forVotes).equals(LOCKED_TOKEN);
      expect(voting2.abstainVotes).equals(0);
      expect(voting2.isQuorumReached).equals(true);
      expect(voting2.isVoteSucceeded).equals(true);
      expect(voting2.hasVoted).equals(true);
      expect(voting2.proposalState).equals(1);
    });

    it("Verify default quorum threshold for governance contract", async function () {
      const { ftGovernor, ftAsGodToken } = await loadFixture(deployFixture);
      const total = await ftAsGodToken.totalSupply();
      const result = await ftGovernor.quorum(123);
      expect(total).equals(TOTAL_SUPPLY);
      expect(result).equals(TestHelper.toPrecision(QUORUM_THRESHOLD));
    });

    it("When total supply of the GOD token is increased then its quorum threshold should also increased.", async function () {
      const { ftGovernor, ftAsGodToken } = await loadFixture(deployFixture);
      const newTotal = TOTAL_SUPPLY * 2;
      await ftAsGodToken.setTotal(newTotal);
      const updatedTotal = await ftAsGodToken.totalSupply();
      expect(updatedTotal).equals(newTotal);
      const result = await ftGovernor.quorum(123);
      const correctQuorumNumber = (QUORUM_THRESHOLD / 100) * newTotal;
      expect(result).equals(correctQuorumNumber.toFixed(0));
    });

    it("When default(5%) quorum threshold results in zero quorum threshold value then quorum call should fail. ", async function () {
      const NEW_TOTAL_SUPPLY = 19;
      const { ftGovernor, ftAsGodToken } = await loadFixture(deployFixture);
      await ftAsGodToken.setTotal(NEW_TOTAL_SUPPLY);
      const TOTAL_SUPPLY_FROM_CONTRACT = await ftAsGodToken.totalSupply();
      expect(TOTAL_SUPPLY_FROM_CONTRACT).equals(NEW_TOTAL_SUPPLY);
      const correctQuorumNumber = (QUORUM_THRESHOLD / 100) * NEW_TOTAL_SUPPLY;
      expect(Math.floor(correctQuorumNumber)).equals(0);
      await expect(ftGovernor.quorum(123)).revertedWith(
        "GCSI: (GOD token * quorum) < 10,000",
      );
    });

    it("Verify contract should initialize quorum threshold value with 500 when user passed 0 as threshold", async function () {
      const { ftTokenHolder, hederaService, roleBasedAccess } =
        await loadFixture(deployFixture);

      const ftAssetsHolder = await TestHelper.deployAssetsHolder();

      const ARGS = [
        VOTING_DELAY_IN_SECONDS,
        VOTING_PERIOD_IN_SECONDS,
        0,
        ftTokenHolder.address,
        ftAssetsHolder.address,
        hederaService.address,
        roleBasedAccess.address,
      ];

      const ftGovernor = await TestHelper.deployLogic("HederaGovernor");
      await ftGovernor.initialize(...ARGS);
      const result = await ftGovernor.quorum(0);
      expect(result).equals(TestHelper.toPrecision(QUORUM_THRESHOLD));
    });

    it("Upgrade hederaService fails with non owner", async () => {
      const { ftGovernor, signers } = await loadFixture(deployFixture);
      const nonCreator = signers[2];
      await expect(
        ftGovernor.connect(nonCreator).upgradeHederaService(signers[3].address),
      ).revertedWith("Ownable: caller is not the owner");
    });

    it("Upgrade hederaService should be updated successfully", async () => {
      const { ftGovernor, ftAssetsHolder } = await loadFixture(deployFixture);

      await expect(
        ftGovernor.upgradeHederaService(TestHelper.ONE_ADDRESS),
      ).emit(ftAssetsHolder, "LogicUpdated");

      expect(await ftGovernor.getHederaServiceVersion()).equals(
        TestHelper.ONE_ADDRESS,
      );
    });

    it("Verify getGODTokenAddress should return correct value", async function () {
      const { ftGovernor, ftAsGodToken } = await loadFixture(deployFixture);
      expect(await ftGovernor.getGODTokenAddress()).equals(
        ftAsGodToken.address,
      );
    });

    it("Verify getTokenHolderContractAddress should return correct value", async function () {
      const { ftGovernor, ftTokenHolder } = await loadFixture(deployFixture);
      expect(await ftGovernor.getTokenHolderContractAddress()).equals(
        ftTokenHolder.address,
      );
    });

    it("Verify CLOCK_MODE should return correct value", async function () {
      const { ftGovernor } = await loadFixture(deployFixture);
      expect(await ftGovernor.CLOCK_MODE()).equals("mode=timestamp");
    });

    it("Verify CLOCK_MODE should return correct value", async function () {
      const { ftGovernor } = await loadFixture(deployFixture);
      expect(await ftGovernor.CLOCK_MODE()).equals("mode=timestamp");
    });

    it("Verify propose call should be reverted because we disabled it", async function () {
      const { ftGovernor } = await loadFixture(deployFixture);
      await expect(ftGovernor.propose([], [], [], ""))
        .revertedWithCustomError(ftGovernor, "InvalidInput")
        .withArgs("GCSI: propose api disabled");
    });
  });

  describe("Governor proposals tests", async () => {
    describe("Text proposals", async function () {
      it("Verify text proposal should be executed for ft governance", async function () {
        const { ftGovernor, creator, ftTokenHolder } =
          await loadFixture(deployFixture);
        await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);
        const info = await createTextProposal(ftGovernor, creator);
        await ftGovernor.castVote(info.proposalId, 1);
        await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);
        await execute(ftGovernor, info.inputs);
        expect(await ftGovernor.state(info.proposalId)).equals(7);
      });
    });

    describe("Token Creation proposals", async function () {
      it("Given FT Token used as governance token when proposal executed then new ft token should be created successfully", async function () {
        const { creator, ftGovernor, ftAssetsHolder, ftTokenHolder } =
          await loadFixture(deployFixture);

        await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);

        const info = await createTokenCreateProposal(
          ftGovernor,
          creator,
          TITLE,
        );
        await ftGovernor.castVote(info.proposalId, 1);
        await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);
        await expect(execute(ftGovernor, info.inputs))
          .emit(ftAssetsHolder, "TokenCreated")
          .withArgs(async (newToken: string) => {
            expect(newToken).not.equals(ethers.constants.AddressZero);
            const contract = await TestHelper.getContract(
              "ERC20Mock",
              newToken,
            );
            expect(contract.name()).equals(TITLE);
            expect(contract.totalSupply()).equals(TOTAL_SUPPLY);
            return true;
          });
      });

      it("Given NFT Token used as governance token when proposal executed then new ft token should be created successfully", async () => {
        const { creator, nftGovernor, nftAssetsHolder, nftTokenHolder } =
          await loadFixture(deployFixture);

        await nftTokenHolder
          .connect(creator)
          .grabTokensFromUser(TestHelper.NFT_FOR_VOTING);

        const info = await createTokenCreateProposal(
          nftGovernor,
          creator,
          TITLE,
          TestHelper.NFT_FOR_PROPOSAL_CREATION,
        );

        await nftGovernor.castVote(info.proposalId, 1);
        await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);
        await expect(execute(nftGovernor, info.inputs))
          .emit(nftAssetsHolder, "TokenCreated")
          .withArgs(async (newToken: string) => {
            expect(newToken).not.equals(ethers.constants.AddressZero);
            const contract = await TestHelper.getContract(
              "ERC20Mock",
              newToken,
            );
            expect(contract.name()).equals(TITLE);
            expect(contract.totalSupply()).equals(TOTAL_SUPPLY);
            return true;
          });
      });

      it("Verify ft token creation proposal should be failed during execution", async function () {
        const { creator, ftGovernor, ftTokenHolder } =
          await loadFixture(deployFixture);
        await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);
        const info = await createTokenCreateProposal(
          ftGovernor,
          creator,
          "FAIL",
        );
        await ftGovernor.castVote(info.proposalId, 1);
        await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);
        await expect(execute(ftGovernor, info.inputs)).revertedWith(
          "AH: token creation failed",
        );
      });
    });

    describe("Token Minting proposals", async function () {
      it("Given FT Token used as governance token when proposal executed then ft token should be minted successfully", async function () {
        const { creator, ftGovernor, ftTokenHolder } =
          await loadFixture(deployFixture);

        const MINT_AMOUNT = 200e8;
        const newFtToken = await TestHelper.deployERC20Mock();

        await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);

        const info = await createTokenMintProposal(
          ftGovernor,
          creator,
          newFtToken.address,
          MINT_AMOUNT,
        );

        await ftGovernor.castVote(info.proposalId, 1);
        await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);
        await execute(ftGovernor, info.inputs);

        expect(await newFtToken.totalSupply()).equals(MINT_AMOUNT);
      });

      it("Given FT Token used as governance token when proposal executed then ft token should not be minted successfully", async function () {
        const { creator, ftGovernor, ftTokenHolder } =
          await loadFixture(deployFixture);

        const MINT_AMOUNT = 200e8;
        const newFtToken = await TestHelper.deployERC20Mock(
          TOTAL_SUPPLY,
          "FAIL",
        );

        await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);

        const info = await createTokenMintProposal(
          ftGovernor,
          creator,
          newFtToken.address,
          MINT_AMOUNT,
        );

        await ftGovernor.castVote(info.proposalId, 1);
        await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);
        await expect(execute(ftGovernor, info.inputs)).revertedWith(
          "AH: minting failed",
        );
      });
    });

    describe("Token Burning proposals ", async function () {
      it("Given FT Token used as governance token when proposal executed then ft token should be burned successfully", async function () {
        const { creator, ftGovernor, ftTokenHolder } =
          await loadFixture(deployFixture);

        const BURN_AMOUNT = 10e8;
        const newFtToken = await TestHelper.deployERC20Mock();

        await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);

        const info = await createTokenBurnProposal(
          ftGovernor,
          creator,
          newFtToken.address,
          BURN_AMOUNT,
        );

        await ftGovernor.castVote(info.proposalId, 1);
        await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);
        await execute(ftGovernor, info.inputs);

        expect(await newFtToken.totalSupply()).equals(BURN_AMOUNT);
      });

      it("Given FT Token used as governance token when proposal executed then ft token should not be burned successfully", async function () {
        const { creator, ftGovernor, ftTokenHolder } =
          await loadFixture(deployFixture);

        const BURN_AMOUNT = 10e8;
        const newFtToken = await TestHelper.deployERC20Mock(
          TOTAL_SUPPLY,
          "FAIL",
        );

        await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);

        const info = await createTokenBurnProposal(
          ftGovernor,
          creator,
          newFtToken.address,
          BURN_AMOUNT,
        );

        await ftGovernor.castVote(info.proposalId, 1);
        await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);
        await expect(execute(ftGovernor, info.inputs)).revertedWith(
          "AH: burn failed",
        );
      });
    });

    describe("Assets Transfer proposals", async () => {
      it("Verify HBar transfer should be reverted when asset holder contract having low balance", async function () {
        const { creator, receiver, ftGovernor, ftTokenHolder } =
          await loadFixture(deployFixture);
        await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);

        const info = await createAssetsTransferProposal(
          ftGovernor,
          creator,
          receiver.address,
          ethers.constants.AddressZero,
          1e8,
        );

        await ftGovernor.castVote(info.proposalId, 1);
        await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);
        await expect(execute(ftGovernor, info.inputs)).revertedWith(
          "Address: insufficient balance",
        );
      });

      it.skip("Verify HBar transfer should be succeeded", async function () {
        const TRANSFER_AMOUNT = 10;
        const { creator, receiver, ftGovernor, ftTokenHolder, ftAssetsHolder } =
          await loadFixture(deployFixture);

        await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);

        const info = await createAssetsTransferProposal(
          ftGovernor,
          creator,
          receiver.address,
          ethers.constants.AddressZero,
          TRANSFER_AMOUNT,
        );

        await ftGovernor.castVote(info.proposalId, 1);
        await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);

        expect(await TestHelper.getAccountHBars(ftAssetsHolder.address)).equals(
          0,
        );
        await TestHelper.transferBalance(
          ftAssetsHolder.address,
          TRANSFER_AMOUNT,
          creator,
        );
        expect(await TestHelper.getAccountHBars(ftAssetsHolder.address)).equals(
          TRANSFER_AMOUNT,
        );

        const receiverBalBeforeTransfer = await TestHelper.getAccountHBars(
          receiver.address,
        );

        await execute(ftGovernor, info.inputs);
        expect(await TestHelper.getAccountHBars(receiver.address)).equals(
          receiverBalBeforeTransfer.add(TRANSFER_AMOUNT),
        );

        expect(await TestHelper.getAccountHBars(ftAssetsHolder.address)).equals(
          0,
        );
      });

      it("Verify FT token transfer should be reverted when asset holder contract having low balance", async function () {
        const {
          creator,
          receiver,
          ftAsGodToken,
          ftGovernor,
          ftTokenHolder,
          ftAssetsHolder,
        } = await loadFixture(deployFixture);
        await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);

        const info = await createAssetsTransferProposal(
          ftGovernor,
          creator,
          receiver.address,
          ftAsGodToken.address,
          1e8,
        );

        // asset holder having zero balance
        await verifyAccountBalance(ftAsGodToken, ftAssetsHolder.address, 0);

        await ftGovernor.castVote(info.proposalId, 1);
        await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);
        await ftAsGodToken.setTransaferFailed(true);

        await expect(execute(ftGovernor, info.inputs)).revertedWith(
          "AH: transfer failed",
        );
      });

      it("Verify FT token transfer should be succeeded", async function () {
        const AMOUNT = 1e8;
        const {
          creator,
          receiver,
          ftAsGodToken,
          ftGovernor,
          ftTokenHolder,
          ftAssetsHolder,
        } = await loadFixture(deployFixture);
        await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);

        const info = await createAssetsTransferProposal(
          ftGovernor,
          creator,
          receiver.address,
          ftAsGodToken.address,
          AMOUNT,
        );

        await verifyAccountBalance(ftAsGodToken, receiver.address, 0);
        await verifyAccountBalance(ftAsGodToken, ftAssetsHolder.address, 0);
        await ftAsGodToken.setUserBalance(ftAssetsHolder.address, AMOUNT);
        await verifyAccountBalance(
          ftAsGodToken,
          ftAssetsHolder.address,
          AMOUNT,
        );

        await ftGovernor.castVote(info.proposalId, 1);
        await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);
        await execute(ftGovernor, info.inputs);

        await verifyAccountBalance(ftAsGodToken, receiver.address, AMOUNT);
        await verifyAccountBalance(ftAsGodToken, ftAssetsHolder.address, 0);
      });

      it("Verify NFT token transfer should be reverted when asset holder contract having low balance", async function () {
        const {
          creator,
          receiver,
          nftAsGodToken,
          nftGovernor,
          nftTokenHolder,
          nftAssetsHolder,
        } = await loadFixture(deployFixture);
        await nftTokenHolder.grabTokensFromUser(TestHelper.NFT_FOR_VOTING);

        const info = await createAssetsTransferProposal(
          nftGovernor,
          creator,
          receiver.address,
          nftAsGodToken.address,
          TestHelper.NFT_FOR_TRANSFER,
          TestHelper.NFT_FOR_PROPOSAL_CREATION,
        );

        // asset holder having zero balance
        await verifyAccountBalance(nftAsGodToken, nftAssetsHolder.address, 0);

        await nftGovernor.castVote(info.proposalId, 1);
        await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);
        await expect(execute(nftGovernor, info.inputs)).revertedWith(
          "AH: transfer failed",
        );
      });

      it("Verify NFT token transfer should be succeeded", async function () {
        const {
          creator,
          receiver,
          nftAsGodToken,
          nftGovernor,
          nftTokenHolder,
          nftAssetsHolder,
        } = await loadFixture(deployFixture);
        await nftTokenHolder.grabTokensFromUser(TestHelper.NFT_FOR_VOTING);

        const info = await createAssetsTransferProposal(
          nftGovernor,
          creator,
          receiver.address,
          nftAsGodToken.address,
          TestHelper.NFT_FOR_TRANSFER,
          TestHelper.NFT_FOR_PROPOSAL_CREATION,
        );

        await verifyAccountBalance(nftAsGodToken, receiver.address, 0);
        await verifyAccountBalance(nftAsGodToken, nftAssetsHolder.address, 0);
        await nftAsGodToken.transferFrom(
          creator.address,
          nftAssetsHolder.address,
          TestHelper.NFT_FOR_TRANSFER,
        );
        await verifyAccountBalance(nftAsGodToken, nftAssetsHolder.address, 1);

        await nftGovernor.castVote(info.proposalId, 1);
        await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);
        await execute(nftGovernor, info.inputs);

        await verifyAccountBalance(nftAsGodToken, receiver.address, 1);
        await verifyAccountBalance(nftAsGodToken, nftAssetsHolder.address, 0);
      });
    });

    describe("Proxy Upgrade proposals", async () => {
      it("Verify upgrade proposal should be reverted if no rights transfer to asset-holder before execution", async function () {
        const {
          creator,
          ftGovernor,
          ftTokenHolder,
          governorTestProxy,
          systemUsersSigners,
        } = await loadFixture(deployFixture);

        await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);
        const info = await createUpgradeProxyProposal(
          ftGovernor,
          creator,
          governorTestProxy.address,
          TestHelper.ONE_ADDRESS,
          systemUsersSigners.proxyAdmin.address,
        );
        await ftGovernor.castVote(info.proposalId, 1);
        await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);
        await expect(execute(ftGovernor, info.inputs)).revertedWith(
          "ProxyPatternMock: Not admin",
        );
      });

      it("Verify upgrade proposal should be executed", async function () {
        const {
          creator,
          ftGovernor,
          ftTokenHolder,
          ftAssetsHolder,
          governorTestProxy,
          systemUsersSigners,
        } = await loadFixture(deployFixture);

        await ftTokenHolder.grabTokensFromUser(LOCKED_TOKEN);
        const info = await createUpgradeProxyProposal(
          ftGovernor,
          creator,
          governorTestProxy.address,
          TestHelper.ONE_ADDRESS,
          systemUsersSigners.proxyAdmin.address,
        );
        await ftGovernor.castVote(info.proposalId, 1);
        await TestHelper.increaseEVMTime(VOTING_PERIOD_IN_SECONDS);

        // step : 1
        await governorTestProxy
          .connect(systemUsersSigners.proxyAdmin)
          .changeAdmin(ftAssetsHolder.address);

        // verification if we changed the rights
        await expect(
          governorTestProxy
            .connect(systemUsersSigners.proxyAdmin)
            .changeAdmin(ftAssetsHolder.address),
        ).reverted;

        // step : 2
        await execute(ftGovernor, info.inputs);

        expect(
          await governorTestProxy
            .connect(systemUsersSigners.proxyAdmin)
            .implementation(),
        ).equals(TestHelper.ONE_ADDRESS);

        expect(
          await governorTestProxy
            .connect(systemUsersSigners.proxyAdmin)
            .admin(),
        ).equals(systemUsersSigners.proxyAdmin.address);
      });
    });
  });
});
