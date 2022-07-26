//Commenting test as contract has dependency on HTS service which we need to mock somehow.

/*
const { expect } = require("chai");
const { ethers} = require("hardhat");

describe("Swap", function () {
  let swapContract = undefined;
  let owenerAddr = undefined;
  const tokenBAddress = "0x0000000000000000000000000000000000010001";
  const tokenAAddress = "0x0000000000000000000000000000000000020002";
  const zeroAddress = "0x1111111000000000000000000000000000000000";

  beforeEach(async () => {
    const [owner] = await ethers.getSigners();

    const Swap = await ethers.getContractFactory("Swap");
    owenerAddr = await owner.getAddress();
   
    swapContract = await Swap.deploy();
    await swapContract.deployed();
    await swapContract.initializeContract(owenerAddr, tokenAAddress, tokenBAddress, 100, 100);
  });

  it("Create a token pair with 100 unit each ", async function () {
    const tokenQty = await swapContract.getPairQty();
    expect(tokenQty[0]).to.be.equals(100);
    expect(tokenQty[1]).to.be.equals(100);
  });

  it("Swap 30 units of token A  ", async function () {
    const tokenBeforeQty = await swapContract.getPairQty();
    expect(tokenBeforeQty[0]).to.be.equals(100);
    const tx = await swapContract.swapToken(owenerAddr, tokenAAddress, zeroAddress, 30, 0);
    await tx.wait();
    const tokenQty = await swapContract.getPairQty();
    expect(tokenQty[0]).to.be.equals(130);
    expect(tokenQty[1]).to.be.equals(77);
  });

  it("Swap 30 units of token B  ", async function () {
    const tokenBeforeQty = await swapContract.getPairQty();
    expect(tokenBeforeQty[1]).to.be.equals(100);
    const tx = await swapContract.swapToken(owenerAddr, zeroAddress, tokenBAddress, 0, 30);
    await tx.wait();
    const tokenQty = await swapContract.getPairQty();
    expect(tokenQty[0]).to.be.equals(77);
    expect(tokenQty[1]).to.be.equals(130);
  });

  it("Add liquidity to the pool by adding 50 units of token and 50 units of token B  ", async function () {
    const tokenBeforeQty = await swapContract.getPairQty();
    expect(tokenBeforeQty[0]).to.be.equals(100);
    expect(tokenBeforeQty[1]).to.be.equals(100);
    const tx = await swapContract.addLiquidity(owenerAddr, owenerAddr, owenerAddr, 50, 50);
    await tx.wait();
    const tokenQty =  await swapContract.getPairQty();
    expect(tokenQty[0]).to.be.equals(150);
    expect(tokenQty[1]).to.be.equals(150);
  });

  it("Remove liquidity to the pool by removing 50 units of token and 50 units of token B  ", async function () {
    const tokenBeforeQty = await swapContract.getPairQty();
    expect(tokenBeforeQty[0]).to.be.equals(100);
    expect(tokenBeforeQty[1]).to.be.equals(100);
    const tx = await swapContract.removeLiquidity(owenerAddr, owenerAddr, owenerAddr, 50, 50);
    await tx.wait();
    const tokenQty =  await swapContract.getPairQty();
    expect(tokenQty[0]).to.be.equals(50);
    expect(tokenQty[1]).to.be.equals(50);
  });

  it("Verfiy liquidity contribution is correct ", async function () {
    const result = await swapContract.getContributorTokenShare(owenerAddr);
    expect(result[0]).to.be.equals(100);
    expect(result[1]).to.be.equals(100);
    const tx = await swapContract.addLiquidity(owenerAddr, owenerAddr, owenerAddr, 50, 80);
    await tx.wait();
    const resultAfter = await swapContract.getContributorTokenShare(owenerAddr);
    expect(resultAfter[0]).to.be.equals(150);
    expect(resultAfter[1]).to.be.equals(180);
  });

});

 */