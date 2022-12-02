// Commenting test as contract has dependency on HTS service which we need to mock somehow.
import { expect } from "chai";
import * as fs from "fs";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import { ERC20Mock } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Governor Tests", function () {
  const zeroAddress = "0x1111111000000000000000000000000000000000";
  const precision = 100000000;
  const total = 100 * precision;
  const twentyPercent = total * 0.2;
  const thirtyPercent = total * 0.3;
  const fiftyPercent = total * 0.5;
  const desc = "Test";

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
  });

  async function deployFixture() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(true, true);
    const signers = await ethers.getSigners();
    mockBaseHTS.setFailType(0);

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

    return { instance, tokenCont, mockBaseHTS, signers };
  }

  async function deployFixtureWithDelay() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(true, true);
    const signers = await ethers.getSigners();
    mockBaseHTS.setFailType(0);

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

      await instance.cancel(desc);
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
    });

    it("Verify proposal creation to execute flow ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      const treaKey = ethers.utils.toUtf8Bytes("treasurer public key");
      const adminKey = ethers.utils.toUtf8Bytes("Admin public key");
      const desc = "Test";

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

      await instance.executeProposal(desc);
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
    });

    it("When user delegates votes to different account then delegator voting weight should be removed and delegatee votes should be considered ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      const desc = "Test";
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

      await instance.executeProposal(desc);
      await verifyAccountBalance(tokenCont, signers[0].address, twentyPercent);
    });

    it("Given delegator already voted when delegator delegates then delegatee should be considered. ", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      const desc = "Test";
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

      await instance.executeProposal(desc);
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

      await instance.executeProposal(desc);
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

      await instance.executeProposal(desc);
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

    const createProposal = async (
      instance: Contract,
      account: SignerWithAddress
    ) => {
      const treaKey = ethers.utils.toUtf8Bytes("treasurer public key");
      const adminKey = ethers.utils.toUtf8Bytes("Admin public key");
      return await instance
        .connect(account)
        .createProposal(
          desc,
          zeroAddress,
          treaKey,
          zeroAddress,
          adminKey,
          "Token",
          "Symbol"
        );
    };

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
