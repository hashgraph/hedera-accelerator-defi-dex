// Commenting test as contract has dependency on HTS service which we need to mock somehow.
import {  expect } from "chai";
import { deployMockContract, MockProvider } from "ethereum-waffle";
import { ethers } from "hardhat";
import { IHederaTokenService } from "../typechain";
import * as fs from "fs";
import { ContractFactory } from "ethers/lib/ethers";


describe("Swap", function () {
  const htsServiceSuccessResponseCode = 22;
  let swapContract:any  = undefined;
  const tokenBAddress = "0x0000000000000000000000000000000000010001";
  const tokenAAddress = "0x0000000000000000000000000000000000020002";
  const zeroAddress = "0x1111111000000000000000000000000000000000";

  const getCompiledContract = (filePath: string) => {
    const rawdata: any = fs.readFileSync(filePath);
    return JSON.parse(rawdata);
  };

  const setup = async () => {
    const [sender, receiver] = new MockProvider().getWallets();
    const tokenServiceFilePath = "./artifacts/contracts/IBaseHTS.sol/IBaseHTS.json";
    const swapFilePath = "./artifacts/contracts/SwapWithMock.sol/SwapWithMock.json";
    const tokenServiceCompiledContract = getCompiledContract(tokenServiceFilePath);
    const swapContract = getCompiledContract(swapFilePath);

    const tokenServiceContract = await deployMockContract(sender, tokenServiceCompiledContract.abi);

    const contractFactory = new ContractFactory(swapContract.abi, swapContract.bytecode, sender);

    const contract = await contractFactory.deploy(tokenServiceContract.address);

    return {sender, receiver, contract, tokenServiceContract};
  }

  beforeEach(async () => {
    const {contract, tokenServiceContract } = await setup();
    await tokenServiceContract.mock.associateTokenPublic.returns(htsServiceSuccessResponseCode);
    await tokenServiceContract.mock.transferTokenPublic.returns(htsServiceSuccessResponseCode);
    await contract.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, 100, 100);
    swapContract = contract;
  });

  it("Create a token pair with 100 unit each ", async function () {
    const tokenQty = await swapContract.getPairQty();
    expect(tokenQty[0]).to.be.equals(100);
    expect(tokenQty[1]).to.be.equals(100);
  });

  it("Swap 30 units of token A  ", async function () {
    const tokenBeforeQty = await swapContract.getPairQty();
    expect(tokenBeforeQty[0]).to.be.equals(100);
    const tx = await swapContract.swapToken(zeroAddress, tokenAAddress, zeroAddress, 30, 0);
    await tx.wait();
    
    const tokenQty = await swapContract.getPairQty();
    expect(tokenQty[0]).to.be.equals(130);
    expect(tokenQty[1]).to.be.equals(77);
  });

  it("Swap 30 units of token B  ", async function () {
    const tokenBeforeQty = await swapContract.getPairQty();
    expect(tokenBeforeQty[1]).to.be.equals(100);
    const tx = await swapContract.swapToken(zeroAddress, zeroAddress, tokenBAddress, 0, 30);
    await tx.wait();
    const tokenQty = await swapContract.getPairQty();
    expect(tokenQty[0]).to.be.equals(77);
    expect(tokenQty[1]).to.be.equals(130);
  });

  it("Add liquidity to the pool by adding 50 units of token and 50 units of token B  ", async function () {
    const tokenBeforeQty = await swapContract.getPairQty();
    expect(tokenBeforeQty[0]).to.be.equals(100);
    expect(tokenBeforeQty[1]).to.be.equals(100);
    const tx = await swapContract.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 50, 50);
    await tx.wait();
    const tokenQty =  await swapContract.getPairQty();
    expect(tokenQty[0]).to.be.equals(150);
    expect(tokenQty[1]).to.be.equals(150);
  });

  it("Remove liquidity to the pool by removing 50 units of token and 50 units of token B  ", async function () {
    const tokenBeforeQty = await swapContract.getPairQty();
    expect(tokenBeforeQty[0]).to.be.equals(100);
    expect(tokenBeforeQty[1]).to.be.equals(100);
    const tx = await swapContract.removeLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 50, 50);
    await tx.wait();
    const tokenQty =  await swapContract.getPairQty();
    expect(tokenQty[0]).to.be.equals(50);
    expect(tokenQty[1]).to.be.equals(50);
  });

  it("Verfiy liquidity contribution is correct ", async function () {
    const result = await swapContract.getContributorTokenShare(zeroAddress);
    expect(result[0]).to.be.equals(100);
    expect(result[1]).to.be.equals(100);
    const tx = await swapContract.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 50, 80);
    await tx.wait();
    const resultAfter = await swapContract.getContributorTokenShare(zeroAddress);
    expect(resultAfter[0]).to.be.equals(150);
    expect(resultAfter[1]).to.be.equals(180);
  });

});

