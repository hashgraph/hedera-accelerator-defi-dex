import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract } from "ethers";
import { TestHelper } from "./TestHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

interface AssetTransferData {
  to: string;
  token: string;
  amount: number;
}

describe("Governor Tests", function () {
  const QUORUM_THRESHOLD = 5;
  const QUORUM_THRESHOLD_BSP = QUORUM_THRESHOLD * 100;

  const TOTAL_SUPPLY = TestHelper.toPrecision(100);
  const TWENTY_PERCENT = TOTAL_SUPPLY * 0.2;
  const FIFTY_PERCENT = TOTAL_SUPPLY * 0.5;
  const THIRTY_PERCENT = TOTAL_SUPPLY * 0.3;
  const LOCKED_TOKEN = TWENTY_PERCENT / 2;

  const DESC = "Test";
  const LINK = "Link";
  const TITLE = "Title";
  const META_DATA = "Metadata";

  const VOTING_DELAY = 0;
  const VOTING_PERIOD = 12;
  const BLOCKS_COUNT = VOTING_PERIOD * 2.5; // 30 blocks

  async function deployFixture() {
    const signers = await TestHelper.getSigners();
    const hederaService = await TestHelper.deployMockHederaService();

    const token = await TestHelper.deployERC20Mock(TOTAL_SUPPLY);
    await token.setUserBalance(signers[0].address, TWENTY_PERCENT);
    await token.setUserBalance(signers[1].address, THIRTY_PERCENT);
    await token.setUserBalance(signers[2].address, FIFTY_PERCENT);

    const tokenToTransfer = await TestHelper.deployERC20Mock(TOTAL_SUPPLY);

    const creator = signers[0];
    const receiver = signers[7];
    const godHolder = await TestHelper.deployGodHolder(hederaService, token);

    const nftToken = await TestHelper.deployERC721Mock(creator);

    const nftGodHolder = await TestHelper.deployNftGodHolder(
      hederaService,
      nftToken,
    );

    const systemRoleBasedAccess = (
      await TestHelper.deploySystemRoleBasedAccess()
    ).address;

    const FT_ARGS = [
      token.address,
      VOTING_DELAY,
      VOTING_PERIOD,
      hederaService.address,
      godHolder.address,
      QUORUM_THRESHOLD_BSP,
      systemRoleBasedAccess,
    ];

    const NFT_ARGS = [
      nftToken.address,
      VOTING_DELAY,
      VOTING_PERIOD,
      hederaService.address,
      nftGodHolder.address,
      QUORUM_THRESHOLD_BSP,
      systemRoleBasedAccess,
    ];

    // FTs governor
    const governorToken = await TestHelper.deployLogic("GovernorTokenCreate");
    await governorToken.initialize(...FT_ARGS);

    const governorText = await TestHelper.deployLogic("GovernorTextProposal");
    await governorText.initialize(...FT_ARGS);

    const governorUpgrade = await TestHelper.deployLogic("GovernorUpgrade");
    await governorUpgrade.initialize(...FT_ARGS);

    const governorTT = await TestHelper.deployLogic("GovernorTransferToken");
    await governorTT.initialize(...FT_ARGS);

    // NFTs governor
    const nftGovernorToken = await TestHelper.deployLogic(
      "GovernorTokenCreate",
    );
    await nftGovernorToken.initialize(...NFT_ARGS);

    const nftGovernorText = await TestHelper.deployLogic(
      "GovernorTextProposal",
    );
    await nftGovernorText.initialize(...NFT_ARGS);

    const nftGovernorUpgrade = await TestHelper.deployLogic("GovernorUpgrade");
    await nftGovernorUpgrade.initialize(...NFT_ARGS);

    const nftGovernorTT = await TestHelper.deployLogic("GovernorTransferToken");
    await nftGovernorTT.initialize(...NFT_ARGS);

    const systemUsersSigners = await TestHelper.systemUsersSigners();
    const governorTestProxy = await TestHelper.deployLogic(
      "ProxyPatternMock",
      governorToken.address,
      systemUsersSigners.proxyAdmin.address,
    );

    return {
      FT_ARGS,
      NFT_ARGS,

      token,
      hederaService,
      signers,
      godHolder,

      governorTT,
      governorText,
      governorToken,
      governorUpgrade,

      creator,
      receiver,
      nftToken,
      nftGodHolder,

      nftGovernorTT,
      nftGovernorText,
      nftGovernorToken,
      nftGovernorUpgrade,

      tokenToTransfer,
      governorTestProxy,
      systemUsersSigners,
      systemRoleBasedAccess,
    };
  }

  const readLastGovernorBalanceEvent = async (txn: any) => {
    const events = await TestHelper.readEvents(txn, ["GovernorBalance"]);
    const lastEvent = events.pop();
    return {
      activeProposalsCount: lastEvent.args.activeProposalsCount,
      blockedGodTokenBalance: lastEvent.args.blockedGodTokenBalance,
    };
  };

  const verifyBlockedNFTSerialIdStatusEvent = async (
    txn: any,
    nftTokenSerialId: number,
    isBlocked: boolean,
  ) => {
    const events = await TestHelper.readEvents(txn, ["NFTSerialIdBlockStatus"]);
    const nftBlockEvent = events.pop();
    expect(nftBlockEvent.args.length).equals(3);
    expect(nftBlockEvent.args.proposalId).not.equals("0");
    expect(nftBlockEvent.args.nftSerialId).equals(nftTokenSerialId);
    expect(nftBlockEvent.args.isBlocked).equals(isBlocked);
  };

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

  const verifyHBarTransferProposalCreationEvent = async (
    tx: any,
    reqData: AssetTransferData,
    nftTokenSerialId: number,
  ) => {
    const info =
      nftTokenSerialId === TestHelper.NFT_FOR_PROPOSAL_CREATION
        ? await verifyNFTProposalCreationEvent(tx, nftTokenSerialId)
        : await verifyFTProposalCreationEvent(tx);

    const eventData = ethers.utils.defaultAbiCoder.decode(
      ["uint256 operationType", "address to", "uint256 amount"],
      info.data,
    );
    expect(eventData.operationType).equals(3);
    expect(eventData.to).equals(reqData.to);
    expect(eventData.amount).equals(reqData.amount);
    return info;
  };

  const verifyAssetTransferProposalCreationEvent = async (
    tx: any,
    reqData: AssetTransferData,
    nftTokenSerialId: number,
  ) => {
    const info =
      nftTokenSerialId === TestHelper.NFT_FOR_PROPOSAL_CREATION ||
      nftTokenSerialId === TestHelper.NFT_FOR_PROPOSAL_CREATION2
        ? await verifyNFTProposalCreationEventForTokenTransfer(
            tx,
            nftTokenSerialId,
          )
        : await verifyFTProposalCreationEvent(tx);

    const eventData = ethers.utils.defaultAbiCoder.decode(
      [
        "uint256 operationType",
        "address transferToAccount",
        "address tokenToTransfer",
        "uint256 transferTokenAmount",
      ],
      info.data,
    );
    expect(eventData.operationType).equals(1);
    expect(eventData.transferToAccount).equals(reqData.to);
    expect(eventData.tokenToTransfer).equals(reqData.token);
    expect(eventData.transferTokenAmount.toNumber()).equals(reqData.amount);
    return info;
  };

  const verifyTokenAssociationProposalCreationEvent = async (
    tx: any,
    tokenAddress: string,
    nftTokenSerialId: number,
  ) => {
    const info =
      nftTokenSerialId === TestHelper.NFT_FOR_PROPOSAL_CREATION
        ? await verifyNFTProposalCreationEvent(tx, nftTokenSerialId)
        : await verifyFTProposalCreationEvent(tx);

    const eventData = ethers.utils.defaultAbiCoder.decode(
      ["uint256 operationType", "address tokenAddress"],
      info.data,
    );
    expect(eventData.operationType).equals(2);
    expect(eventData.tokenAddress).equals(tokenAddress);
    return info;
  };

  const verifyCommonProposalCreationEvent = async (
    tx: any,
    name: any,
    args: any,
  ) => {
    expect(name).equals("ProposalDetails");
    expect(args.proposalId).not.equals("0");
    expect(args.description).equals(DESC);
    expect(args.link).equals(LINK);
    expect(args.metadata).equals(META_DATA);
    expect(args.duration.startBlock).greaterThan(0);
    expect(args.duration.endBlock).greaterThan(0);
    expect(args.votingInformation.isQuorumReached).equals(false);
    expect(args.votingInformation.proposalState).equals(0);
    expect(args.votingInformation.voted).equals(false);
    expect(args.votingInformation.votedUser).not.equals(
      TestHelper.ZERO_ADDRESS,
    );
    expect(args.votingInformation.againstVotes).equals(0);
    expect(args.votingInformation.forVotes).equals(0);
    expect(args.votingInformation.abstainVotes).equals(0);
    const result = await readLastGovernorBalanceEvent(tx);
    expect(result.activeProposalsCount).equals(1);
    expect(result.blockedGodTokenBalance).equals(TestHelper.toPrecision(1));
  };

  const verifyFTProposalCreationEvent = async (tx: any) => {
    const events = await TestHelper.readEvents(tx, ["ProposalDetails"]);
    const { name, args } = events[0];
    expect(args.length).equals(10);
    verifyCommonProposalCreationEvent(tx, name, args);
    expect(args.votingInformation.quorumValue).equals(
      TestHelper.toPrecision(500) / 100,
    );
    expect(args.amountOrId).equals(1e8);
    return { proposalId: args.proposalId, data: args.data };
  };

  const verifyNFTProposalCreationEvent = async (
    tx: any,
    nftTokenSerialId: number,
  ) => {
    const events = await TestHelper.readEvents(tx, ["ProposalDetails"]);
    const { name, args } = events[0];
    expect(args.length).equals(10);
    expect(args.votingInformation.quorumValue).equals(1);
    expect(args.amountOrId).equals(nftTokenSerialId);
    verifyCommonProposalCreationEvent(tx, name, args);
    return { proposalId: args.proposalId, data: args.data };
  };

  const verifyNFTProposalCreationEventForTokenTransfer = async (
    tx: any,
    nftTokenSerialId: number,
  ) => {
    const events = await TestHelper.readEvents(tx, ["ProposalDetails"]);
    const { name, args } = events[0];
    expect(args.length).equals(10);
    expect(args.votingInformation.quorumValue).equals(1);
    expect(args.amountOrId).equals(nftTokenSerialId);
    await verifyBlockedNFTSerialIdStatusEvent(tx, nftTokenSerialId, true);
    verifyCommonProposalCreationEvent(tx, name, args);
    return { proposalId: args.proposalId, data: args.data };
  };

  async function getTextProposalId(
    governance: Contract,
    account: SignerWithAddress,
    title: string = TITLE,
    nftTokenSerialId: number = 0,
  ) {
    const tx = await governance
      .connect(account)
      .createProposal(title, DESC, LINK, META_DATA, nftTokenSerialId);
    return nftTokenSerialId === TestHelper.NFT_FOR_PROPOSAL_CREATION
      ? await verifyNFTProposalCreationEvent(tx, nftTokenSerialId)
      : await verifyFTProposalCreationEvent(tx);
  }

  async function getUpgradeProposalId(
    instance: Contract,
    creator: SignerWithAddress,
    proxyAddress: string,
    logicAddress: string,
    nftTokenSerialId: number = 0,
  ) {
    const tx = await instance
      .connect(creator)
      .createProposal(
        TITLE,
        DESC,
        LINK,
        META_DATA,
        proxyAddress,
        logicAddress,
        nftTokenSerialId,
      );
    return nftTokenSerialId === TestHelper.NFT_FOR_PROPOSAL_CREATION
      ? await verifyNFTProposalCreationEvent(tx, nftTokenSerialId)
      : await verifyFTProposalCreationEvent(tx);
  }

  async function getTransferTokenProposalId(
    title: string,
    instance: Contract,
    signers: SignerWithAddress[],
    tokenAddress: string,
    amount: number,
    nftTokenSerialId: number = 0,
  ) {
    const data: AssetTransferData = {
      to: signers[2].address,
      token: tokenAddress,
      amount,
    };
    const tx = await instance
      .connect(signers[0])
      .createProposal(
        title,
        DESC,
        LINK,
        META_DATA,
        data.to,
        data.token,
        data.amount,
        nftTokenSerialId,
      );

    return await verifyAssetTransferProposalCreationEvent(
      tx,
      data,
      nftTokenSerialId,
    );
  }

  async function getTokenCreateProposalId(
    governance: Contract,
    tokenName: string = "Token",
    account: SignerWithAddress,
    nftTokenSerialId: number = 0,
  ) {
    const tx = await governance
      .connect(account)
      .createProposal(
        TITLE,
        DESC,
        LINK,
        META_DATA,
        account.address,
        tokenName,
        "Symbol",
        nftTokenSerialId,
      );
    return nftTokenSerialId === TestHelper.NFT_FOR_PROPOSAL_CREATION
      ? await verifyNFTProposalCreationEvent(tx, nftTokenSerialId)
      : await verifyFTProposalCreationEvent(tx);
  }

  async function getTokenAssociateProposalId(
    instance: Contract,
    signers: SignerWithAddress[],
    tokenAddress: string,
    nftTokenSerialId: number = 0,
  ) {
    const tx = await instance
      .connect(signers[0])
      .createTokenAssociateProposal(
        TITLE,
        DESC,
        LINK,
        META_DATA,
        tokenAddress,
        nftTokenSerialId,
      );

    return await verifyTokenAssociationProposalCreationEvent(
      tx,
      tokenAddress,
      nftTokenSerialId,
    );
  }

  async function getHBarTransferProposalId(
    instance: Contract,
    creator: SignerWithAddress,
    to: string,
    amount: number,
    nftTokenSerialId: number = 0,
  ) {
    const data: AssetTransferData = {
      to,
      amount,
      token: ethers.constants.AddressZero,
    };
    const tx = await instance
      .connect(creator)
      .createProposal(
        TITLE,
        DESC,
        LINK,
        META_DATA,
        data.to,
        data.token,
        data.amount,
        nftTokenSerialId,
      );

    return await verifyHBarTransferProposalCreationEvent(
      tx,
      data,
      nftTokenSerialId,
    );
  }

  const createTokenCreateProposalAndExecute = async (
    godHolder: Contract,
    governorToken: Contract,
    creator: SignerWithAddress,
  ) => {
    await godHolder.grabTokensFromUser(LOCKED_TOKEN);
    const { proposalId } = await getTokenCreateProposalId(
      governorToken,
      "tokenName",
      creator,
    );
    await governorToken.castVotePublic(proposalId, 0, 1);
    await TestHelper.mineNBlocks(BLOCKS_COUNT);
    await expect(governorToken.getTokenAddress(proposalId)).revertedWith(
      "Contract not executed yet!",
    );
    await governorToken.executeProposal(TITLE);
    expect(await governorToken.getTokenAddress(proposalId)).not.equals(
      TestHelper.ZERO_ADDRESS,
    );
    return proposalId;
  };

  describe("Common tests", async () => {
    it("Verify contract should be reverted for multiple initialization", async function () {
      const { governorText, FT_ARGS } = await loadFixture(deployFixture);
      await expect(governorText.initialize(...FT_ARGS)).revertedWith(
        "Initializable: contract is already initialized",
      );
    });

    it("Verify create proposal should be reverted for blank title", async function () {
      const { governorText, creator } = await loadFixture(deployFixture);
      await expect(getTextProposalId(governorText, creator, ""))
        .revertedWithCustomError(governorText, "InvalidInput")
        .withArgs("GCSI: title blank");
    });

    it("Verify cancelling proposal should be reverted for non-existing title", async function () {
      const { governorText, creator } = await loadFixture(deployFixture);
      await getTextProposalId(governorText, creator);
      await expect(governorText.cancelProposal("not-found")).revertedWith(
        "GCSI: Proposal not found",
      );
    });

    it("Verify vote casting should be reverted for non-existing proposal id", async function () {
      const { governorText } = await loadFixture(deployFixture);
      await expect(governorText.castVotePublic(1, 0, 1)).revertedWith(
        "GCSI: Proposal not found",
      );
    });

    it("Verify get proposal details should be reverted for non-existing proposal id", async function () {
      const { governorText } = await loadFixture(deployFixture);
      await expect(governorText.getProposalDetails(1)).revertedWith(
        "GCSI: Proposal not found",
      );
    });

    it("Verify creator balance should be one ft token less after proposal creation", async function () {
      const { governorText, token, creator } = await loadFixture(deployFixture);
      const BALANCE_BEFORE = TWENTY_PERCENT;
      const BALANCE_AFTER = BALANCE_BEFORE - TestHelper.toPrecision(1);
      await verifyAccountBalance(token, creator.address, BALANCE_BEFORE);
      await getTextProposalId(governorText, creator);
      await verifyAccountBalance(token, creator.address, BALANCE_AFTER);
    });

    it("Verify creator balance should be one nft token less after proposal creation", async function () {
      const { nftToken, creator, nftGovernorText } =
        await loadFixture(deployFixture);

      const BALANCE_BEFORE = TestHelper.NFT_IDS.length;
      const BALANCE_AFTER = BALANCE_BEFORE - 1;
      await verifyAccountBalance(nftToken, creator.address, BALANCE_BEFORE);
      await getTextProposalId(
        nftGovernorText,
        creator,
        TITLE,
        TestHelper.NFT_FOR_PROPOSAL_CREATION,
      );
      await verifyAccountBalance(nftToken, creator.address, BALANCE_AFTER);
    });

    it("Verify creator balance should be one ft token more after proposal cancellation", async function () {
      const { governorText, token, creator } = await loadFixture(deployFixture);
      await getTextProposalId(governorText, creator);

      const BEFORE = await token.balanceOf(creator.address);
      const AFTER = BEFORE.add(TestHelper.toPrecision(1)).toNumber();

      await verifyAccountBalance(token, creator.address, BEFORE);
      const tx = await governorText.cancelProposal(TITLE);
      const { activeProposalsCount, blockedGodTokenBalance } =
        await readLastGovernorBalanceEvent(tx);
      expect(activeProposalsCount).equals(0);
      expect(blockedGodTokenBalance).equals(0);
      await verifyAccountBalance(token, creator.address, AFTER);
    });

    it("Verify creator balance should be one nft token more after proposal cancellation", async function () {
      const { nftToken, creator, nftGovernorText } =
        await loadFixture(deployFixture);

      await getTextProposalId(
        nftGovernorText,
        creator,
        TITLE,
        TestHelper.NFT_FOR_PROPOSAL_CREATION,
      );

      const BALANCE_BEFORE = TestHelper.NFT_IDS.length - 1;
      const BALANCE_AFTER = BALANCE_BEFORE + 1;

      await verifyAccountBalance(nftToken, creator.address, BALANCE_BEFORE);
      await nftGovernorText.cancelProposal(TITLE);
      await verifyAccountBalance(nftToken, creator.address, BALANCE_AFTER);
    });

    it("Verify creator balance should be one ft token more after proposal execution", async function () {
      const { governorText, token, creator, godHolder, signers } =
        await loadFixture(deployFixture);

      await godHolder.grabTokensFromUser(LOCKED_TOKEN);
      const { proposalId } = await getTextProposalId(governorText, creator);

      const BEFORE = await token.balanceOf(creator.address);
      const AFTER = BEFORE.add(TestHelper.toPrecision(1)).toNumber();

      const tx = await governorText.castVotePublic(proposalId, 0, 1);
      const events = await TestHelper.readEvents(tx, ["ProposalDetails"]);
      const proposalDetails = events.pop();
      expect(proposalDetails.args.votingInformation.voted).equals(true);
      expect(proposalDetails.args.votingInformation.votedUser).equals(
        signers[0].address,
      );
      expect(proposalDetails.args.votingInformation.forVotes).equals(
        1000000000,
      );
      expect(proposalDetails.args.votingInformation.againstVotes).equals(0);
      expect(proposalDetails.args.votingInformation.abstainVotes).equals(0);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);

      await verifyAccountBalance(token, creator.address, BEFORE);
      const txn = await governorText.executeProposal(TITLE);
      const { activeProposalsCount, blockedGodTokenBalance } =
        await readLastGovernorBalanceEvent(txn);
      expect(activeProposalsCount).equals(0);
      expect(blockedGodTokenBalance).equals(0);
      await verifyAccountBalance(token, creator.address, AFTER);
    });

    it("Verify creator balance should be one nft token more after proposal execution", async function () {
      const { nftToken, nftGodHolder, creator, nftGovernorText } =
        await loadFixture(deployFixture);
      await nftGodHolder
        .connect(creator)
        .grabTokensFromUser(TestHelper.NFT_FOR_VOTING);

      const { proposalId } = await getTextProposalId(
        nftGovernorText,
        creator,
        TITLE,
        TestHelper.NFT_FOR_PROPOSAL_CREATION,
      );

      await nftGovernorText.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);

      await verifyAccountBalance(
        nftToken,
        creator.address,
        TestHelper.NFT_IDS.length - 2,
      );
      await nftGovernorText.executeProposal(TITLE);
      await verifyAccountBalance(
        nftToken,
        creator.address,
        TestHelper.NFT_IDS.length - 1,
      );
      await nftGodHolder.connect(creator).revertTokensForVoter(0);
      await verifyAccountBalance(
        nftToken,
        creator.address,
        TestHelper.NFT_IDS.length,
      );
    });

    it("Verify cast vote should be reverted if voter tokens are not locked", async function () {
      const { governorText, creator } = await loadFixture(deployFixture);
      const { proposalId } = await getTextProposalId(governorText, creator);
      await expect(governorText.castVotePublic(proposalId, 0, 1)).revertedWith(
        "GCSI: lock token to vote",
      );
    });

    it("Verify governance common properties (delay, period, threshold) are set properly", async function () {
      const { governorText } = await loadFixture(deployFixture);
      const delay = await governorText.votingDelay();
      const period = await governorText.votingPeriod();
      const threshold = await governorText.proposalThreshold();
      expect(delay).equals(VOTING_DELAY);
      expect(period).equals(VOTING_PERIOD);
      expect(threshold).equals(0);
    });

    it("Verify votes, quorum, vote-succeeded value's should have default values when no vote casted", async function () {
      const { governorText, creator } = await loadFixture(deployFixture);
      const { proposalId } = await getTextProposalId(governorText, creator);
      await verifyProposalVotes(governorText, proposalId, {
        abstainVotes: 0,
        againstVotes: 0,
        forVotes: 0,
      });
      expect(await governorText.quorumReached(proposalId)).equals(false);
      expect(await governorText.voteSucceeded(proposalId)).equals(false);
    });

    it("Verify votes, quorum, vote-succeeded value's should be updated when vote casted in favour", async function () {
      const { governorText, creator, godHolder } =
        await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(LOCKED_TOKEN);

      const { proposalId } = await getTextProposalId(governorText, creator);
      await governorText.castVotePublic(proposalId, 0, 1);
      await verifyProposalVotes(governorText, proposalId, {
        abstainVotes: 0,
        againstVotes: 0,
        forVotes: LOCKED_TOKEN,
      });
      expect(await governorText.voteSucceeded(proposalId)).equals(true);
      expect(await governorText.quorumReached(proposalId)).equals(true);
    });

    it("Verify votes, vote-succeeded value's should be updated when vote casted in favour with less then quorum share", async function () {
      const { governorText, creator, godHolder } =
        await loadFixture(deployFixture);
      const lockedTokens = TestHelper.toPrecision(QUORUM_THRESHOLD - 1);
      await godHolder.grabTokensFromUser(lockedTokens);

      const { proposalId } = await getTextProposalId(governorText, creator);
      await governorText.castVotePublic(proposalId, 0, 1);
      await verifyProposalVotes(governorText, proposalId, {
        abstainVotes: 0,
        againstVotes: 0,
        forVotes: lockedTokens,
      });
      expect(await governorText.voteSucceeded(proposalId)).equals(true);
      expect(await governorText.quorumReached(proposalId)).equals(false);
    });

    it("Verify votes, quorum value's should be updated when vote casted abstain", async function () {
      const { governorText, creator, godHolder } =
        await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(LOCKED_TOKEN);

      const { proposalId } = await getTextProposalId(governorText, creator);
      await governorText.castVotePublic(proposalId, 0, 2);
      await verifyProposalVotes(governorText, proposalId, {
        abstainVotes: LOCKED_TOKEN,
        forVotes: 0,
        againstVotes: 0,
      });
      expect(await governorText.voteSucceeded(proposalId)).equals(false);
      expect(await governorText.quorumReached(proposalId)).equals(true);
    });

    it("Verify votes value should be updated when vote casted against", async function () {
      const { governorText, creator, godHolder } =
        await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(LOCKED_TOKEN);

      const { proposalId } = await getTextProposalId(governorText, creator);
      await governorText.castVotePublic(proposalId, 0, 0);
      await verifyProposalVotes(governorText, proposalId, {
        abstainVotes: 0,
        forVotes: 0,
        againstVotes: LOCKED_TOKEN,
      });
      expect(await governorText.voteSucceeded(proposalId)).equals(false);
      expect(await governorText.quorumReached(proposalId)).equals(false);
    });

    it("Verify active proposal count should be updated when vote casted", async function () {
      const { governorText, creator, godHolder } =
        await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(LOCKED_TOKEN);

      const { proposalId } = await getTextProposalId(governorText, creator);

      expect(
        (await godHolder.callStatic.getActiveProposalsForUser()).length,
      ).equals(0);

      await governorText.castVotePublic(proposalId, 0, 1);

      expect(
        (await godHolder.callStatic.getActiveProposalsForUser()).length,
      ).equals(1);
    });

    it("Verify proposal should be in 'Pending' state when proposal created and voting period not started", async function () {
      const { governorText, creator } = await loadFixture(deployFixture);
      const { proposalId } = await getTextProposalId(governorText, creator);
      expect(await governorText.state(proposalId)).equals(0);
    });

    it("Verify proposal should be in 'Active' state when proposal created", async function () {
      const { governorText, creator } = await loadFixture(deployFixture);
      const { proposalId } = await getTextProposalId(governorText, creator);
      await TestHelper.mineNBlocks(2);
      expect(await governorText.state(proposalId)).equals(1);
    });

    it("Verify proposal should be in 'Cancelled' state when proposal cancelled", async function () {
      const { governorText, creator } = await loadFixture(deployFixture);
      const { proposalId } = await getTextProposalId(governorText, creator);
      await governorText.cancelProposal(TITLE);
      expect(await governorText.state(proposalId)).equals(2);
    });

    it("Verify proposal should be in 'Defeated' state when no vote casted and voting period ended", async function () {
      const { governorText, creator } = await loadFixture(deployFixture);
      const { proposalId } = await getTextProposalId(governorText, creator);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);
      expect(await governorText.state(proposalId)).equals(3);
    });

    it("Verify proposal should be in 'Succeeded' state when vote succeeded and quorum reached", async function () {
      const { governorText, creator, godHolder } =
        await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(LOCKED_TOKEN);
      const { proposalId } = await getTextProposalId(governorText, creator);
      await governorText.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);
      expect(await governorText.state(proposalId)).equals(4);
    });

    it("Verify proposal should be in 'Executed' state when proposal executed", async function () {
      const { governorText, creator, godHolder } =
        await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(LOCKED_TOKEN);
      const { proposalId } = await getTextProposalId(governorText, creator);
      await governorText.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(20);
      await governorText.executeProposal(TITLE);
      expect(await governorText.state(proposalId)).equals(7);
    });

    it("Verify proposal creation should be reverted when creator having zero GOD token", async function () {
      const { governorText, token, creator } = await loadFixture(deployFixture);
      await token.setUserBalance(creator.address, 0);
      await verifyAccountBalance(token, creator.address, 0);

      await token.setTransaferFailed(true);
      await expect(getTextProposalId(governorText, creator)).revertedWith(
        "GCSI: transfer failed to contract",
      );
    });

    it("Verify proposal execution should be reverted when unlocking the god token", async function () {
      const { governorText, creator, godHolder, token } =
        await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(LOCKED_TOKEN);
      const { proposalId } = await getTextProposalId(governorText, creator);
      await governorText.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(20);

      await token.setTransaferFailed(true);
      await expect(governorText.executeProposal(TITLE)).rejectedWith(
        "GCSI: transfer failed from contract.",
      );
    });

    it("Verify proposal cancellation should be reverted if requested by non-creator user", async function () {
      const { governorText, creator, signers } =
        await loadFixture(deployFixture);
      await getTextProposalId(governorText, creator);
      await expect(
        governorText.connect(signers[1]).cancelProposal(TITLE),
      ).revertedWith("GCSI: Only proposer can cancel");
    });

    it("Verify proposal details call should return data for valid proposal id", async function () {
      const { governorText, creator, godHolder } =
        await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(LOCKED_TOKEN);

      const { proposalId } = await getTextProposalId(governorText, creator);
      const result =
        await governorText.callStatic.getProposalDetails(proposalId);

      expect(result[0]).equals(500000000);
      expect(result[1]).equals(false);
      expect(result[2]).equals(0);
      expect(result[3]).equals(false);
      expect(result[4]).equals(0);
      expect(result[5]).equals(0);
      expect(result[6]).equals(0);
      expect(result[7]).equals(creator.address);
      expect(result[8]).equals(TITLE);
      expect(result[9]).equals(DESC);
      expect(result[10]).equals(LINK);
      await governorText.castVotePublic(proposalId, 0, 1);

      const result1 =
        await governorText.callStatic.getProposalDetails(proposalId);

      expect(result1[0]).equals(500000000);
      expect(result1[1]).equals(true);
      expect(result1[2]).equals(1);
      expect(result1[3]).equals(true);
      expect(result1[4]).equals(0);
      expect(result1[5]).equals(LOCKED_TOKEN);
      expect(result1[6]).equals(0);
      expect(result1[7]).equals(creator.address);
      expect(result1[8]).equals(TITLE);
      expect(result1[9]).equals(DESC);
      expect(result1[10]).equals(LINK);
    });

    it("Verify default quorum threshold for governance contract", async function () {
      const { governorText, token } = await loadFixture(deployFixture);
      const total = await token.totalSupply();
      const result = await governorText.quorum(123);
      expect(total).equals(TOTAL_SUPPLY);
      expect(result).equals(TestHelper.toPrecision(QUORUM_THRESHOLD));
    });

    it("When total supply of the GOD token is increased then its quorum threshold should also increased.", async function () {
      const { governorText, token } = await loadFixture(deployFixture);
      const newTotal = TOTAL_SUPPLY * 2;
      await token.setTotal(newTotal);
      const updatedTotal = await token.totalSupply();
      expect(updatedTotal).equals(newTotal);
      const result = await governorText.quorum(123);
      const correctQuorumNumber = (QUORUM_THRESHOLD / 100) * newTotal;
      expect(result).equals(correctQuorumNumber.toFixed(0));
    });

    it("When default(5%) quorum threshold results in zero quorum threshold value then quorum call should fail. ", async function () {
      const { governorText, token } = await loadFixture(deployFixture);
      const newTotal = 19;
      await token.setTotal(newTotal);
      const updatedTotal = await token.totalSupply();
      expect(updatedTotal).equals(newTotal);
      const correctQuorumNumber = (QUORUM_THRESHOLD / 100) * newTotal;
      expect(Math.floor(correctQuorumNumber)).equals(0);
      await expect(governorText.quorum(123)).revertedWith(
        "GCSI: (GOD token * quorum) < 10,000",
      );
    });
    describe("Governor balance and active proposal count tests.", async () => {
      const createTextProposalAndConsumeEvent = async (
        title: string,
        governorText: any,
        creator: SignerWithAddress,
      ) => {
        const tx = await governorText
          .connect(creator)
          .createProposal(title, DESC, LINK, META_DATA, 0);
        const result = await readLastGovernorBalanceEvent(tx);

        return result;
      };

      it("Verify active proposal count when user creates a proposal", async () => {
        const { governorText, creator } = await loadFixture(deployFixture);
        const { activeProposalsCount, blockedGodTokenBalance } =
          await createTextProposalAndConsumeEvent(
            "anyTitle",
            governorText,
            creator,
          );
        const expectedCount = 1;
        expect(activeProposalsCount).equals(expectedCount);
        expect(blockedGodTokenBalance).equals(
          TestHelper.toPrecision(expectedCount),
        );
      });
      it("Verify active proposal count when user creates two proposals", async () => {
        const { governorText, creator } = await loadFixture(deployFixture);
        const result = await createTextProposalAndConsumeEvent(
          "anyTitle1",
          governorText,
          creator,
        );
        const expectedCount = 1;
        expect(result.activeProposalsCount).equals(expectedCount);
        expect(result.blockedGodTokenBalance).equals(
          TestHelper.toPrecision(expectedCount),
        );

        const result1 = await createTextProposalAndConsumeEvent(
          "anyTitle2",
          governorText,
          creator,
        );
        expect(result1.activeProposalsCount).equals(expectedCount + 1);
        expect(result1.blockedGodTokenBalance).equals(
          TestHelper.toPrecision(expectedCount + 1),
        );
      });
    });
  });

  describe("TextGovernor contract tests", async () => {
    it("Verify text proposal should be executed for ft governance", async function () {
      const { governorText, creator, godHolder } =
        await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(LOCKED_TOKEN);
      const { proposalId } = await getTextProposalId(governorText, creator);
      await governorText.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(20);
      await governorText.executeProposal(TITLE);
      expect(await governorText.state(proposalId)).equals(7);
    });
  });

  describe("TokenCreateGovernor contract tests", async () => {
    it("Verify token creation should be executed", async function () {
      const { governorToken, creator, godHolder } =
        await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(LOCKED_TOKEN);
      const { proposalId } = await getTokenCreateProposalId(
        governorToken,
        "tokenName",
        creator,
      );
      await governorToken.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);
      await expect(governorToken.getTokenAddress(proposalId)).revertedWith(
        "Contract not executed yet!",
      );
      await governorToken.executeProposal(TITLE);
      expect(await governorToken.getTokenAddress(proposalId)).not.equals(
        TestHelper.ZERO_ADDRESS,
      );
    });

    it("Given NFT Token used as governance token when proposal executed then execution flow should be successful", async () => {
      const { creator, nftGodHolder, nftGovernorToken } =
        await loadFixture(deployFixture);
      await nftGodHolder
        .connect(creator)
        .grabTokensFromUser(TestHelper.NFT_FOR_VOTING);
      const { proposalId } = await getTokenCreateProposalId(
        nftGovernorToken,
        "tokenName",
        creator,
        TestHelper.NFT_FOR_PROPOSAL_CREATION,
      );
      await nftGovernorToken.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);
      await nftGovernorToken.executeProposal(TITLE);
      expect(await nftGovernorToken.getTokenAddress(proposalId)).not.equals(
        TestHelper.ZERO_ADDRESS,
      );
    });

    it("Verify token creation proposal should be failed during execution", async function () {
      const { governorToken, hederaService, creator, godHolder } =
        await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(LOCKED_TOKEN);
      const { proposalId } = await getTokenCreateProposalId(
        governorToken,
        "FAIL",
        creator,
      );
      await governorToken.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);
      await hederaService.setPassTransactionCount(0); // 0 pass transaction
      await hederaService.setRevertCreateToken(true);
      await expect(governorToken.executeProposal(TITLE)).to.revertedWith(
        "GTC: Token creation failed.",
      );
      await hederaService.setRevertCreateToken(false);
      await expect(governorToken.executeProposal(TITLE)).to.revertedWith(
        "GTC: Token creation failed.",
      );
    });

    describe("Minting scenarios ", async function () {
      it("Given user executed token create proposal when user try to mint only treasurer is allowed", async function () {
        const { governorToken, creator, godHolder } =
          await loadFixture(deployFixture);
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator,
        );
        const qtyToMint = 1;
        const newTokenSupply = await governorToken
          .connect(creator)
          .callStatic.mintToken(proposalId, qtyToMint);
        expect(newTokenSupply).equals(qtyToMint);
      });

      it("Given user not executed token create proposal when treasurer try to mint then minting should fail", async function () {
        const { governorToken, creator, godHolder } =
          await loadFixture(deployFixture);
        await godHolder.grabTokensFromUser(LOCKED_TOKEN);
        const { proposalId } = await getTokenCreateProposalId(
          governorToken,
          "tokenName",
          creator,
        );
        await governorToken.castVotePublic(proposalId, 0, 1);
        await TestHelper.mineNBlocks(BLOCKS_COUNT);
        const qtyToMint = 1;
        await expect(
          governorToken
            .connect(creator)
            .callStatic.mintToken(proposalId, qtyToMint),
        ).revertedWith("GTC: mint, no proposal");
      });

      it("Given user executed token create proposal when minting fails from HTS then minting operation call should fail", async function () {
        const { governorToken, creator, godHolder } =
          await loadFixture(deployFixture);
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator,
        );
        const tokenAddress = await governorToken.getTokenAddress(proposalId);
        const tokenContract = await ethers.getContractAt(
          "ERC20Mock",
          tokenAddress,
        );
        await tokenContract.setName("FAIL");
        const qtyToMint = 1;
        await expect(
          governorToken
            .connect(creator)
            .callStatic.mintToken(proposalId, qtyToMint),
        ).revertedWith("GTC: Minting failed");
      });

      it("Given user executed token create proposal when non-treasurer user try to mint then minting should fail", async function () {
        const { governorToken, creator, godHolder, signers } =
          await loadFixture(deployFixture);
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator,
        );
        const qtyToMint = 1;
        const nonOwnerSigner = signers[3];
        await expect(
          governorToken
            .connect(nonOwnerSigner)
            .callStatic.mintToken(proposalId, qtyToMint),
        ).revertedWith("GTC: treasurer can mint");
      });
    });

    describe.skip("Burning scenarios ", async function () {
      it("Given user executed token create proposal when user try to burn only treasurer is allowed", async function () {
        const { governorToken, creator, godHolder } =
          await loadFixture(deployFixture);
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator,
        );
        const qtyToMint = 2;
        const totalSupply = await governorToken
          .connect(creator)
          .callStatic.mintToken(proposalId, qtyToMint);
        expect(totalSupply).equals(qtyToMint);
        const qtyToBurn = totalSupply - 1;
        const newTokenSupply = await governorToken
          .connect(creator)
          .callStatic.burnToken(proposalId, qtyToBurn);
        expect(newTokenSupply).equals(qtyToBurn);
      });

      it("Given user not executed token create proposal when treasurer try to burn then burning should fail", async function () {
        const { governorToken, creator, godHolder } =
          await loadFixture(deployFixture);
        await godHolder.grabTokensFromUser(LOCKED_TOKEN);
        const { proposalId } = await getTokenCreateProposalId(
          governorToken,
          "tokenName",
          creator,
        );
        await governorToken.castVotePublic(proposalId, 0, 1);
        await TestHelper.mineNBlocks(BLOCKS_COUNT);
        const qtyToBurn = 1;
        await expect(
          governorToken
            .connect(creator)
            .callStatic.burnToken(proposalId, qtyToBurn),
        ).revertedWith("GTC: burn, no proposal.");
      });

      it("Given user executed token create proposal when burning fails from HTS then minting operation call should fail", async function () {
        const { governorToken, creator, godHolder } =
          await loadFixture(deployFixture);
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator,
        );
        const tokenAddress = await governorToken.getTokenAddress(proposalId);
        const tokenContract = await ethers.getContractAt(
          "ERC20Mock",
          tokenAddress,
        );
        await tokenContract.setName("FAIL");
        const qtyToBurn = 1;
        await expect(
          governorToken
            .connect(creator)
            .callStatic.burnToken(proposalId, qtyToBurn),
        ).revertedWith("GTC: Burn failed");
      });

      it("Given user executed token create proposal when non-treasurer user try to burn then burning should fail", async function () {
        const { governorToken, creator, godHolder, signers } =
          await loadFixture(deployFixture);
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator,
        );
        const qtyToBurn = 1;
        const nonOwnerSigner = signers[3];
        await expect(
          governorToken
            .connect(nonOwnerSigner)
            .callStatic.burnToken(proposalId, qtyToBurn),
        ).revertedWith("GTC: only treasurer");
      });
    });

    describe("Transfer scenarios", async () => {
      it("Given user executed token create proposal when user try to transfer zero or less than zero token then transfer should fail", async function () {
        const { governorToken, creator, godHolder, signers } =
          await loadFixture(deployFixture);
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator,
        );
        const qtyToTransfer = 0;

        await expect(
          governorToken
            .connect(creator)
            .transferToken(proposalId, signers[1].address, qtyToTransfer),
        ).revertedWith("GTC: qty should be > 0");
      });

      it("Given user executed token create proposal when user try to transfer only treasurer is allowed", async function () {
        const { governorToken, creator, godHolder, signers } =
          await loadFixture(deployFixture);
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator,
        );
        const newToken = await governorToken.getTokenAddress(proposalId);
        const qtyToTransfer = 2;
        const token = await ethers.getContractAt("ERC20Mock", newToken);
        await token.setUserBalance(governorToken.address, qtyToTransfer);
        expect(await token.balanceOf(governorToken.address)).equals(
          qtyToTransfer,
        );
        await governorToken
          .connect(creator)
          .transferToken(proposalId, signers[1].address, qtyToTransfer);
        const transferredQty = await token.balanceOf(signers[1].address);
        expect(transferredQty).equals(qtyToTransfer);
      });

      it("Given user executed token create proposal when treasurer try to transfer but has no sufficient balance then transfer should fail", async function () {
        const { governorToken, creator, godHolder, signers } =
          await loadFixture(deployFixture);
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator,
        );
        const newToken = await governorToken.getTokenAddress(proposalId);
        const qtyToTransfer = 2;
        const token = await ethers.getContractAt("ERC20Mock", newToken);
        const contractBalanceLessThanQtyToTransfer = qtyToTransfer - 1;
        await token.setUserBalance(
          governorToken.address,
          contractBalanceLessThanQtyToTransfer,
        );
        expect(await token.balanceOf(governorToken.address)).equals(
          contractBalanceLessThanQtyToTransfer,
        );
        await expect(
          governorToken
            .connect(creator)
            .transferToken(proposalId, signers[1].address, qtyToTransfer),
        ).revertedWith("GTC: low balance.");
      });

      it("Given user executed token create proposal when user try to transfer only treasurer is allowed", async function () {
        const { governorToken, creator, godHolder, signers } =
          await loadFixture(deployFixture);
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator,
        );
        const newToken = await governorToken.getTokenAddress(proposalId);
        const qtyToTransfer = 2;
        const token = await ethers.getContractAt("ERC20Mock", newToken);
        await token.setUserBalance(governorToken.address, qtyToTransfer);
        expect(await token.balanceOf(governorToken.address)).equals(
          qtyToTransfer,
        );
        await token.setTransaferFailed(true);
        await expect(
          governorToken
            .connect(creator)
            .transferToken(proposalId, signers[1].address, qtyToTransfer),
        ).revertedWith("GTC: transfer failed.");
      });

      it("Given user executed token create proposal when non-treasurer try to transfer then transfer should fail", async function () {
        const { governorToken, creator, godHolder, signers } =
          await loadFixture(deployFixture);
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator,
        );
        const nonTreasurer = signers[3];
        const qtyToTransfer = 2;
        await expect(
          governorToken
            .connect(nonTreasurer)
            .transferToken(proposalId, signers[1].address, qtyToTransfer),
        ).revertedWith("GTC: only treasurer");
      });

      it("Given user not executed token create proposal when treasurer try to transfer then transfer should fail", async function () {
        const { governorToken, creator, godHolder, signers } =
          await loadFixture(deployFixture);
        await godHolder.grabTokensFromUser(LOCKED_TOKEN);
        const { proposalId } = await getTokenCreateProposalId(
          governorToken,
          "tokenName",
          creator,
        );
        await governorToken.castVotePublic(proposalId, 0, 1);
        await TestHelper.mineNBlocks(BLOCKS_COUNT);
        const qtyToTransfer = 2;
        await expect(
          governorToken
            .connect(creator)
            .transferToken(proposalId, signers[1].address, qtyToTransfer),
        ).revertedWith("GTC: no token for this proposal");
      });

      it("Upgrade hederaService fails with non creator", async () => {
        const { governorTT, signers } = await loadFixture(deployFixture);

        const nonCreator = signers[2];

        await expect(
          governorTT
            .connect(nonCreator)
            .upgradeHederaService(signers[3].address),
        ).revertedWith("Ownable: caller is not the owner");
      });

      it("Upgrade hederaService passes with creator", async () => {
        const { governorTT, creator, signers } =
          await loadFixture(deployFixture);

        await expect(
          governorTT.connect(creator).upgradeHederaService(signers[3].address),
        ).not.revertedWith("Ownable: caller is not the owner");
      });
    });

    it("Verify proposal is executed before minting and burning", async function () {
      const { governorToken, creator, godHolder } =
        await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(LOCKED_TOKEN);
      const { proposalId } = await getTokenCreateProposalId(
        governorToken,
        "tokenName",
        creator,
      );
      await governorToken.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);
      await expect(governorToken.getTokenAddress(proposalId)).revertedWith(
        "Contract not executed yet!",
      );

      await expect(
        governorToken.connect(creator).callStatic.mintToken(proposalId, 2),
      ).revertedWith("GTC: mint, no proposal");

      // await expect(
      //   governorToken.connect(creator).callStatic.burnToken(proposalId, 1)
      // ).revertedWith("GTC: burn, no proposal.");
    });

    it("Verify contract should return a correct token address", async function () {
      const { governorText, token } = await loadFixture(deployFixture);
      const tokenAddress = await governorText.getGODTokenAddress();
      expect(token.address).equals(tokenAddress);
    });

    it("Verify contract should initialize quorum threshold value with 500 when user passed 0 as threshold", async function () {
      const { godHolder, hederaService, token, systemRoleBasedAccess } =
        await loadFixture(deployFixture);
      const ARGS = [
        token.address,
        VOTING_DELAY,
        VOTING_PERIOD,
        hederaService.address,
        godHolder.address,
        0,
        systemRoleBasedAccess,
      ];
      const governorText = await TestHelper.deployLogic("GovernorTextProposal");
      await governorText.initialize(...ARGS);
      const result = await governorText.quorum(0);
      expect(result).equals(TestHelper.toPrecision(QUORUM_THRESHOLD));
    });
  });

  describe("GovernorUpgrade contract tests", async () => {
    it("Verify upgrade proposal should be reverted if no rights transfer to governance before execution", async function () {
      const { creator, godHolder, governorUpgrade, governorTestProxy } =
        await loadFixture(deployFixture);

      await godHolder.grabTokensFromUser(LOCKED_TOKEN);
      const { proposalId } = await getUpgradeProposalId(
        governorUpgrade,
        creator,
        governorTestProxy.address,
        TestHelper.ONE_ADDRESS,
      );
      await governorUpgrade.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);

      await expect(governorUpgrade.executeProposal(TITLE)).revertedWith(
        "GU: failed to upgrade proxy, verify governor is owner",
      );
    });

    it("Verify upgrade proposal should be executed", async function () {
      const {
        creator,
        godHolder,
        governorUpgrade,
        governorTestProxy,
        systemUsersSigners,
      } = await loadFixture(deployFixture);

      const proxyAdmin = systemUsersSigners.proxyAdmin;
      const newLogicAddress = TestHelper.ONE_ADDRESS;

      await godHolder.grabTokensFromUser(LOCKED_TOKEN);
      const { proposalId } = await getUpgradeProposalId(
        governorUpgrade,
        creator,
        governorTestProxy.address,
        newLogicAddress,
      );
      await governorUpgrade.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);

      // step : 1
      await governorTestProxy
        .connect(proxyAdmin)
        .changeAdmin(governorUpgrade.address);

      // verification if we changed the rights
      await expect(
        governorTestProxy
          .connect(proxyAdmin)
          .changeAdmin(governorUpgrade.address),
      ).reverted;

      // step : 2
      await governorUpgrade.executeProposal(TITLE);

      expect(
        await governorTestProxy.connect(proxyAdmin).implementation(),
      ).equals(newLogicAddress);

      expect(await governorTestProxy.connect(proxyAdmin).admin()).equals(
        proxyAdmin.address,
      );
    });
  });

  describe("GovernorTransferToken contract tests", async () => {
    it("Verify HBar transfer proposal creation should be reverted for zero amount", async function () {
      const { creator, receiver, governorTT } =
        await loadFixture(deployFixture);
      await expect(
        getHBarTransferProposalId(governorTT, creator, receiver.address, 0),
      ).revertedWith("GTT: required positive number");
    });

    it("Verify HBar transfer proposal creation data", async function () {
      const { creator, receiver, governorTT } =
        await loadFixture(deployFixture);
      await getHBarTransferProposalId(
        governorTT,
        creator,
        receiver.address,
        10,
      );
    });

    it("Verify HBar transfer should be reverted if contract don't have enough HBar balance", async function () {
      const { creator, godHolder, receiver, governorTT } =
        await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(LOCKED_TOKEN);
      const { proposalId } = await getHBarTransferProposalId(
        governorTT,
        creator,
        receiver.address,
        10,
      );
      await governorTT.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);

      expect(await TestHelper.getAccountHBars(governorTT.address)).equals(0);
      await expect(governorTT.executeProposal(TITLE)).revertedWith(
        "GTT: Hbar transfer failed",
      );
    });

    it("Verify HBar transfer should be succeeded", async function () {
      const { creator, godHolder, receiver, governorTT } =
        await loadFixture(deployFixture);
      const AMOUNT = 10;
      await godHolder.grabTokensFromUser(LOCKED_TOKEN);
      const { proposalId } = await getHBarTransferProposalId(
        governorTT,
        creator,
        receiver.address,
        AMOUNT,
      );
      await governorTT.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);

      expect(await TestHelper.getAccountHBars(governorTT.address)).equals(0);
      await TestHelper.transferBalance(governorTT.address, AMOUNT, creator);
      expect(await TestHelper.getAccountHBars(governorTT.address)).equals(
        AMOUNT,
      );

      const receiverBalBeforeTransfer = await TestHelper.getAccountHBars(
        receiver.address,
      );
      await governorTT.connect(creator).executeProposal(TITLE);
      expect(await TestHelper.getAccountHBars(receiver.address)).equals(
        receiverBalBeforeTransfer.add(AMOUNT),
      );

      expect(await TestHelper.getAccountHBars(governorTT.address)).equals(0);
    });

    it("Verify transfer token proposal should be failed during creation for zero amount", async function () {
      const { governorTT, token, signers } = await loadFixture(deployFixture);
      await expect(
        getTransferTokenProposalId(
          TITLE,
          governorTT,
          signers,
          token.address,
          0,
        ),
      ).revertedWith("GTT: required positive number");
    });

    it("Verify token association proposal creation data", async function () {
      const { governorTT, godHolder, token, signers } =
        await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(LOCKED_TOKEN);
      const { proposalId } = await getTokenAssociateProposalId(
        governorTT,
        signers,
        token.address,
      );
      await governorTT.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);
      await expect(governorTT.executeProposal(TITLE)).reverted;
    });

    it("Verify transfer token proposal should be executed", async function () {
      const {
        signers,
        godHolder,
        governorTT,
        tokenToTransfer: token,
      } = await loadFixture(deployFixture);

      const TOKEN_COUNT = TestHelper.toPrecision(3);
      await token.setUserBalance(governorTT.address, TOKEN_COUNT);

      await godHolder.grabTokensFromUser(LOCKED_TOKEN);
      const { proposalId } = await getTransferTokenProposalId(
        TITLE,
        governorTT,
        signers,
        token.address,
        TOKEN_COUNT,
      );
      await governorTT.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);
      await verifyAccountBalance(token, governorTT.address, TOKEN_COUNT);
      await verifyAccountBalance(token, signers[2].address, 0);
      await governorTT.executeProposal(TITLE);
      await verifyAccountBalance(token, governorTT.address, 0);
      await verifyAccountBalance(token, signers[2].address, TOKEN_COUNT);
    });

    it("Verify transfer token proposal should be failed during execution", async function () {
      const { governorTT, godHolder, tokenToTransfer, signers } =
        await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(LOCKED_TOKEN);

      const TOKEN_COUNT = TestHelper.toPrecision(3);
      const { proposalId } = await getTransferTokenProposalId(
        TITLE,
        governorTT,
        signers,
        tokenToTransfer.address,
        TOKEN_COUNT,
      );

      await governorTT.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);
      await tokenToTransfer.setTransaferFailed(true);
      await expect(governorTT.executeProposal(TITLE)).revertedWith(
        "GTT: transfer failed",
      );
    });

    it("Verify cancel proposal should emit unblock event", async function () {
      const { nftGovernorTT, nftGodHolder, nftToken, signers, creator } =
        await loadFixture(deployFixture);
      await nftGodHolder
        .connect(creator)
        .grabTokensFromUser(TestHelper.NFT_FOR_VOTING);

      expect(
        await nftToken.ownerOf(TestHelper.NFT_FOR_PROPOSAL_CREATION),
      ).equals(creator.address);

      const { proposalId } = await getTransferTokenProposalId(
        TITLE,
        nftGovernorTT,
        signers,
        nftToken.address,
        TestHelper.NFT_FOR_TRANSFER,
        TestHelper.NFT_FOR_PROPOSAL_CREATION,
      );

      const tx = await nftGovernorTT.cancelProposal(TITLE);
      await verifyBlockedNFTSerialIdStatusEvent(
        tx,
        TestHelper.NFT_FOR_PROPOSAL_CREATION,
        false,
      );
    });

    describe("Scenarios for trying to transfer blocked token", async () => {
      describe("Fungible token where GOD and token to transfer are same", async () => {
        it("Given governor has zero GOD token when user try to transfer GOD token via proposal and qty is same as required to create token then token transfer should fail  ", async () => {
          const {
            governorTT,
            godHolder,
            token: godTokenAsTokenToTransfer,
            signers,
          } = await loadFixture(deployFixture);

          await godHolder.grabTokensFromUser(LOCKED_TOKEN);

          const GOVERNOR_TOKEN_BALANCE = TestHelper.toPrecision(0);
          await godTokenAsTokenToTransfer.setUserBalance(
            governorTT.address,
            GOVERNOR_TOKEN_BALANCE,
          );

          const TOKEN_AMOUNT_TO_TRANSFER = TestHelper.toPrecision(1); //Equal to proposal creation amount

          const { proposalId } = await getTransferTokenProposalId(
            TITLE,
            governorTT,
            signers,
            godTokenAsTokenToTransfer.address,
            TOKEN_AMOUNT_TO_TRANSFER,
          );

          await governorTT.castVotePublic(proposalId, 0, 1);
          await TestHelper.mineNBlocks(BLOCKS_COUNT);

          const currentBalance = await godTokenAsTokenToTransfer.balanceOf(
            governorTT.address,
          );
          expect(Number(currentBalance)).equals(TOKEN_AMOUNT_TO_TRANSFER);

          await expect(governorTT.executeProposal(TITLE)).revertedWith(
            "GTT: Overdraft",
          );
        });

        it("Given governor one proposal exists in active state(GOD token locked 1) when user try to transfer GOD token via 2nd proposal and qty is same as required to create token then token transfer should fail  ", async () => {
          const {
            governorTT,
            godHolder,
            token: godTokenAsTokenToTransfer,
            signers,
          } = await loadFixture(deployFixture);

          await godHolder.grabTokensFromUser(LOCKED_TOKEN);

          const GOVERNOR_TOKEN_BALANCE = TestHelper.toPrecision(0);
          await godTokenAsTokenToTransfer.setUserBalance(
            governorTT.address,
            GOVERNOR_TOKEN_BALANCE,
          );

          const TOKEN_AMOUNT_TO_TRANSFER = TestHelper.toPrecision(1); //Equal to proposal creation amount

          const { proposalId: proposalId1 } = await getTransferTokenProposalId(
            TITLE + 1,
            governorTT,
            signers,
            godTokenAsTokenToTransfer.address,
            TOKEN_AMOUNT_TO_TRANSFER,
          );

          const { proposalId: proposalId2 } = await getTransferTokenProposalId(
            TITLE + 2,
            governorTT,
            signers,
            godTokenAsTokenToTransfer.address,
            TOKEN_AMOUNT_TO_TRANSFER,
          );

          const totalCreatedProposals = 2;
          const addedGodTokenAfterProposalCreation =
            totalCreatedProposals * TestHelper.toPrecision(1);
          const totalGovernorBalance =
            GOVERNOR_TOKEN_BALANCE + addedGodTokenAfterProposalCreation;
          await verifyAccountBalance(
            godTokenAsTokenToTransfer,
            governorTT.address,
            totalGovernorBalance,
          );

          await governorTT.castVotePublic(proposalId1, 0, 1);
          await TestHelper.mineNBlocks(BLOCKS_COUNT);

          const currentBalance = await godTokenAsTokenToTransfer.balanceOf(
            governorTT.address,
          );
          expect(Number(currentBalance)).equals(TestHelper.toPrecision(2));

          const zero = 0;
          await godTokenAsTokenToTransfer.setUserBalance(
            signers[2].address,
            zero,
          ); //reset token balance
          await verifyAccountBalance(
            godTokenAsTokenToTransfer,
            signers[2].address,
            zero,
          );

          await expect(governorTT.executeProposal(TITLE + 1)).revertedWith(
            "GTT: Overdraft",
          );
        });

        it("Given governor has one GOD token and one proposal exists when user try to transfer GOD token via 2nd proposal and qty is same as required to create token then token transfer should pass  ", async () => {
          const {
            governorTT,
            godHolder,
            token: godTokenAsTokenToTransfer,
            signers,
          } = await loadFixture(deployFixture);

          await godHolder.grabTokensFromUser(LOCKED_TOKEN);

          const TOKEN_AMOUNT_TO_TRANSFER = TestHelper.toPrecision(1);
          const GOVERNOR_TOKEN_BALANCE = TOKEN_AMOUNT_TO_TRANSFER;
          await godTokenAsTokenToTransfer.setUserBalance(
            governorTT.address,
            GOVERNOR_TOKEN_BALANCE,
          );

          const { proposalId: proposalId1 } = await getTransferTokenProposalId(
            TITLE + 1,
            governorTT,
            signers,
            godTokenAsTokenToTransfer.address,
            TOKEN_AMOUNT_TO_TRANSFER,
          );

          const { proposalId: proposalId2 } = await getTransferTokenProposalId(
            TITLE + 2,
            governorTT,
            signers,
            godTokenAsTokenToTransfer.address,
            TOKEN_AMOUNT_TO_TRANSFER,
          );
          const totalCreatedProposals = 2;
          const addedGodTokenAfterProposalCreation =
            totalCreatedProposals * TestHelper.toPrecision(1);
          const totalGovernorBalance =
            GOVERNOR_TOKEN_BALANCE + addedGodTokenAfterProposalCreation;
          await verifyAccountBalance(
            godTokenAsTokenToTransfer,
            governorTT.address,
            totalGovernorBalance,
          );

          await governorTT.castVotePublic(proposalId1, 0, 1);
          await TestHelper.mineNBlocks(BLOCKS_COUNT);

          const zero = 0;
          await godTokenAsTokenToTransfer.setUserBalance(
            signers[2].address,
            zero,
          ); //reset token balance
          await verifyAccountBalance(
            godTokenAsTokenToTransfer,
            signers[2].address,
            zero,
          );

          await governorTT.executeProposal(TITLE + 1);
          const executedProposalCount = 1;
          const unblockedGodTokens =
            executedProposalCount * TestHelper.toPrecision(1);
          const remainingGovernorBalance =
            totalGovernorBalance -
            unblockedGodTokens -
            TOKEN_AMOUNT_TO_TRANSFER;
          await verifyAccountBalance(
            godTokenAsTokenToTransfer,
            governorTT.address,
            remainingGovernorBalance,
          );
          await verifyAccountBalance(
            godTokenAsTokenToTransfer,
            signers[2].address,
            TOKEN_AMOUNT_TO_TRANSFER,
          );
        });
      });
      describe("Non Fungible token where GOD and token serial id to transfer are same", async () => {
        it("NFT GOD token(token to block at the time of proposal creation) and NFT token to transfer can't be same.", async () => {
          const { nftGovernorTT, nftToken, signers } =
            await loadFixture(deployFixture);
          const data = {
            transferToAccount: signers[2].address,
            tokenToTransfer: nftToken.address,
            transferTokenAmount: TestHelper.NFT_FOR_PROPOSAL_CREATION,
          };
          await expect(
            nftGovernorTT
              .connect(signers[0])
              .createProposal(
                TITLE,
                DESC,
                LINK,
                META_DATA,
                data.transferToAccount,
                data.tokenToTransfer,
                data.transferTokenAmount,
                TestHelper.NFT_FOR_PROPOSAL_CREATION,
              ),
          ).revertedWith(
            "GTT: NFT GOD token and token to transfer can't be same.",
          );
        });

        it("Proposal creation allowed with different serial ids for NFT GOD token and NFT token to transfer even if token is same", async () => {
          const { nftGovernorTT, nftGodHolder, nftToken, signers, creator } =
            await loadFixture(deployFixture);

          await nftToken.transferFrom(
            creator.address,
            nftGovernorTT.address,
            TestHelper.NFT_FOR_TRANSFER,
          );

          await nftGodHolder
            .connect(creator)
            .grabTokensFromUser(TestHelper.NFT_FOR_VOTING);

          expect(
            await nftToken.ownerOf(TestHelper.NFT_FOR_PROPOSAL_CREATION),
          ).equals(creator.address);
          expect(await nftToken.ownerOf(TestHelper.NFT_FOR_TRANSFER)).equals(
            nftGovernorTT.address,
          );
          expect(await nftToken.ownerOf(TestHelper.NFT_FOR_VOTING)).equals(
            nftGodHolder.address,
          );

          const { proposalId } = await getTransferTokenProposalId(
            TITLE,
            nftGovernorTT,
            signers,
            nftToken.address,
            TestHelper.NFT_FOR_TRANSFER,
            TestHelper.NFT_FOR_PROPOSAL_CREATION,
          );

          await nftGovernorTT.castVotePublic(proposalId, 0, 1);
          await TestHelper.mineNBlocks(BLOCKS_COUNT);
          const tx = await nftGovernorTT.executeProposal(TITLE);

          expect(
            await nftToken.ownerOf(TestHelper.NFT_FOR_PROPOSAL_CREATION),
          ).equals(creator.address);
          expect(await nftToken.ownerOf(TestHelper.NFT_FOR_TRANSFER)).equals(
            signers[2].address,
          );
          expect(await nftToken.ownerOf(TestHelper.NFT_FOR_VOTING)).equals(
            nftGodHolder.address,
          );

          await verifyBlockedNFTSerialIdStatusEvent(
            tx,
            TestHelper.NFT_FOR_PROPOSAL_CREATION,
            false,
          );
        });
        it("Given serial id is blocked by a proposal when user try to transfer that id using another proposal then it should fail", async () => {
          const { nftGovernorTT, nftGodHolder, nftToken, signers, creator } =
            await loadFixture(deployFixture);

          await nftGodHolder
            .connect(creator)
            .grabTokensFromUser(TestHelper.NFT_FOR_VOTING);

          expect(
            await nftToken.ownerOf(TestHelper.NFT_FOR_PROPOSAL_CREATION),
          ).equals(creator.address);

          expect(await nftToken.ownerOf(TestHelper.NFT_FOR_VOTING)).equals(
            nftGodHolder.address,
          );

          const { proposalId } = await getTransferTokenProposalId(
            TITLE,
            nftGovernorTT,
            signers,
            nftToken.address,
            TestHelper.NFT_FOR_TRANSFER,
            TestHelper.NFT_FOR_PROPOSAL_CREATION,
          );

          expect(
            await nftToken.ownerOf(TestHelper.NFT_FOR_PROPOSAL_CREATION),
          ).equals(nftGovernorTT.address);

          expect(await nftToken.ownerOf(TestHelper.NFT_FOR_TRANSFER)).equals(
            creator.address,
          );

          const proposal2Title = TITLE + 2;

          const { proposalId: proposalId2 } = await getTransferTokenProposalId(
            proposal2Title,
            nftGovernorTT,
            signers,
            nftToken.address,
            TestHelper.NFT_FOR_PROPOSAL_CREATION, //token to transfer
            TestHelper.NFT_FOR_PROPOSAL_CREATION2, //GOD token
          );

          expect(
            await nftToken.ownerOf(TestHelper.NFT_FOR_PROPOSAL_CREATION2),
          ).equals(nftGovernorTT.address);

          await nftGovernorTT.castVotePublic(proposalId2, 0, 1);
          await TestHelper.mineNBlocks(BLOCKS_COUNT);

          await expect(nftGovernorTT.executeProposal(proposal2Title))
            .revertedWithCustomError(
              nftGovernorTT,
              "NFTSerialIdAlreadyBlockedByProposal",
            )
            .withArgs(
              "NFT ID locked by proposal",
              proposalId,
              TestHelper.NFT_FOR_PROPOSAL_CREATION,
            );
        });
      });
    });
  });
});
