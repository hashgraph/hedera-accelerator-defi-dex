// Commenting test as contract has dependency on HTS service which we need to mock somehow.
import {  expect } from "chai";
import * as fs from "fs";
import Web3 from "web3";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { BigNumber, Overrides, PayableOverrides } from "ethers";

describe("Governor Tests", function () {
  const tokenBAddress = "0x0000000000000000000000000000000000010001";
  const tokenAAddress = "0x0000000000000000000000000000000000020002";
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

  // const governorGenericJson = readFileContent("./artifacts/contracts/common/GovernorGeneric.sol/GovernorGeneric.json");
  // const governorGenericInterface = new ethers.utils.Interface(governorGenericJson.abi);

  describe("GovernorCountingSimpleInternal Upgradeable", function () {
    it("Verify if the Governor contract is upgradeable safe ", async function () {
      const votingDelay = 0;
      const votingPeriod = 12;
      const Governor = await ethers.getContractFactory("GovernorTokenCreate");
      const treaKey = ethers.utils.toUtf8Bytes("treasurer public key");
      const adminKey = ethers.utils.toUtf8Bytes("Admin public key");
      const args = [zeroAddress, zeroAddress, treaKey, zeroAddress, adminKey, "Token", "Symbol", votingDelay, votingPeriod];
      const instance = await upgrades.deployProxy(Governor, args, {unsafeAllow: ['delegatecall']});
      await instance.deployed();
    });
  });

  async function deployFixture() {
    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(10, 10);
    const votingDelay = 0;
    const votingPeriod = 12;

    const Governor = await ethers.getContractFactory("GovernorTokenCreate");
    const treaKey = ethers.utils.toUtf8Bytes("treasurer public key");
    const adminKey = ethers.utils.toUtf8Bytes("Admin public key");
    const args = [tokenCont.address, zeroAddress, treaKey, zeroAddress, adminKey, "Token", "Symbol", votingDelay, votingPeriod];
    const instance = await upgrades.deployProxy(Governor, args, {unsafeAllow: ['delegatecall']});

    await instance.deployed();
   
    return { instance, tokenCont};
  }

  describe("Governor functionality",  async () => {

    const getCallData = async (): Promise<Uint8Array> => {
        const callData = contractInterface.encodeFunctionData("totalSupply", []);
        return ethers.utils.toUtf8Bytes(callData);
    }

    const getCallDataNew = async (): Promise<string> => {
      const callData = contractInterface.encodeFunctionData("totalSupply", []);
      return callData;
  }

    it("getVotes for 100% shares", async function () {
      const { instance, tokenCont} = await loadFixture(deployFixture);
      const votes = await instance.getVotes(tokenCont.address, 1);
      expect(votes).to.be.equals(100);
    });

    it("getVotes for 50% shares", async function () {
        const { instance, tokenCont } = await loadFixture(deployFixture);
        await tokenCont.setTotal(20);
        await tokenCont.setUserBalance(10);
        const votes = await instance.getVotes(tokenCont.address, 1);
        expect(votes).to.be.equals(50);
    });

    it.only("Execute ", async function () {
      const { instance, tokenCont } = await loadFixture(deployFixture);
      const targets = [tokenCont.address];
      const ethValues = [0];
      //const callData = await getCallData();
      const callData = await getCallDataNew();
      console.log(`callData ${callData}`);
      const calls = [callData];
      const desc = "Test";
      const proposalIdOLD = await instance.propose(targets, ethValues, calls, web3.utils.soliditySha3(desc));
      const proposalId = await instance.hashProposal(targets, ethValues, calls, web3.utils.soliditySha3(desc));
      const votes = await instance.getVotes(tokenCont.address, 1);
      console.log(votes);
      console.log(proposalId);
      const quorumReached = await instance.quorumReached(proposalId);
      expect(quorumReached).to.be.equals(false);
      //const votes = await instance.executeNew(tokenCont.address, calls);
  });
  });
})
