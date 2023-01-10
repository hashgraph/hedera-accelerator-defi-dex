// Commenting test as contract has dependency on HTS service which we need to mock somehow.
import { expect } from "chai";
import * as fs from "fs";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import { ERC20Mock } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("Governor Tests", function () {
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

  const readFileContent = (filePath: string) => {
    const rawdata: any = fs.readFileSync(filePath);
    return JSON.parse(rawdata);
  };

  const contractJson = readFileContent(
    "./artifacts/contracts/mock/ERC20Mock.sol/ERC20Mock.json"
  );
  const contractInterface = new ethers.utils.Interface(contractJson.abi);

  describe("GovernorCountingSimpleInternal Upgradeable", function () {
    it("Verify if the Governor contract is upgradeable safe ", async function () {
      const votingDelay = 0;
      const votingPeriod = 12;
      const Governor = await ethers.getContractFactory("GovernorTokenCreate");
      const args = [zeroAddress, votingDelay, votingPeriod, zeroAddress];
      const instance = await upgrades.deployProxy(Governor, args);
      await instance.deployed();
    });

    it("Verify if the GovernorTextProposal contract is upgradeable safe ", async function () {
      const votingDelay = 0;
      const votingPeriod = 12;
      const Governor = await ethers.getContractFactory("GovernorTextProposal");
      const args = [zeroAddress, votingDelay, votingPeriod, zeroAddress];
      const instance = await upgrades.deployProxy(Governor, args);
      await instance.deployed();
    });
  });

  async function deployFixture() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(true, zeroAddress);
    const signers = await ethers.getSigners();

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(total, 0);
    await tokenCont.setUserBalance(signers[0].address, twentyPercent);
    await tokenCont.setUserBalance(signers[1].address, thirtyPercent);
    await tokenCont.setUserBalance(signers[2].address, fiftyPercent);
    const votingDelay = 0;
    const votingPeriod = 12;

    const Governor = await ethers.getContractFactory("GovernorTokenCreate");
    console.log(`token Service address ${mockBaseHTS.address}`);
    const args = [
      tokenCont.address,
      votingDelay,
      votingPeriod,
      mockBaseHTS.address,
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
    };
  }

  async function deployFixtureWithFail() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(true, zeroAddress);
    const signers = await ethers.getSigners();

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(total, 0);
    await tokenCont.setUserBalance(signers[0].address, twentyPercent);
    await tokenCont.setUserBalance(signers[1].address, thirtyPercent);
    await tokenCont.setUserBalance(signers[2].address, fiftyPercent);
    const votingDelay = 5;
    const votingPeriod = 12;

    const Governor = await ethers.getContractFactory("GovernorTokenCreate");
    const args = [
      tokenCont.address,
      votingDelay,
      votingPeriod,
      mockBaseHTS.address,
    ];

    const instance = await upgrades.deployProxy(Governor, args);
    await instance.deployed();

    return { instance, tokenCont, mockBaseHTS, signers };
  }

  async function deployFixtureWithDelay() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(true, zeroAddress);
    const signers = await ethers.getSigners();

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(total, 0);
    await tokenCont.setUserBalance(signers[0].address, twentyPercent);
    await tokenCont.setUserBalance(signers[1].address, thirtyPercent);
    await tokenCont.setUserBalance(signers[2].address, fiftyPercent);
    const votingDelay = 5;
    const votingPeriod = 12;

    const Governor = await ethers.getContractFactory("GovernorTokenCreate");
    const args = [
      tokenCont.address,
      votingDelay,
      votingPeriod,
      mockBaseHTS.address,
    ];

    const instance = await upgrades.deployProxy(Governor, args);
    await instance.deployed();

    return { instance, tokenCont, mockBaseHTS, signers };
  }

  async function mineNBlocks(n: number) {
    for (let index = 0; index < n; index++) {
      await ethers.provider.send("evm_mine", []);
    }
  }

  describe("Governor functionality", async () => {
    const getCallDataNew = async (): Promise<string> => {
      const callData = contractInterface.encodeFunctionData("totalSupply", []);
      return callData;
    };

    it("When user has 20% of token share then votes weight should be 20", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      await tokenCont.setTotal(100);
      await tokenCont.setUserBalance(signers[0].address, 20);
      const votes = await instance
        .connect(signers[0])
        .getVotes(tokenCont.address, 1);
      expect(votes).to.be.equals(20);
    });

    it("When user has 30% of token share then votes weight should be 30", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      await tokenCont.setTotal(100);
      await tokenCont.setUserBalance(signers[1].address, 30);
      const votes = await instance.getVotes(tokenCont.address, 1);
      expect(votes).to.be.equals(30);
    });

    it("Token Create Fail", async function () {
      const { instance, mockBaseHTS, signers } = await loadFixture(
        deployFixtureWithFail
      );
      const proposalIdResponse = await createProposal(instance, signers[0]);
      const record = await proposalIdResponse.wait();
      const proposalId = record.events[0].args.proposalId.toString();
      console.log(proposalId);
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
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);

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
      const quorumReached = await instance.quorumReached(proposalId);
      expect(quorumReached).to.be.equals(false);
      const voteSucceeded = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded).to.be.equals(false);

      await instance.castVote(proposalId, 1);
      const voteSucceeded1 = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded1).to.be.equals(true);
      const quorumReached1 = await instance.quorumReached(proposalId);
      expect(quorumReached1).to.be.equals(true);

      await mineNBlocks(20);
      const state = await instance.state(proposalId);
      expect(state).to.be.equals(4);

      await instance.cancelProposal(title);
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
    });

    it("Verify proposal creation to execute flow ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      const treaKey = ethers.utils.toUtf8Bytes("treasurer public key");
      const adminKey = ethers.utils.toUtf8Bytes("Admin public key");

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

      await mineNBlocks(20);
      const state = await instance.state(proposalId);
      expect(state).to.be.equals(4);
      await expect(instance.getTokenAddress(proposalId)).to.revertedWith(
        "Contract not executed yet!"
      );

      await instance.executeProposal(title);
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
      const tokenAddress = await instance.getTokenAddress(proposalId);
      expect(tokenAddress).to.not.be.equals(zeroAddress);
    });

    it("Verify TextProposal creation to Execute flow ", async function () {
      const { textGovernorInstance, tokenCont, signers } = await loadFixture(
        deployFixture
      );

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

      await mineNBlocks(20);
      const state = await textGovernorInstance.state(proposalId);
      expect(state).to.be.equals(4);

      await textGovernorInstance.executeProposal(title);
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
    });

    it("When user delegates votes to different account then delegator voting weight should be removed and delegatee votes should be considered ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      //Creating a proposal for 20% token share
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
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
      //Cast vote a for user 1.
      await instance.castVote(proposalId, 0);
      await verifyProposalVotes(instance, proposalId, {
        abstainVotes: 0,
        againstVotes: 19,
        forVotes: 0,
      });
      //Cast another vote for user 2
      await instance.connect(signers[1]).castVote(proposalId, 1);
      verifyProposalVotes(instance, proposalId, {
        abstainVotes: 0,
        againstVotes: 19,
        forVotes: 30,
      });
      //user 1 delegates votes to user 3
      await instance.delegateTo(signers[2].address);
      //User 3 now votes with different choice
      await instance.connect(signers[2]).castVote(proposalId, 1);
      //User 1 votes share reduced to zero and user 3 votes adds to chosen option
      await verifyProposalVotes(instance, proposalId, {
        abstainVotes: 0,
        againstVotes: 0,
        forVotes: 49,
      });

      const voteSucceeded1 = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded1).to.be.equals(true);
      const quorumReached1 = await instance.quorumReached(proposalId);
      expect(quorumReached1).to.be.equals(true);

      await mineNBlocks(20);
      const state = await instance.state(proposalId);
      expect(state).to.be.equals(4);

      await instance.executeProposal(title);
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
    });

    it("Given delegator already voted when delegator delegates then delegatee should be considered. ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      //Creating a proposal for 20% token share
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
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
      //Cast vote a for user 1.
      await instance.castVote(proposalId, 0);
      await verifyProposalVotes(instance, proposalId, {
        abstainVotes: 0,
        againstVotes: 19,
        forVotes: 0,
      });
      //Cast vote a for with delegatee.
      await tokenCont.setUserBalance(signers[3].address, 0);
      //user 1 delegates votes to user 3
      await instance.delegateTo(signers[3].address);
      expect(await tokenCont.balanceOf(signers[3].address)).to.be.equals(0);
      //User 3 now votes with different choice
      await instance.connect(signers[3]).castVote(proposalId, 1);
      //User 1 votes share reduced to zero and user 3 votes adds to chosen option
      await verifyProposalVotes(instance, proposalId, {
        abstainVotes: 0,
        againstVotes: 0,
        forVotes: 19,
      });

      const voteSucceeded1 = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded1).to.be.equals(true);
      const quorumReached1 = await instance.quorumReached(proposalId);
      expect(quorumReached1).to.be.equals(true);

      await mineNBlocks(20);
      const state = await instance.state(proposalId);
      expect(state).to.be.equals(4);

      await instance.executeProposal(title);
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
    });

    it("Given delegator not voted when delegator delegates and delegatee votes, delegator should not be allowed to vote ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      //Creating a proposal for 20% token share
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
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

      //user 1 delegated to user 3
      await instance.delegateTo(signers[2].address);

      //User 3 now votes with different choice
      await instance.connect(signers[2]).castVote(proposalId, 1);
      //User 1 votes share reduced to zero and user 3 votes adds to chosen option
      await verifyProposalVotes(instance, proposalId, {
        abstainVotes: 0,
        againstVotes: 0,
        forVotes: 19,
      });

      //Now user1 try to cast vote .
      await expect(instance.castVote(proposalId, 0)).to.revertedWith(
        "Delegator already delegated."
      );
    });

    it("Given delegator not voted when delegator delegates, delegator should not be allowed to vote ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      //Creating a proposal for 20% token share
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
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

      //user 1 delegated to user 3
      await instance.delegateTo(signers[2].address);

      //Now user1 try to cast vote .
      await expect(instance.castVote(proposalId, 0)).to.revertedWith(
        "Delegator already delegated."
      );
    });

    it("Given delegator already delegated when tries again then should fail ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(
        deployFixtureWithDelay
      );
      //Creating a proposal for 20% token share
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
      const proposalIdResponse = await createProposal(instance, signers[0]);
      await verifyAccountBalance(
        tokenCont,
        signers[0].address,
        twentyPercent - 1 * precision
      );

      const record = await proposalIdResponse.wait();
      const proposalId = record.events[0].args.proposalId.toString();

      const delay = await instance.votingDelay();
      expect(delay).to.be.equals(5);
      const period = await instance.votingPeriod();
      expect(period).to.be.equals(12);

      //user 1 delegated to user 3
      await instance.delegateTo(signers[2].address);

      //Now user1 try to cast vote .
      await expect(instance.delegateTo(signers[1].address)).to.revertedWith(
        "Delegator already delegated."
      );
    });

    it("Given delegator already delegated when delegatee tries delegation again then should fail ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(
        deployFixtureWithDelay
      );
      //Creating a proposal for 20% token share
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
      const proposalIdResponse = await createProposal(instance, signers[0]);
      await verifyAccountBalance(
        tokenCont,
        signers[0].address,
        twentyPercent - 1 * precision
      );

      const record = await proposalIdResponse.wait();
      const proposalId = record.events[0].args.proposalId.toString();

      const delay = await instance.votingDelay();
      expect(delay).to.be.equals(5);
      const period = await instance.votingPeriod();
      expect(period).to.be.equals(12);

      //user 1 delegated to user 3
      await instance.delegateTo(signers[2].address);

      //Now user1 try to delegate to user 2, it should fail.
      await expect(
        instance.connect(signers[2]).delegateTo(signers[1].address)
      ).to.revertedWith("Delegatee cannot delegate further.");
    });

    it("Given user has already voted when user does token transfer then voting weight should be adjusted ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      //Creating a proposal for 20% token share
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
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
      //Cast vote a for user 1.
      await instance.castVote(proposalId, 0);
      await verifyProposalVotes(instance, proposalId, {
        abstainVotes: 0,
        againstVotes: 19,
        forVotes: 0,
      });

      const tenPercentage = thirtyPercent - twentyPercent;
      await tokenCont.setUserBalance(signers[0].address, tenPercentage);

      //Cast vote a for user 2.
      await instance.connect(signers[1]).castVote(proposalId, 1);
      await verifyProposalVotes(instance, proposalId, {
        abstainVotes: 0,
        againstVotes: 10,
        forVotes: 30,
      });

      const voteSucceeded1 = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded1).to.be.equals(true);
      const quorumReached1 = await instance.quorumReached(proposalId);
      expect(quorumReached1).to.be.equals(true);

      await mineNBlocks(20);
      const state = await instance.state(proposalId);
      expect(state).to.be.equals(4);

      await instance.executeProposal(title);
      await verifyAccountBalance(
        tokenCont,
        signers[0].address,
        tenPercentage + 1 * precision
      ); //Returned token
    });

    it("Given user has already delegated and voted when delegator does token transfer then voting weight should be adjusted ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      //Creating a proposal for 20% token share
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
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

      //user 1 delegates
      await instance.delegateTo(signers[2].address);

      //Cast vote a for with delegatee.
      await instance.connect(signers[2]).castVote(proposalId, 1);
      await verifyProposalVotes(instance, proposalId, {
        abstainVotes: 0,
        againstVotes: 0,
        forVotes: 19,
      });

      const tenPercentage = thirtyPercent - twentyPercent;
      await tokenCont.setUserBalance(signers[0].address, tenPercentage);

      //Cast vote a for user 2.
      await instance.connect(signers[1]).castVote(proposalId, 1);
      await verifyProposalVotes(instance, proposalId, {
        abstainVotes: 0,
        againstVotes: 0,
        forVotes: 40,
      });

      const voteSucceeded1 = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded1).to.be.equals(true);
      const quorumReached1 = await instance.quorumReached(proposalId);
      expect(quorumReached1).to.be.equals(true);

      await mineNBlocks(20);
      const state = await instance.state(proposalId);
      expect(state).to.be.equals(4);

      await instance.executeProposal(title);
      await verifyAccountBalance(
        tokenCont,
        signers[0].address,
        tenPercentage + 1 * precision
      ); //Returned token
    });

    it("Given user has zero tokens when delegator cast vote then revert with no voting power ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      //Creating a proposal for 20% token share
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
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

      //Cast vote a for with delegatee.
      await tokenCont.setUserBalance(signers[0].address, 0);

      await expect(instance.castVote(proposalId, 1)).to.revertedWith(
        "No voting power"
      );
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
        governorUpgradeInstance.initialize(zeroAddress, 0, 10, zeroAddress)
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

    it("Verify GovernorTransferToken should return data for valid propsal id", async function () {
      const { governorTransferTokenInstance, tokenCont, signers } =
        await loadFixture(deployFixture);
      const proposalId = await getTransferTokenProposalId(
        governorTransferTokenInstance,
        signers,
        tokenCont.address,
        5
      );
      const info = await governorTransferTokenInstance.getProposalDetails(
        proposalId
      );
      expect(info[0]).to.be.equals(signers[0].address);
      expect(info[1]).to.be.equals(title);
      expect(info[2]).to.be.equals(desc);
      expect(info[3]).to.be.equals(link);
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
          amount
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
