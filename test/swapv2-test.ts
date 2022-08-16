// Commenting test as contract has dependency on HTS service which we need to mock somehow.
import {  expect } from "chai";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";

describe("Swap", function () {
  const tokenBAddress = "0x0000000000000000000000000000000000010001";
  const tokenAAddress = "0x0000000000000000000000000000000000020002";
  const zeroAddress = "0x1111111000000000000000000000000000000000";

  async function deployFixture() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(true, false);

    const SwapV2 = await ethers.getContractFactory("SwapTest");
    const swapV2 = await SwapV2.deploy(mockBaseHTS.address);

    await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, 100, 100);

    return { swapV2 };
  }

  async function deployFailureFixture() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(false, false);

    const SwapV2 = await ethers.getContractFactory("SwapTest");
    const swapV2 = await SwapV2.deploy(mockBaseHTS.address);

    await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, 100, 100);

    return { swapV2 };
  }

  async function deployFailureFixtureAlter() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(false, true);

    const SwapV2 = await ethers.getContractFactory("SwapTest");
    const swapV2 = await SwapV2.deploy(mockBaseHTS.address);
    //await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, 100, 100);

    return { swapV2 };
  }

  it("Create a token pair with 100 unit each ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const qtys = await swapV2.getPairQty();
    expect(qtys[0]).to.be.equals(100);
    expect(qtys[1]).to.be.equals(100);
  });

  it("Swap 30 units of token A  ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const tokenBeforeQty = await swapV2.getPairQty();
    expect(tokenBeforeQty[0]).to.be.equals(100);
    const tx = await swapV2.swapToken(zeroAddress, tokenAAddress, zeroAddress, 30, 0);
    await tx.wait();
    
    const tokenQty = await swapV2.getPairQty();
    expect(tokenQty[0]).to.be.equals(130);
    expect(tokenQty[1]).to.be.equals(77);
  });

  it("Swap 30 units of token B  ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const tokenBeforeQty = await swapV2.getPairQty();
    expect(tokenBeforeQty[1]).to.be.equals(100);
    const tx = await swapV2.swapToken(zeroAddress, zeroAddress, tokenBAddress, 0, 30);
    await tx.wait();
    const tokenQty = await swapV2.getPairQty();
    expect(tokenQty[0]).to.be.equals(77);
    expect(tokenQty[1]).to.be.equals(130);
  });

  it("Add liquidity to the pool by adding 50 units of token and 50 units of token B  ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const tokenBeforeQty = await swapV2.getPairQty();
    expect(tokenBeforeQty[0]).to.be.equals(100);
    expect(tokenBeforeQty[1]).to.be.equals(100);
    const tx = await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 50, 50);
    await tx.wait();
    const tokenQty =  await swapV2.getPairQty();
    expect(tokenQty[0]).to.be.equals(150);
    expect(tokenQty[1]).to.be.equals(150);
  });

  it("Remove liquidity to the pool by removing 50 units of token and 50 units of token B  ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const tokenBeforeQty = await swapV2.getPairQty();
    expect(tokenBeforeQty[0]).to.be.equals(100);
    expect(tokenBeforeQty[1]).to.be.equals(100);
    const tx = await swapV2.removeLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 50, 50);
    await tx.wait();

    const tokenQty =  await swapV2.getPairQty();
    expect(tokenQty[0]).to.be.equals(50);
    expect(tokenQty[1]).to.be.equals(50);
  });

  it("Verfiy liquidity contribution is correct ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const result = await swapV2.getContributorTokenShare(zeroAddress);
    expect(result[0]).to.be.equals(100);
    expect(result[1]).to.be.equals(100);
    const tx = await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 50, 80);
    await tx.wait();
    const resultAfter = await swapV2.getContributorTokenShare(zeroAddress);
    expect(resultAfter[0]).to.be.equals(150);
    expect(resultAfter[1]).to.be.equals(180);
  });

  describe("When HTS gives failure repsonse",  async () => {
    // it("Create a token pair fails with revert exception ", async function () {
    //   const { swapV2 } = await loadFixture(deployFailureFixture);
    //   await expect(swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, 100, 100)).to.revertedWith("Creating contract: Transfering token A to contract failed with status code");
    // });
  
    it("Contract gives 100 as qty for tokens ", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      const qtys = await swapV2.getPairQty();
      expect(qtys[0]).to.be.equals(100);
      expect(qtys[1]).to.be.equals(100);
    });

    it("Passing unknown A token to swap", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(100);
      await expect(swapV2.swapToken(zeroAddress, zeroAddress, zeroAddress, 30, 0)).to.revertedWith("Pls pass correct token to swap.");
    });

    it("Passing unknown B token to swap", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(100);
      await expect(swapV2.swapToken(zeroAddress, zeroAddress, zeroAddress, 30, 0)).to.revertedWith("Pls pass correct token to swap.");
    });

    it("Swap Token A with B Wrong Address", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(100);
      await expect(swapV2.swapToken(zeroAddress, tokenAAddress, zeroAddress, 30, 0)).to.revertedWith("swapTokenA: Transfering token A to contract failed with status code");
    });

    it("Add liquidity Fail", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(100);
      await expect(swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 30, 30)).to.revertedWith("Association of Contract to tokenA failed");
    });

  });

});

