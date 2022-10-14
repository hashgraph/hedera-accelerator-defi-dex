// Commenting test as contract has dependency on HTS service which we need to mock somehow.
import {  expect } from "chai";
import * as fs from "fs";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { BigNumber, Overrides, PayableOverrides } from "ethers";



describe("Governor Tests", function () {
  const tokenBAddress = "0x0000000000000000000000000000000000010001";
  const tokenAAddress = "0x0000000000000000000000000000000000020002";
  const zeroAddress = "0x1111111000000000000000000000000000000000";
  const newZeroAddress = "0x0000000000000000000000000000000000000000";
  const userAddress = "0x0000000000000000000000000000000000020008";
  let precision: BigNumber;
  const fee = 1;

  describe("GovernorCountingSimpleInternal Upgradeable", function () {
    it("Verify if the Governor contract is upgradeable safe ", async function () {
      const Governor = await ethers.getContractFactory("GovernorCountingSimpleInternal");
      const instance = await upgrades.deployProxy(Governor, [zeroAddress], {unsafeAllow: ['delegatecall']});
      await instance.deployed();
    });
  });

  async function deployFixture() {
    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(10, 10);

    const Governor = await ethers.getContractFactory("GovernorCountingSimpleInternal");
    const instance = await upgrades.deployProxy(Governor, [tokenCont.address], {unsafeAllow: ['delegatecall']});
    await instance.deployed();
    
    return { instance, tokenCont};
  }

  describe.only("Governor functionality",  async () => {

    const readFileContent = (filePath: string) => {
        const rawdata: any = fs.readFileSync(filePath);
        return JSON.parse(rawdata);
      };
    
    const getCallData = async (): Promise<string> => {
        const contractJson = readFileContent("./artifacts/contracts/mock/ERC20Mock.sol/ERC20Mock.json");
        const contractInterface = new ethers.utils.Interface(contractJson.abi);
        const callData = contractInterface.encodeFunctionData("totalSupply", []);
        return callData;
    }

    it("getVotes for 100% shares", async function () {
      const { instance } = await loadFixture(deployFixture);
      const votes = await instance.getVotes(zeroAddress, 1);
      expect(votes).to.be.equals(100);
    });

    it("getVotes for 50% shares", async function () {
        const { instance, tokenCont } = await loadFixture(deployFixture);
        await tokenCont.setTotal(20);
        const votes = await instance.getVotes(zeroAddress, 1);
        expect(votes).to.be.equals(50);
    });

  });
})

