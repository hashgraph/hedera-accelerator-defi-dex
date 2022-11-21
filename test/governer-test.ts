// Commenting test as contract has dependency on HTS service which we need to mock somehow.
import { expect } from "chai";
import * as fs from "fs";
import Web3 from "web3";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { BigNumber, Overrides, PayableOverrides } from "ethers";

describe("Governor Tests", function () {
  const zeroAddress = "0x1111111000000000000000000000000000000000";
  let precision: BigNumber;
  const fee = 1;
  const web3 = Web3;

  const readFileContent = (filePath: string) => {
    const rawdata: any = fs.readFileSync(filePath);
    return JSON.parse(rawdata);
  };

  const contractJson = readFileContent("./artifacts/contracts/mock/ERC20Mock.sol/ERC20Mock.json");
  const contractInterface = new ethers.utils.Interface(contractJson.abi);

  describe("GovernorCountingSimpleInternal Upgradeable", function () {
    it("Verify if the Governor contract is upgradeable safe ", async function () {
      const votingDelay = 0;
      const votingPeriod = 12;
      const Governor = await ethers.getContractFactory("GovernorTokenCreate");
      const treaKey = ethers.utils.toUtf8Bytes("treasurer public key");
      const adminKey = ethers.utils.toUtf8Bytes("Admin public key");
      const args = [zeroAddress, zeroAddress, treaKey, zeroAddress, adminKey, "Token", "Symbol", votingDelay, votingPeriod, zeroAddress];
      const instance = await upgrades.deployProxy(Governor, args, { unsafeAllow: ['delegatecall'] });
      await instance.deployed();
    });
  });

  async function deployFixture() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(true, true);
    const signers = await ethers.getSigners();
    mockBaseHTS.setFailType(0);

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(1000000000, 1000000000);
    const votingDelay = 0;
    const votingPeriod = 1;

    const Governor = await ethers.getContractFactory("GovernorTokenCreate");
    const treaKey = ethers.utils.toUtf8Bytes("treasurer public key");
    const adminKey = ethers.utils.toUtf8Bytes("Admin public key");
    console.log(`token Service address ${mockBaseHTS.address}`);
    const args = [tokenCont.address, zeroAddress, treaKey, zeroAddress, adminKey, "Token", "Symbol", votingDelay, votingPeriod, mockBaseHTS.address];
    const instance = await upgrades.deployProxy(Governor, args, { unsafeAllow: ['delegatecall'] });

    await instance.deployed();

    return { instance, tokenCont, mockBaseHTS, signers };
  }

  async function mineNBlocks(n: number) {
    for (let index = 0; index < n; index++) {
      await ethers.provider.send('evm_mine', []);
    }
  }

  describe("Governor functionality", async () => {
    const getCallDataNew = async (): Promise<string> => {
      const callData = contractInterface.encodeFunctionData("totalSupply", []);
      return callData;
    }

    it("getVotes for 100% shares", async function () {
      const { instance, tokenCont } = await loadFixture(deployFixture);
      const votes = await instance.getVotes(tokenCont.address, 1);
      expect(votes).to.be.equals(100);
    });

    it("getVotes for 50% shares", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      await tokenCont.setTotal(20);
      await tokenCont.setUserBalance(signers[0].address, 10);
      const votes = await instance.getVotes(tokenCont.address, 1);
      expect(votes).to.be.equals(50);
    });

    it("Test all states of proposal for cancel", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      const targets = [tokenCont.address];
      const ethValues = [0];
      const callData = await getCallDataNew();
      const calls = [callData];
      const desc = "Test";
      const userBalance = await tokenCont.balanceOf(signers[0].address);
      expect(userBalance).to.be.equals(1000000000);
      const proposalIdResponse = await instance.connect(signers[0]).propose(targets, ethValues, calls, desc);
      const userBalanceAfterProposalCreation = await tokenCont.balanceOf(signers[0].address);
      expect(userBalanceAfterProposalCreation).to.be.equals(900000000);

      const record = await proposalIdResponse.wait();
      const proposalId = record.events[0].args.proposalId.toString();

      const delay = await instance.votingDelay();
      expect(delay).to.be.equals(0);
      const period = await instance.votingPeriod();
      expect(period).to.be.equals(1);
      const thrashhold = await instance.proposalThreshold();
      expect(thrashhold).to.be.equals(0);
      const quorumReached = await instance.quorumReached(proposalId);
      expect(quorumReached).to.be.equals(false);
      const voteSucceeded = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded).to.be.equals(false);

      await instance.castVote(proposalId, 1);
      const voteSucceeded1 = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded1).to.be.equals(true);
      const quorumReached1 = await instance.quorumReached(proposalId);
      expect(quorumReached1).to.be.equals(true);

      await mineNBlocks(2);
      const state = await instance.state(proposalId);
      expect(state).to.be.equals(4);

      await instance.cancelProposal(targets, ethValues, calls, desc);
      const userBalanceAfterCancelProposal = await tokenCont.balanceOf(signers[0].address);
      expect(userBalanceAfterCancelProposal).to.be.equals(1000000000);
    });

    it("Test all states of proposal for execute", async function () {
      const { instance, tokenCont, signers } = await loadFixture(deployFixture);
      const targets = [tokenCont.address];
      const ethValues = [0];
      const callData = await getCallDataNew();
      const calls = [callData];
      const desc = "Test";
      const userBalance = await tokenCont.balanceOf(signers[0].address);
      expect(userBalance).to.be.equals(1000000000);
      const proposalIdResponse = await instance.connect(signers[0]).propose(targets, ethValues, calls, desc);
      const userBalanceAfterProposalCreation = await tokenCont.balanceOf(signers[0].address);
      expect(userBalanceAfterProposalCreation).to.be.equals(900000000);

      const record = await proposalIdResponse.wait();
      const proposalId = record.events[0].args.proposalId.toString();

      const delay = await instance.votingDelay();
      expect(delay).to.be.equals(0);
      const period = await instance.votingPeriod();
      expect(period).to.be.equals(1);
      const thrashhold = await instance.proposalThreshold();
      expect(thrashhold).to.be.equals(0);
      const quorumReached = await instance.quorumReached(proposalId);
      expect(quorumReached).to.be.equals(false);
      const voteSucceeded = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded).to.be.equals(false);

      await instance.castVote(proposalId, 1);
      const voteSucceeded1 = await instance.voteSucceeded(proposalId);
      expect(voteSucceeded1).to.be.equals(true);
      const quorumReached1 = await instance.quorumReached(proposalId);
      expect(quorumReached1).to.be.equals(true);

      await mineNBlocks(2);
      const state = await instance.state(proposalId);
      expect(state).to.be.equals(4);

      await instance.executePublic(targets, ethValues, calls, desc);
      const userBalanceAfterCancelProposal = await tokenCont.balanceOf(signers[0].address);
      expect(userBalanceAfterCancelProposal).to.be.equals(1000000000);
    });
  });
})
