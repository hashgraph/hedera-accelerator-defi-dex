import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract } from "ethers";
import { TestHelper } from "./TestHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

interface TokenTransferData {
  transferFromAccount: string;
  transferToAccount: string;
  tokenToTransfer: string;
  transferTokenAmount: number;
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

  const VOTING_DELAY = 0;
  const VOTING_PERIOD = 12;
  const BLOCKS_COUNT = VOTING_PERIOD * 2.5; // 30 blocks

  async function deployFixture() {
    const signers = await TestHelper.getSigners();
    const baseHTS = await TestHelper.deployMockBaseHTS();

    const token = await TestHelper.deployERC20Mock(TOTAL_SUPPLY);
    await token.setUserBalance(signers[0].address, TWENTY_PERCENT);
    await token.setUserBalance(signers[1].address, THIRTY_PERCENT);
    await token.setUserBalance(signers[2].address, FIFTY_PERCENT);

    const creator = signers[0];
    const godHolder = await TestHelper.deployGodHolder(baseHTS, token);

    const ARGS = [
      token.address,
      VOTING_DELAY,
      VOTING_PERIOD,
      baseHTS.address,
      godHolder.address,
      QUORUM_THRESHOLD_BSP,
    ];

    const governorToken = await TestHelper.deployLogic("GovernorTokenCreate");
    await governorToken.initialize(...ARGS);

    const governorText = await TestHelper.deployLogic("GovernorTextProposal");
    await governorText.initialize(...ARGS);

    const governorUpgrade = await TestHelper.deployLogic("GovernorUpgrade");
    await governorUpgrade.initialize(...ARGS);

    const governorTT = await TestHelper.deployLogic("GovernorTransferToken");
    await governorTT.initialize(...ARGS);

    return {
      ARGS,
      token,
      baseHTS,
      signers,
      godHolder,
      governorTT,
      governorText,
      governorToken,
      governorUpgrade,
      creator,
    };
  }

  const verifyProposalVotes = async (
    instance: Contract,
    proposalId: any,
    result: any
  ) => {
    const r = await instance.proposalVotes(proposalId);
    expect(r.abstainVotes, "abstainVotes").equals(result.abstainVotes);
    expect(r.againstVotes, "againstVotes").equals(result.againstVotes);
    expect(r.forVotes, "forVotes").equals(result.forVotes);
  };

  const verifyAccountBalance = async (
    token: Contract,
    account: string,
    targetBalance: number
  ) => {
    const balance = await token.balanceOf(account);
    expect(balance).equals(targetBalance);
  };

  const verifyTokenTransferProposalCreationEvent = async (
    tx: any,
    reqData: TokenTransferData
  ) => {
    const info = await verifyProposalCreationEvent(tx, false);
    const eventData = ethers.utils.defaultAbiCoder.decode(
      [
        "address transferFromAccount",
        "address transferToAccount",
        "address tokenToTransfer",
        "int256 transferTokenAmount",
      ],
      info.data
    );
    expect(eventData.transferFromAccount).equals(reqData.transferFromAccount);
    expect(eventData.transferToAccount).equals(reqData.transferToAccount);
    expect(eventData.tokenToTransfer).equals(reqData.tokenToTransfer);
    expect(eventData.transferTokenAmount.toNumber()).equals(
      reqData.transferTokenAmount
    );
    return info;
  };

  const verifyProposalCreationEvent = async (tx: any, empty: boolean) => {
    const { name, args } = await TestHelper.readLastEvent(tx);
    expect(args.length).equals(8);
    expect(name).equals("ProposalDetails");
    expect(args.proposalId).not.equals("0");
    expect(args.description).equals(DESC);
    expect(args.link).equals(LINK);
    expect(args.startBlock).greaterThan(0);
    expect(args.endBlock).greaterThan(0);
    expect(ethers.utils.arrayify(args.data).length === 0).equals(empty);
    return { proposalId: args.proposalId, data: args.data };
  };

  async function getTextProposalId(
    governance: Contract,
    account: SignerWithAddress,
    title: string = TITLE
  ) {
    const tx = await governance
      .connect(account)
      .createProposal(title, DESC, LINK);
    return await verifyProposalCreationEvent(tx, true);
  }

  async function getUpgradeProposalId(
    instance: Contract,
    account: SignerWithAddress
  ) {
    const tx = await instance
      .connect(account)
      .createProposal(
        TITLE,
        DESC,
        LINK,
        TestHelper.ONE_ADDRESS,
        TestHelper.TWO_ADDRESS
      );
    return await verifyProposalCreationEvent(tx, true);
  }

  async function getTransferTokenProposalId(
    instance: Contract,
    signers: SignerWithAddress[],
    tokenAddress: string,
    amount: number
  ) {
    const data: TokenTransferData = {
      transferFromAccount: signers[1].address,
      transferToAccount: signers[2].address,
      tokenToTransfer: tokenAddress,
      transferTokenAmount: amount,
    };
    const tx = await instance
      .connect(signers[0])
      .createProposal(
        TITLE,
        DESC,
        LINK,
        data.transferFromAccount,
        data.transferToAccount,
        data.tokenToTransfer,
        data.transferTokenAmount,
        signers[0].address
      );
    return await verifyTokenTransferProposalCreationEvent(tx, data);
  }

  async function getTokenCreateProposalId(
    governance: Contract,
    tokenName: string = "Token",
    account: SignerWithAddress
  ) {
    const tx = await governance
      .connect(account)
      .createProposal(TITLE, DESC, LINK, account.address, tokenName, "Symbol");
    return await verifyProposalCreationEvent(tx, true);
  }

  const createTokenCreateProposalAndExecute = async (
    godHolder: Contract,
    governorToken: Contract,
    creator: SignerWithAddress
  ) => {
    await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);
    const { proposalId } = await getTokenCreateProposalId(
      governorToken,
      "tokenName",
      creator
    );
    await governorToken.castVotePublic(proposalId, 0, 1);
    await TestHelper.mineNBlocks(BLOCKS_COUNT);
    await expect(governorToken.getTokenAddress(proposalId)).revertedWith(
      "Contract not executed yet!"
    );
    await governorToken.executeProposal(TITLE);
    expect(await governorToken.getTokenAddress(proposalId)).not.equals(
      TestHelper.ZERO_ADDRESS
    );
    return proposalId;
  };

  describe("Common tests", async () => {
    it("Verify contract should be reverted for multiple initialization", async function () {
      const { governorText, ARGS } = await loadFixture(deployFixture);
      await expect(governorText.initialize(...ARGS)).revertedWith(
        "Initializable: contract is already initialized"
      );
    });

    it("Verify create proposal should be reverted for blank title", async function () {
      const { governorText, creator } = await loadFixture(deployFixture);
      await expect(getTextProposalId(governorText, creator, ""))
        .revertedWithCustomError(governorText, "InvalidInput")
        .withArgs(
          "GovernorCountingSimpleInternal: proposal title can not be blank"
        );
    });

    it("Verify cancelling proposal should be reverted for non-existing title", async function () {
      const { governorText, creator } = await loadFixture(deployFixture);
      await getTextProposalId(governorText, creator);
      await expect(governorText.cancelProposal("not-found")).revertedWith(
        "GovernorCountingSimpleInternal: Proposal not found"
      );
    });

    it("Verify vote casting should be reverted for non-existing proposal id", async function () {
      const { governorText } = await loadFixture(deployFixture);
      await expect(governorText.castVotePublic(1, 0, 1)).revertedWith(
        "GovernorCountingSimpleInternal: Proposal not found"
      );
    });

    it("Verify get proposal details should be reverted for non-existing proposal id", async function () {
      const { governorText } = await loadFixture(deployFixture);
      await expect(governorText.getProposalDetails(1)).revertedWith(
        "GovernorCountingSimpleInternal: Proposal not found"
      );
    });

    it("Verify creator balance should be one token less after proposal creation", async function () {
      const { governorText, token, creator } = await loadFixture(deployFixture);
      const BALANCE_BEFORE = TWENTY_PERCENT;
      const BALANCE_AFTER = BALANCE_BEFORE - TestHelper.toPrecision(1);
      await verifyAccountBalance(token, creator.address, BALANCE_BEFORE);
      await getTextProposalId(governorText, creator);
      await verifyAccountBalance(token, creator.address, BALANCE_AFTER);
    });

    it("Verify creator balance should be one token more after proposal cancellation", async function () {
      const { governorText, token, creator } = await loadFixture(deployFixture);
      await getTextProposalId(governorText, creator);

      const BEFORE = await token.balanceOf(creator.address);
      const AFTER = BEFORE.add(TestHelper.toPrecision(1)).toNumber();

      await verifyAccountBalance(token, creator.address, BEFORE);
      await governorText.cancelProposal(TITLE);
      await verifyAccountBalance(token, creator.address, AFTER);
    });

    it("Verify creator balance should be one token more after proposal execution", async function () {
      const { governorText, token, creator, godHolder } = await loadFixture(
        deployFixture
      );

      await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);
      const { proposalId } = await getTextProposalId(governorText, creator);

      const BEFORE = await token.balanceOf(creator.address);
      const AFTER = BEFORE.add(TestHelper.toPrecision(1)).toNumber();

      await governorText.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);

      await verifyAccountBalance(token, creator.address, BEFORE);
      await governorText.executeProposal(TITLE);
      await verifyAccountBalance(token, creator.address, AFTER);
    });

    it("Verify cast vote should be reverted if voter tokens are not locked", async function () {
      const { governorText, creator } = await loadFixture(deployFixture);
      const { proposalId } = await getTextProposalId(governorText, creator);
      await expect(governorText.castVotePublic(proposalId, 0, 1)).revertedWith(
        "GovernorCountingSimpleInternal: token locking is required to cast the vote"
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
      const { governorText, creator, godHolder } = await loadFixture(
        deployFixture
      );
      await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);

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
      const { governorText, creator, godHolder } = await loadFixture(
        deployFixture
      );
      const lockedTokens = TestHelper.toPrecision(QUORUM_THRESHOLD - 1);
      await godHolder.grabTokensFromUser(creator.address, lockedTokens);

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
      const { governorText, creator, godHolder } = await loadFixture(
        deployFixture
      );
      await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);

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
      const { governorText, creator, godHolder } = await loadFixture(
        deployFixture
      );
      await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);

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
      const { governorText, creator, godHolder } = await loadFixture(
        deployFixture
      );
      await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);

      const { proposalId } = await getTextProposalId(governorText, creator);

      expect(
        (await godHolder.callStatic.getActiveProposalsForUser()).length
      ).equals(0);

      await governorText.castVotePublic(proposalId, 0, 1);

      expect(
        (await godHolder.callStatic.getActiveProposalsForUser()).length
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
      const { governorText, creator, godHolder } = await loadFixture(
        deployFixture
      );
      await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);
      const { proposalId } = await getTextProposalId(governorText, creator);
      await governorText.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);
      expect(await governorText.state(proposalId)).equals(4);
    });

    it("Verify proposal should be in 'Executed' state when proposal executed", async function () {
      const { governorText, creator, godHolder } = await loadFixture(
        deployFixture
      );
      await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);
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
        "GovernorCountingSimpleInternal: token transfer failed to contract."
      );
    });

    it("Verify proposal execution should be reverted when unlocking the god token", async function () {
      const { governorText, creator, godHolder, token } = await loadFixture(
        deployFixture
      );
      await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);
      const { proposalId } = await getTextProposalId(governorText, creator);
      await governorText.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(20);

      await token.setTransaferFailed(true);
      await expect(governorText.executeProposal(TITLE)).rejectedWith(
        "GovernorCountingSimpleInternal: token transfer failed from contract."
      );
    });

    it("Verify proposal cancellation should be reverted if requested by non-creator user", async function () {
      const { governorText, creator, signers } = await loadFixture(
        deployFixture
      );
      await getTextProposalId(governorText, creator);
      await expect(
        governorText.connect(signers[1]).cancelProposal(TITLE)
      ).revertedWith(
        "GovernorCountingSimpleInternal: Only proposer can cancel the proposal"
      );
    });

    it("Verify proposal details call should return data for valid proposal id", async function () {
      const { governorText, creator, godHolder } = await loadFixture(
        deployFixture
      );
      await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);

      const { proposalId } = await getTextProposalId(governorText, creator);
      const result = await governorText.callStatic.getProposalDetails(
        proposalId
      );

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

      const result1 = await governorText.callStatic.getProposalDetails(
        proposalId
      );

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
        "GovernorCountingSimpleInternal: GOD token total supply multiple by quorum threshold in BSP cannot be less than 10,000"
      );
    });
  });

  describe("TextGovernor contract tests", async () => {
    it("Verify text proposal should be executed", async function () {
      const { governorText, creator, godHolder } = await loadFixture(
        deployFixture
      );
      await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);
      const { proposalId } = await getTextProposalId(governorText, creator);
      await governorText.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(20);
      await governorText.executeProposal(TITLE);
    });
  });

  describe("TokenCreateGovernor contract tests", async () => {
    it("Verify token creation should be executed", async function () {
      const { governorToken, creator, godHolder } = await loadFixture(
        deployFixture
      );
      await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);
      const { proposalId } = await getTokenCreateProposalId(
        governorToken,
        "tokenName",
        creator
      );
      await governorToken.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);
      await expect(governorToken.getTokenAddress(proposalId)).revertedWith(
        "Contract not executed yet!"
      );
      await governorToken.executeProposal(TITLE);
      expect(await governorToken.getTokenAddress(proposalId)).not.equals(
        TestHelper.ZERO_ADDRESS
      );
    });

    it("Verify token creation proposal should be failed during execution", async function () {
      const { governorToken, baseHTS, creator, godHolder } = await loadFixture(
        deployFixture
      );
      await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);
      const { proposalId } = await getTokenCreateProposalId(
        governorToken,
        "FAIL",
        creator
      );
      await governorToken.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);
      await baseHTS.setPassTransactionCount(0); // 0 pass transaction
      await baseHTS.setRevertCreateToken(true);
      await expect(governorToken.executeProposal(TITLE)).to.revertedWith(
        "GovernorTokenCreate: Token creation failed."
      );
      await baseHTS.setRevertCreateToken(false);
      await expect(governorToken.executeProposal(TITLE)).to.revertedWith(
        "GovernorTokenCreate: Token creation failed."
      );
    });

    describe("Minting scenarios ", async function () {
      it("Given user executed token create proposal when user try to mint only treasurer is allowed", async function () {
        const { governorToken, creator, godHolder } = await loadFixture(
          deployFixture
        );
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator
        );
        const qtyToMint = 1;
        const newTokenSupply = await governorToken
          .connect(creator)
          .callStatic.mintToken(proposalId, qtyToMint);
        expect(newTokenSupply).equals(qtyToMint);
      });

      it("Given user not executed token create proposal when treasurer try to mint then minting should fail", async function () {
        const { governorToken, creator, godHolder } = await loadFixture(
          deployFixture
        );
        await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);
        const { proposalId } = await getTokenCreateProposalId(
          governorToken,
          "tokenName",
          creator
        );
        await governorToken.castVotePublic(proposalId, 0, 1);
        await TestHelper.mineNBlocks(BLOCKS_COUNT);
        const qtyToMint = 1;
        await expect(
          governorToken
            .connect(creator)
            .callStatic.mintToken(proposalId, qtyToMint)
        ).revertedWith(
          "GovernorTokenCreate: Mint not allowed as token doesn't exist for this proposal."
        );
      });

      it("Given user executed token create proposal when minting fails from HTS then minting operation call should fail", async function () {
        const { governorToken, creator, godHolder } = await loadFixture(
          deployFixture
        );
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator
        );
        const tokenAddress = await governorToken.getTokenAddress(proposalId);
        const tokenContract = await ethers.getContractAt(
          "ERC20Mock",
          tokenAddress
        );
        await tokenContract.setName("FAIL");
        const qtyToMint = 1;
        await expect(
          governorToken
            .connect(creator)
            .callStatic.mintToken(proposalId, qtyToMint)
        ).revertedWith("GovernorTokenCreate: Minting token failed");
      });

      it("Given user executed token create proposal when non-treasurer user try to mint then minting should fail", async function () {
        const { governorToken, creator, godHolder, signers } =
          await loadFixture(deployFixture);
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator
        );
        const qtyToMint = 1;
        const nonOwnerSigner = signers[3];
        await expect(
          governorToken
            .connect(nonOwnerSigner)
            .callStatic.mintToken(proposalId, qtyToMint)
        ).revertedWith("GovernorTokenCreate: Only treasurer can mint tokens.");
      });
    });

    describe("Burning scenarios ", async function () {
      it("Given user executed token create proposal when user try to burn only treasurer is allowed", async function () {
        const { governorToken, creator, godHolder } = await loadFixture(
          deployFixture
        );
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator
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
        const { governorToken, creator, godHolder } = await loadFixture(
          deployFixture
        );
        await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);
        const { proposalId } = await getTokenCreateProposalId(
          governorToken,
          "tokenName",
          creator
        );
        await governorToken.castVotePublic(proposalId, 0, 1);
        await TestHelper.mineNBlocks(BLOCKS_COUNT);
        const qtyToBurn = 1;
        await expect(
          governorToken
            .connect(creator)
            .callStatic.burnToken(proposalId, qtyToBurn)
        ).revertedWith(
          "GovernorTokenCreate: Burn not allowed as token doesn't exist for this proposal."
        );
      });

      it("Given user executed token create proposal when burning fails from HTS then minting operation call should fail", async function () {
        const { governorToken, creator, godHolder } = await loadFixture(
          deployFixture
        );
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator
        );
        const tokenAddress = await governorToken.getTokenAddress(proposalId);
        const tokenContract = await ethers.getContractAt(
          "ERC20Mock",
          tokenAddress
        );
        await tokenContract.setName("FAIL");
        const qtyToBurn = 1;
        await expect(
          governorToken
            .connect(creator)
            .callStatic.burnToken(proposalId, qtyToBurn)
        ).revertedWith("GovernorTokenCreate: Burn token failed");
      });

      it("Given user executed token create proposal when non-treasurer user try to burn then burning should fail", async function () {
        const { governorToken, creator, godHolder, signers } =
          await loadFixture(deployFixture);
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator
        );
        const qtyToBurn = 1;
        const nonOwnerSigner = signers[3];
        await expect(
          governorToken
            .connect(nonOwnerSigner)
            .callStatic.burnToken(proposalId, qtyToBurn)
        ).revertedWith("GovernorTokenCreate: Only treasurer can burn tokens.");
      });
    });

    describe("Transfer scenarios", async () => {
      it("Given user executed token create proposal when user try to transfer zero or less than zero token then transfer should fail", async function () {
        const { governorToken, creator, godHolder, signers } =
          await loadFixture(deployFixture);
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator
        );
        const qtyToTransfer = 0;

        await expect(
          governorToken
            .connect(creator)
            .transferToken(proposalId, signers[1].address, qtyToTransfer)
        ).revertedWith(
          "GovernorTokenCreate: Token quantity to transfer should be greater than zero."
        );
      });

      it("Given user executed token create proposal when user try to transfer only treasurer is allowed", async function () {
        const { governorToken, creator, godHolder, signers } =
          await loadFixture(deployFixture);
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator
        );
        const newToken = await governorToken.getTokenAddress(proposalId);
        const qtyToTransfer = 2;
        const token = await ethers.getContractAt("ERC20Mock", newToken);
        await token.setUserBalance(governorToken.address, qtyToTransfer);
        expect(await token.balanceOf(governorToken.address)).equals(
          qtyToTransfer
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
          creator
        );
        const newToken = await governorToken.getTokenAddress(proposalId);
        const qtyToTransfer = 2;
        const token = await ethers.getContractAt("ERC20Mock", newToken);
        const contractBalanceLessThanQtyToTransfer = qtyToTransfer - 1;
        await token.setUserBalance(
          governorToken.address,
          contractBalanceLessThanQtyToTransfer
        );
        expect(await token.balanceOf(governorToken.address)).equals(
          contractBalanceLessThanQtyToTransfer
        );
        await expect(
          governorToken
            .connect(creator)
            .transferToken(proposalId, signers[1].address, qtyToTransfer)
        ).revertedWith(
          "GovernorTokenCreate: Contract doesn't have sufficient balance please take treasurer help to mint it."
        );
      });

      it("Given user executed token create proposal when user try to transfer only treasurer is allowed", async function () {
        const { governorToken, creator, godHolder, signers } =
          await loadFixture(deployFixture);
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator
        );
        const newToken = await governorToken.getTokenAddress(proposalId);
        const qtyToTransfer = 2;
        const token = await ethers.getContractAt("ERC20Mock", newToken);
        await token.setUserBalance(governorToken.address, qtyToTransfer);
        expect(await token.balanceOf(governorToken.address)).equals(
          qtyToTransfer
        );
        await token.setTransaferFailed(true);
        await expect(
          governorToken
            .connect(creator)
            .transferToken(proposalId, signers[1].address, qtyToTransfer)
        ).revertedWith("GovernorTokenCreate: Token transfer failed.");
      });

      it("Given user executed token create proposal when non-treasurer try to transfer then transfer should fail", async function () {
        const { governorToken, creator, godHolder, signers } =
          await loadFixture(deployFixture);
        const proposalId = createTokenCreateProposalAndExecute(
          godHolder,
          governorToken,
          creator
        );
        const nonTreasurer = signers[3];
        const qtyToTransfer = 2;
        await expect(
          governorToken
            .connect(nonTreasurer)
            .transferToken(proposalId, signers[1].address, qtyToTransfer)
        ).revertedWith(
          "GovernorTokenCreate: Only treasurer can transfer tokens."
        );
      });

      it("Given user not executed token create proposal when treasurer try to transfer then transfer should fail", async function () {
        const { governorToken, creator, godHolder, signers } =
          await loadFixture(deployFixture);
        await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);
        const { proposalId } = await getTokenCreateProposalId(
          governorToken,
          "tokenName",
          creator
        );
        await governorToken.castVotePublic(proposalId, 0, 1);
        await TestHelper.mineNBlocks(BLOCKS_COUNT);
        const qtyToTransfer = 2;
        await expect(
          governorToken
            .connect(creator)
            .transferToken(proposalId, signers[1].address, qtyToTransfer)
        ).revertedWith(
          "GovernorTokenCreate: Token transfer not allowed as token doesn't exist for this proposal."
        );
      });
    });

    it("Verify proposal is executed before minting and burning", async function () {
      const { governorToken, creator, godHolder, signers } = await loadFixture(
        deployFixture
      );
      await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);
      const { proposalId } = await getTokenCreateProposalId(
        governorToken,
        "tokenName",
        creator
      );
      await governorToken.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);
      await expect(governorToken.getTokenAddress(proposalId)).revertedWith(
        "Contract not executed yet!"
      );

      await expect(
        governorToken.connect(creator).callStatic.mintToken(proposalId, 2)
      ).revertedWith(
        "GovernorTokenCreate: Mint not allowed as token doesn't exist for this proposal."
      );

      await expect(
        governorToken.connect(creator).callStatic.burnToken(proposalId, 1)
      ).revertedWith(
        "GovernorTokenCreate: Burn not allowed as token doesn't exist for this proposal."
      );
    });

    it("Verify contract should return a correct token address", async function () {
      const { governorText, token } = await loadFixture(deployFixture);
      const tokenAddress = await governorText.getGODTokenAddress();
      expect(token.address).equals(tokenAddress);
    });

    it("Verify contract should initialize quorum threshold value with 500 when user passed 0 as threshold", async function () {
      const { godHolder, baseHTS, token } = await loadFixture(deployFixture);
      const ARGS = [
        token.address,
        VOTING_DELAY,
        VOTING_PERIOD,
        baseHTS.address,
        godHolder.address,
        0,
      ];
      const governorText = await TestHelper.deployLogic("GovernorTextProposal");
      await governorText.initialize(...ARGS);
      const result = await governorText.quorum(0);
      expect(result).equals(TestHelper.toPrecision(QUORUM_THRESHOLD));
    });
  });

  describe("GovernorUpgrade contract tests", async () => {
    it("Verify upgrade proposal should be executed", async function () {
      const { governorUpgrade, creator, godHolder } = await loadFixture(
        deployFixture
      );
      await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);
      const { proposalId } = await getUpgradeProposalId(
        governorUpgrade,
        creator
      );
      await governorUpgrade.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);
      await governorUpgrade.executeProposal(TITLE);
      const addresses = await governorUpgrade.getContractAddresses(proposalId);
      expect(addresses.length).equals(2);
      expect(addresses[0]).equals(TestHelper.ONE_ADDRESS);
      expect(addresses[1]).equals(TestHelper.TWO_ADDRESS);
    });

    it("Verify upgrade proposal should be reverted if user tried to access contract addresses without proposal execution", async function () {
      const { governorUpgrade, creator } = await loadFixture(deployFixture);
      const { proposalId } = await getUpgradeProposalId(
        governorUpgrade,
        creator
      );
      await expect(
        governorUpgrade.getContractAddresses(proposalId)
      ).revertedWith("Contract not executed yet!");
    });
  });

  describe("GovernorTransferToken contract tests", async () => {
    it("Verify transfer token proposal should be executed", async function () {
      const TOKEN_COUNT = TestHelper.toPrecision(3);
      const { governorTT, token, signers, creator, godHolder } =
        await loadFixture(deployFixture);

      await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);

      const { proposalId } = await getTransferTokenProposalId(
        governorTT,
        signers,
        token.address,
        TOKEN_COUNT
      );
      await governorTT.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);
      await verifyAccountBalance(token, signers[1].address, THIRTY_PERCENT);
      await verifyAccountBalance(token, signers[2].address, FIFTY_PERCENT);
      await governorTT.executeProposal(TITLE);
      await verifyAccountBalance(
        token,
        signers[1].address,
        THIRTY_PERCENT - TOKEN_COUNT
      );
      await verifyAccountBalance(
        token,
        signers[2].address,
        FIFTY_PERCENT + TOKEN_COUNT
      );
    });

    it("Verify transfer token proposal should be failed during execution", async function () {
      const { governorTT, godHolder, token, signers, creator } =
        await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(creator.address, LOCKED_TOKEN);

      const TOKEN_COUNT = TestHelper.toPrecision(3);
      const { proposalId } = await getTransferTokenProposalId(
        governorTT,
        signers,
        token.address,
        TOKEN_COUNT
      );

      await governorTT.castVotePublic(proposalId, 0, 1);
      await TestHelper.mineNBlocks(BLOCKS_COUNT);
      await token.setTransaferFailed(true);
      await expect(governorTT.executeProposal(TITLE)).revertedWith(
        "GovernorTransferToken: transfer token failed."
      );
    });
  });
});
