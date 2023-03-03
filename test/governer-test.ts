// Commenting test as contract has dependency on HTS service which we need to mock somehow.
import { expect } from "chai";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import { ERC20Mock } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Governor Tests", function () {
  const defaultQuorumThresholdValue = 5;
  const defaultQuorumThresholdValueInBsp = defaultQuorumThresholdValue * 100;
  const zeroAddress = "0x1111111000000000000000000000000000000000";
  const oneAddress = "0x1111111000000000000000000000000000000001";
  const precision = 100000000;
  const total = 100 * precision;
  const twentyPercent = total * 0.2;
  const thirtyPercent = total * 0.3;
  const fiftyPercent = total * 0.5;
  const desc = "Test";
  const title = "Title";
  const link = "Link";

  describe("GovernorCountingSimpleInternal Upgradeable", function () {
    it("Verify if the Governor contract is upgradeable safe ", async function () {
      const votingDelay = 0;
      const votingPeriod = 12;
      const Governor = await ethers.getContractFactory("GovernorTokenCreate");
      const args = [
        zeroAddress,
        votingDelay,
        votingPeriod,
        zeroAddress,
        zeroAddress,
        defaultQuorumThresholdValueInBsp,
      ];
      const instance = await upgrades.deployProxy(Governor, args);
      await instance.deployed();
    });

    it("Verify if the GovernorTextProposal contract is upgradeable safe ", async function () {
      const votingDelay = 0;
      const votingPeriod = 12;
      const Governor = await ethers.getContractFactory("GovernorTextProposal");
      const args = [
        zeroAddress,
        votingDelay,
        votingPeriod,
        zeroAddress,
        zeroAddress,
        defaultQuorumThresholdValueInBsp,
      ];
      const instance = await upgrades.deployProxy(Governor, args);
      await instance.deployed();
    });
  });

  async function deployFixture() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(true, zeroAddress);
    return basicDeployments(mockBaseHTS);
  }

  async function basicDeployments(mockBaseHTS: any) {
    const signers = await ethers.getSigners();
    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(
      "tokenName",
      "tokenSymbol",
      total,
      0
    );
    await tokenCont.setUserBalance(signers[0].address, twentyPercent);
    await tokenCont.setUserBalance(signers[1].address, thirtyPercent);
    await tokenCont.setUserBalance(signers[2].address, fiftyPercent);
    const votingDelay = 0;
    const votingPeriod = 12;

    const GODHolder = await ethers.getContractFactory("GODHolder");
    const godHolder = await upgrades.deployProxy(GODHolder, [
      mockBaseHTS.address,
      tokenCont.address,
    ]);

    const Governor = await ethers.getContractFactory("GovernorTokenCreate");
    const args = [
      tokenCont.address,
      votingDelay,
      votingPeriod,
      mockBaseHTS.address,
      godHolder.address,
      defaultQuorumThresholdValueInBsp,
    ];
    const instance = await upgrades.deployProxy(Governor, args);

    await instance.deployed();

    const TextGovernor = await ethers.getContractFactory(
      "GovernorTextProposal"
    );
    const textGovernorInstance = await upgrades.deployProxy(TextGovernor, args);
    await textGovernorInstance.deployed();

    const GovernorUpgrade = await ethers.getContractFactory("GovernorUpgrade");
    const governorUpgradeInstance = await upgrades.deployProxy(
      GovernorUpgrade,
      args
    );
    await textGovernorInstance.deployed();

    const GovernorTransferToken = await ethers.getContractFactory(
      "GovernorTransferToken"
    );
    const governorTransferTokenInstance = await upgrades.deployProxy(
      GovernorTransferToken,
      args
    );
    await governorTransferTokenInstance.deployed();
    return {
      instance,
      textGovernorInstance,
      governorUpgradeInstance,
      governorTransferTokenInstance,
      tokenCont,
      mockBaseHTS,
      signers,
      godHolder,
    };
  }

  async function mineNBlocks(n: number) {
    for (let index = 0; index < n; index++) {
      await ethers.provider.send("evm_mine", []);
    }
  }

  describe("Quorum tests", async () => {
    it("Verify default quorum threshold for governance contract", async function () {
      const { instance, tokenCont } = await loadFixture(deployFixture);

      const updatedTotal = await tokenCont.totalSupply();
      expect(updatedTotal).to.be.equals(total);
      const result = await instance.quorum(123);
      expect(result).to.be.equals(defaultQuorumThresholdValue * precision);
    });

    it("When total supply of the GOD token is increased then its quorum threshold should also increased.", async function () {
      const { instance, tokenCont } = await loadFixture(deployFixture);
      const newTotal = total * 2;
      await tokenCont.setTotal(newTotal);
      const updatedTotal = await tokenCont.totalSupply();
      expect(updatedTotal).to.be.equals(newTotal);
      const result = await instance.quorum(123);
      const correctQuorumNumber =
        (defaultQuorumThresholdValue / 100) * newTotal;
      expect(result).to.be.equals(correctQuorumNumber.toFixed(0));
    });

    it("When default(5%) quorum threshold results in zero quorum threshold value then quorum call should fail. ", async function () {
      const { instance, tokenCont } = await loadFixture(deployFixture);
      const newTotal = 19;
      await tokenCont.setTotal(newTotal);
      const updatedTotal = await tokenCont.totalSupply();
      expect(updatedTotal).to.be.equals(newTotal);
      const correctQuorumNumber =
        (defaultQuorumThresholdValue / 100) * newTotal;
      expect(Math.floor(correctQuorumNumber)).to.be.equals(0);
      await expect(instance.quorum(123)).revertedWith(
        "GOD token total supply multiple by quorum threshold in BSP cannot be less than 10,000"
      );
    });
  });

  describe("Governor functionality", async () => {
    it("When user has 20 units of token then votes weight should be 20", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      await tokenCont.setTotal(100);
      await tokenCont.setUserBalance(signers[0].address, 20);
      const votes = await instance
        .connect(signers[0])
        .getVotes(signers[0].address, 1);
      expect(votes).to.be.equals(20);
    });

    it("When user has 30 units of token then votes weight should be 30", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      await tokenCont.setTotal(100);
      await tokenCont.setUserBalance(signers[1].address, 30);
      const votes = await instance.getVotes(signers[1].address, 1);
      expect(votes).to.be.equals(30);
    });

    it("Token Create Fail", async function () {
      const { instance, mockBaseHTS, signers } = await loadFixture(
        deployFixture
      );
      const proposalIdResponse = await createProposal(instance, signers[0]);
      const record = await proposalIdResponse.wait();
      const proposalId = record.events[0].args.proposalId.toString();
      await mineNBlocks(10);
      await instance.castVote(proposalId, 1);
      await mineNBlocks(20);
      await mockBaseHTS.setPassTransactionCount(0); // 0 pass transaction
      await mockBaseHTS.setRevertCreateToken(true);
      await expect(instance.executeProposal(title)).to.revertedWith(
        "GovernorTokenCreate: Token creation failed."
      );
      await mockBaseHTS.setRevertCreateToken(false);
      await expect(instance.executeProposal(title)).to.revertedWith(
        "GovernorTokenCreate: Token creation failed."
      );
    });

    it("Verify proposal creation to cancel flow ", async function () {
      const { instance, tokenCont, signers, godHolder } = await loadFixture(
        deployFixture
      );
      await verifyAccountBalance(tokenCont, signers[0].address, total * 0.2);
      const proposalPublic = await createProposal(instance, signers[0]);
      await verifyAccountBalance(
        tokenCont,
        signers[0].address,
        twentyPercent - 1 * precision
      );

      const record = await proposalPublic.wait();
      const proposalId = record.events[0].args.proposalId.toString();

      const delay = await instance.votingDelay();
      expect(delay).to.be.equals(0);
      const period = await instance.votingPeriod();
      expect(period).to.be.equals(12);
      const threshold = await instance.proposalThreshold();
      expect(threshold).to.be.equals(0);
      await verifyProposalVotes(instance, proposalId, {
        abstainVotes: 0,
        againstVotes: 0,
        forVotes: 0,
      });
      const quorumReached = await instance.quorumReached(proposalId);
      expect(quorumReached).to.be.equals(false);
      const voteSucceeded = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded).to.be.equals(false);

      await instance.castVote(proposalId, 1);
      const voteSucceeded1 = await instance.voteSucceeded(proposalId);
      await verifyProposalVotes(instance, proposalId, {
        abstainVotes: 0,
        againstVotes: 0,
        forVotes: twentyPercent - 1 * precision,
      });
      expect(voteSucceeded1).to.be.equals(true);
      const quorumReached1 = await instance.quorumReached(proposalId);
      expect(quorumReached1).to.be.equals(true);

      expect(quorumReached1).to.be.equals(true);
      const activeProposals =
        await godHolder.callStatic.getActiveProposalsForUser();
      expect(activeProposals.length).to.be.equals(1);
      const canWithdrawGod = await godHolder.callStatic.canUserClaimGodTokens();
      expect(canWithdrawGod).to.be.equals(false);

      await expect(godHolder.revertTokensForVoter()).to.revertedWith(
        "User's Proposals are active"
      );

      await mineNBlocks(20);
      const state = await instance.state(proposalId);
      expect(state).to.be.equals(4);

      await instance.cancelProposal(title);
      await verifyAccountBalance(tokenCont, signers[0].address, 1 * precision);
      const canWithdrawGod1 =
        await godHolder.callStatic.canUserClaimGodTokens();
      expect(canWithdrawGod1).to.be.equals(true);
      await godHolder.revertTokensForVoter();
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
    });

    it("Verify proposal creation to execute flow ", async function () {
      const { instance, tokenCont, signers, godHolder } = await loadFixture(
        deployFixture
      );

      await verifyAccountBalance(tokenCont, signers[0].address, total * 0.2);
      const proposalIdResponse = await createProposal(instance, signers[0]);
      await verifyAccountBalance(
        tokenCont,
        signers[0].address,
        twentyPercent - 1 * precision
      );

      const record = await proposalIdResponse.wait();
      const proposalId = record.events[0].args.proposalId.toString();

      const delay = await instance.votingDelay();
      expect(delay).to.be.equals(0);
      const period = await instance.votingPeriod();
      expect(period).to.be.equals(12);
      const threshold = await instance.proposalThreshold();
      expect(threshold).to.be.equals(0);
      const quorumReached = await instance.quorumReached(proposalId);
      expect(quorumReached).to.be.equals(false);
      const voteSucceeded = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded).to.be.equals(false);

      await instance.castVote(proposalId, 1);
      const voteSucceeded1 = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded1).to.be.equals(true);
      const quorumReached1 = await instance.quorumReached(proposalId);
      expect(quorumReached1).to.be.equals(true);
      await verifyProposalVotes(instance, proposalId, {
        abstainVotes: 0,
        againstVotes: 0,
        forVotes: twentyPercent - 1 * precision,
      });
      expect(quorumReached1).to.be.equals(true);
      const activeProposals =
        await godHolder.callStatic.getActiveProposalsForUser();
      expect(activeProposals.length).to.be.equals(1);
      const canWithdrawGod = await godHolder.callStatic.canUserClaimGodTokens();
      expect(canWithdrawGod).to.be.equals(false);

      await mineNBlocks(20);
      const state = await instance.state(proposalId);
      expect(state).to.be.equals(4);
      await expect(instance.getTokenAddress(proposalId)).to.revertedWith(
        "Contract not executed yet!"
      );

      await instance.executeProposal(title);
      await verifyAccountBalance(tokenCont, signers[0].address, 1 * precision);
      const canWithdrawGod1 =
        await godHolder.callStatic.canUserClaimGodTokens();
      expect(canWithdrawGod1).to.be.equals(true);
      await godHolder.revertTokensForVoter();
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
      const tokenAddress = await instance.getTokenAddress(proposalId);
      expect(tokenAddress).to.not.be.equals(zeroAddress);
    });

    it("When proposal created and user voted against then quorum should be reached ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);

      await verifyAccountBalance(tokenCont, signers[0].address, total * 0.2);
      const proposalIdResponse = await createProposal(instance, signers[0]);
      await verifyAccountBalance(
        tokenCont,
        signers[0].address,
        twentyPercent - 1 * precision
      );

      const record = await proposalIdResponse.wait();
      const proposalId = record.events[0].args.proposalId.toString();

      const delay = await instance.votingDelay();
      expect(delay).to.be.equals(0);
      const period = await instance.votingPeriod();
      expect(period).to.be.equals(12);
      const threshold = await instance.proposalThreshold();
      expect(threshold).to.be.equals(0);
      const quorumReached = await instance.quorumReached(proposalId);
      expect(quorumReached).to.be.equals(false);
      const voteSucceeded = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded).to.be.equals(false);

      await instance.castVote(proposalId, 2);

      const quorumReached1 = await instance.quorumReached(proposalId);
      expect(quorumReached1).to.be.equals(true);
    });

    it("When proposal created and user voted for with vote share less than 5 then quorum should not be reached ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);

      await verifyAccountBalance(tokenCont, signers[0].address, total * 0.2);
      const proposalIdResponse = await createProposal(instance, signers[0]);
      await verifyAccountBalance(
        tokenCont,
        signers[0].address,
        twentyPercent - 1 * precision
      );

      const record = await proposalIdResponse.wait();
      const proposalId = record.events[0].args.proposalId.toString();

      const delay = await instance.votingDelay();
      expect(delay).to.be.equals(0);
      const period = await instance.votingPeriod();
      expect(period).to.be.equals(12);
      const threshold = await instance.proposalThreshold();
      expect(threshold).to.be.equals(0);
      const quorumReached = await instance.quorumReached(proposalId);
      expect(quorumReached).to.be.equals(false);
      const voteSucceeded = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded).to.be.equals(false);
      const balanceLessThanRequiredQuorum = defaultQuorumThresholdValue - 1;
      await tokenCont.setUserBalance(
        signers[1].address,
        balanceLessThanRequiredQuorum
      );
      await verifyAccountBalance(
        tokenCont,
        signers[1].address,
        balanceLessThanRequiredQuorum
      );
      await instance.connect(signers[1]).castVote(proposalId, 1);

      const quorumReached1 = await instance.quorumReached(proposalId);
      expect(quorumReached1).to.be.equals(false);
    });

    it("When proposal created and user voted against then votes should not be succeeded ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);

      await verifyAccountBalance(tokenCont, signers[0].address, total * 0.2);
      const proposalIdResponse = await createProposal(instance, signers[0]);
      await verifyAccountBalance(
        tokenCont,
        signers[0].address,
        twentyPercent - 1 * precision
      );

      const record = await proposalIdResponse.wait();
      const proposalId = record.events[0].args.proposalId.toString();

      const delay = await instance.votingDelay();
      expect(delay).to.be.equals(0);
      const period = await instance.votingPeriod();
      expect(period).to.be.equals(12);
      const threshold = await instance.proposalThreshold();
      expect(threshold).to.be.equals(0);
      const quorumReached = await instance.quorumReached(proposalId);
      expect(quorumReached).to.be.equals(false);
      const voteSucceeded = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded).to.be.equals(false);

      await instance.castVote(proposalId, 2);

      const voteSucceeded1 = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded1).to.be.equals(false);
    });

    it("When proposal created and user opted abstain then quorum should not be reached ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);

      await verifyAccountBalance(tokenCont, signers[0].address, total * 0.2);
      const proposalIdResponse = await createProposal(instance, signers[0]);
      await verifyAccountBalance(
        tokenCont,
        signers[0].address,
        twentyPercent - 1 * precision
      );

      const record = await proposalIdResponse.wait();
      const proposalId = record.events[0].args.proposalId.toString();

      const delay = await instance.votingDelay();
      expect(delay).to.be.equals(0);
      const period = await instance.votingPeriod();
      expect(period).to.be.equals(12);
      const threshold = await instance.proposalThreshold();
      expect(threshold).to.be.equals(0);
      const quorumReached = await instance.quorumReached(proposalId);
      expect(quorumReached).to.be.equals(false);
      const voteSucceeded = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded).to.be.equals(false);

      await instance.castVote(proposalId, 0); //Against vote does reach quorum
      const quorumReached1 = await instance.quorumReached(proposalId);
      expect(quorumReached1).to.be.equals(false);
    });

    it("When proposal created and user opted abstain then vote should not be succeeded ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);

      await verifyAccountBalance(tokenCont, signers[0].address, total * 0.2);
      const proposalIdResponse = await createProposal(instance, signers[0]);
      await verifyAccountBalance(
        tokenCont,
        signers[0].address,
        twentyPercent - 1 * precision
      );

      const record = await proposalIdResponse.wait();
      const proposalId = record.events[0].args.proposalId.toString();

      const delay = await instance.votingDelay();
      expect(delay).to.be.equals(0);
      const period = await instance.votingPeriod();
      expect(period).to.be.equals(12);
      const threshold = await instance.proposalThreshold();
      expect(threshold).to.be.equals(0);
      const quorumReached = await instance.quorumReached(proposalId);
      expect(quorumReached).to.be.equals(false);
      const voteSucceeded = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded).to.be.equals(false);

      await instance.castVote(proposalId, 0);

      const voteSucceeded1 = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded1).to.be.equals(false);
    });

    it("Verify TextProposal creation to Execute flow ", async function () {
      const { textGovernorInstance, tokenCont, signers, godHolder } =
        await loadFixture(deployFixture);
      await verifyAccountBalance(tokenCont, signers[0].address, total * 0.2);
      const proposalPublic = await createProposalForText(
        textGovernorInstance,
        signers[0]
      );
      await verifyAccountBalance(
        tokenCont,
        signers[0].address,
        twentyPercent - 1 * precision
      );

      const record = await proposalPublic.wait();
      const proposalId = record.events[0].args.proposalId.toString();

      const delay = await textGovernorInstance.votingDelay();
      expect(delay).to.be.equals(0);
      const period = await textGovernorInstance.votingPeriod();
      expect(period).to.be.equals(12);
      const threshold = await textGovernorInstance.proposalThreshold();
      expect(threshold).to.be.equals(0);
      const quorumReached = await textGovernorInstance.quorumReached(
        proposalId
      );
      expect(quorumReached).to.be.equals(false);
      const voteSucceeded = await textGovernorInstance.voteSucceeded(
        proposalId
      );
      expect(voteSucceeded).to.be.equals(false);

      await textGovernorInstance.castVote(proposalId, 1);
      const voteSucceeded1 = await textGovernorInstance.voteSucceeded(
        proposalId
      );
      expect(voteSucceeded1).to.be.equals(true);
      const quorumReached1 = await textGovernorInstance.quorumReached(
        proposalId
      );
      expect(quorumReached1).to.be.equals(true);
      const activeProposals =
        await godHolder.callStatic.getActiveProposalsForUser();
      expect(activeProposals.length).to.be.equals(1);
      const canWithdrawGod = await godHolder.callStatic.canUserClaimGodTokens();
      expect(canWithdrawGod).to.be.equals(false);

      await mineNBlocks(20);
      const state = await textGovernorInstance.state(proposalId);
      expect(state).to.be.equals(4);

      await textGovernorInstance.executeProposal(title);
      await verifyAccountBalance(tokenCont, signers[0].address, 1 * precision);
      const canWithdrawGod1 =
        await godHolder.callStatic.canUserClaimGodTokens();
      expect(canWithdrawGod1).to.be.equals(true);
      await godHolder.revertTokensForVoter();
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
    });

    it("Verify GovernorUpgrade contract proposal creation to execute flow ", async function () {
      const { governorUpgradeInstance, signers } = await loadFixture(
        deployFixture
      );
      const proposalId = await getUpgradeProposalId(
        governorUpgradeInstance,
        signers[0]
      );

      await governorUpgradeInstance.castVote(proposalId, 1);

      const voteSucceeded = await governorUpgradeInstance.voteSucceeded(
        proposalId
      );
      expect(voteSucceeded).to.be.equals(true);

      const quorumReached1 = await governorUpgradeInstance.quorumReached(
        proposalId
      );
      expect(quorumReached1).to.be.equals(true);

      await mineNBlocks(20);

      const state = await governorUpgradeInstance.state(proposalId);
      expect(state).to.be.equals(4);

      await governorUpgradeInstance.executeProposal(title);

      const addresses = await governorUpgradeInstance.getContractAddresses(
        proposalId
      );
      expect(addresses.length).to.be.equals(2);
      expect(addresses[0]).to.be.equals(zeroAddress);
      expect(addresses[1]).to.be.equals(oneAddress);
    });

    it("Verify GovernorUpgrade contract proposal not executed flow ", async function () {
      const { governorUpgradeInstance, signers } = await loadFixture(
        deployFixture
      );
      const proposalId = await getUpgradeProposalId(
        governorUpgradeInstance,
        signers[0]
      );
      await expect(
        governorUpgradeInstance.getContractAddresses(proposalId)
      ).to.revertedWith("Contract not executed yet!");
    });

    it("Verify contract proposal creation failed for getGODToken invocation", async function () {
      const { governorUpgradeInstance, signers, mockBaseHTS } =
        await loadFixture(deployFixture);

      await mockBaseHTS.setPassTransactionCount(1);

      await expect(
        getUpgradeProposalId(governorUpgradeInstance, signers[0])
      ).to.revertedWith(
        "GovernorCountingSimpleInternal: token transfer failed to contract."
      );
    });

    it("Verify GovernorUpgrade initialize should be failed for initialize called after instance created", async function () {
      const { governorUpgradeInstance } = await loadFixture(deployFixture);
      await expect(
        governorUpgradeInstance.initialize(
          zeroAddress,
          0,
          10,
          zeroAddress,
          zeroAddress,
          defaultQuorumThresholdValueInBsp
        )
      ).to.revertedWith("Initializable: contract is already initialized");
    });

    it("Verify cancel proposal flow when proposal not found", async function () {
      const { governorUpgradeInstance, signers } = await loadFixture(
        deployFixture
      );
      await getUpgradeProposalId(governorUpgradeInstance, signers[0]);
      await expect(
        governorUpgradeInstance.cancelProposal("not-found")
      ).to.revertedWith("Proposal not found");
    });

    it("Verify cancel proposal flow when request send by different user", async function () {
      const { governorUpgradeInstance, signers } = await loadFixture(
        deployFixture
      );
      await getUpgradeProposalId(governorUpgradeInstance, signers[0]);
      await expect(
        governorUpgradeInstance.connect(signers[1]).cancelProposal(title)
      ).to.revertedWith("Only proposer can cancel the proposal");
    });

    it.only("Check getProposalDetails function", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      await verifyAccountBalance(tokenCont, signers[0].address, total * 0.2);
      const proposalIdResponse = await createProposal(instance, signers[0]);
      await verifyAccountBalance(
        tokenCont,
        signers[0].address,
        twentyPercent - 1 * precision
      );

      const record = await proposalIdResponse.wait();
      const proposalId = record.events[0].args.proposalId.toString();
      console.log(proposalId);
      const result = await instance.callStatic.getProposalDetails(proposalId);

      expect(result[0]).to.be.equals(500000000);
      expect(result[1]).to.be.equals(false);
      expect(result[2]).to.be.equals(0);
      expect(result[3]).to.be.equals(false);
      expect(result[4]).to.be.equals(0);
      expect(result[5]).to.be.equals(0);
      expect(result[6]).to.be.equals(0);
      expect(result[7]).to.be.equals(signers[0].address);
      expect(result[8]).to.be.equals(title);
      expect(result[9]).to.be.equals(desc);
      expect(result[10]).to.be.equals(link);
      await instance.castVote(proposalId, 1);

      const result1 = await instance.callStatic.getProposalDetails(proposalId);

      expect(result1[0]).to.be.equals(500000000);
      expect(result1[1]).to.be.equals(true);
      expect(result1[2]).to.be.equals(1);
      expect(result1[3]).to.be.equals(true);
      expect(result1[4]).to.be.equals(0);
      expect(result1[5]).to.be.equals(1900000000);
      expect(result1[6]).to.be.equals(0);
      expect(result1[7]).to.be.equals(signers[0].address);
      expect(result1[8]).to.be.equals(title);
      expect(result1[9]).to.be.equals(desc);
      expect(result1[10]).to.be.equals(link);
    });

    it("Verify GovernorTransferToken should reverted for invalid propsal id", async function () {
      const { governorTransferTokenInstance } = await loadFixture(
        deployFixture
      );
      await expect(
        governorTransferTokenInstance.getProposalDetails(1)
      ).to.revertedWith("Proposal not found");
    });

    it("Verify GovernorTransferToken contract proposal creation to execute flow ", async function () {
      const { governorTransferTokenInstance, tokenCont, signers } =
        await loadFixture(deployFixture);
      const proposalId = await getTransferTokenProposalId(
        governorTransferTokenInstance,
        signers,
        tokenCont.address,
        5
      );
      await governorTransferTokenInstance.castVote(proposalId, 1);
      const voteSucceeded = await governorTransferTokenInstance.voteSucceeded(
        proposalId
      );
      expect(voteSucceeded).to.be.equals(true);
      const quorumReached1 = await governorTransferTokenInstance.quorumReached(
        proposalId
      );
      expect(quorumReached1).to.be.equals(true);
      await mineNBlocks(20);
      const state = await governorTransferTokenInstance.state(proposalId);
      expect(state).to.be.equals(4);
      await governorTransferTokenInstance.executeProposal(title);
      await verifyAccountBalance(
        tokenCont,
        signers[1].address,
        thirtyPercent - 5
      );
    });

    it("Verify GovernorTransferToken contract proposal creation to execute flow with failed", async function () {
      const { governorTransferTokenInstance, tokenCont, signers, mockBaseHTS } =
        await loadFixture(deployFixture);
      const proposalId = await getTransferTokenProposalId(
        governorTransferTokenInstance,
        signers,
        tokenCont.address,
        5
      );
      await governorTransferTokenInstance.castVote(proposalId, 1);
      const voteSucceeded = await governorTransferTokenInstance.voteSucceeded(
        proposalId
      );
      expect(voteSucceeded).to.be.equals(true);
      const quorumReached1 = await governorTransferTokenInstance.quorumReached(
        proposalId
      );
      expect(quorumReached1).to.be.equals(true);
      await mineNBlocks(20);
      const state = await governorTransferTokenInstance.state(proposalId);
      expect(state).to.be.equals(4);

      await mockBaseHTS.setPassTransactionCount(1);

      await expect(
        governorTransferTokenInstance.executeProposal(title)
      ).to.revertedWith("GovernorTransferToken: transfer token failed.");
    });

    const createProposal = async (
      instance: Contract,
      account: SignerWithAddress
    ) => {
      const treasurerKey = ethers.utils.toUtf8Bytes("treasurer public key");
      const adminKey = ethers.utils.toUtf8Bytes("Admin public key");
      return await instance
        .connect(account)
        .createProposal(
          title,
          desc,
          link,
          zeroAddress,
          treasurerKey,
          zeroAddress,
          adminKey,
          "Token",
          "Symbol"
        );
    };

    const createProposalForText = async (
      instance: Contract,
      account: SignerWithAddress
    ) => {
      return await instance.connect(account).createProposal(title, desc, link);
    };

    async function getUpgradeProposalId(
      instance: Contract,
      account: SignerWithAddress
    ) {
      const pIdResponse = await instance
        .connect(account)
        .createProposal(title, desc, link, zeroAddress, oneAddress);
      const record = await pIdResponse.wait();
      return record.events[0].args.proposalId.toString();
    }

    async function getTransferTokenProposalId(
      instance: Contract,
      signers: SignerWithAddress[],
      tokenAddress: string,
      amount: number
    ) {
      const pIdResponse = await instance
        .connect(signers[0])
        .createProposal(
          title,
          desc,
          link,
          signers[1].address,
          signers[2].address,
          tokenAddress,
          amount,
          signers[0].address
        );
      const record = await pIdResponse.wait();
      return record.events[0].args.proposalId.toString();
    }

    const verifyProposalVotes = async (
      instance: Contract,
      proposalId: any,
      result: any
    ) => {
      const r = await instance.proposalVotes(proposalId);
      expect(r.abstainVotes, "abstainVotes").to.be.equals(result.abstainVotes);
      expect(r.againstVotes, "againstVotes").to.be.equals(result.againstVotes);
      expect(r.forVotes, "forVotes").to.be.equals(result.forVotes);
    };

    const verifyAccountBalance = async (
      tokenCont: ERC20Mock,
      account: string,
      balance: number
    ) => {
      const userBalance = await tokenCont.balanceOf(account);
      expect(userBalance, "Verify user balance ").to.be.equals(balance);
    };
  });
});
