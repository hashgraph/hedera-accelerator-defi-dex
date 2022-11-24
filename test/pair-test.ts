// Commenting test as contract has dependency on HTS service which we need to mock somehow.
import {  expect } from "chai";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { BigNumber, Overrides, PayableOverrides } from "ethers";
import Web3 from "web3";


describe("All Tests", function () {
  const tokenBAddress = "0x0000000000000000000000000000000000010001";
  const tokenAAddress = "0x0000000000000000000000000000000000020002";
  const tokenCAddress = "0x0000000000000000000000000000000000020003";
  const zeroAddress = "0x1111111000000000000000000000000000000000";
  const newZeroAddress = "0x0000000000000000000000000000000000000000";
  const userAddress = "0x0000000000000000000000000000000000020008";
  const treasury = "0x0000000000000000000000000000000002d70207";
  let precision: BigNumber;
  const fee = BigNumber.from(1);

  describe("Swap Upgradeable", function () {
    it("Verify if the Swap contract is upgradeable safe ", async function () {
      const Swap = await ethers.getContractFactory("Pair");
      const instance = await upgrades.deployProxy(Swap, [zeroAddress, zeroAddress,tokenAAddress,
        tokenBAddress,
        treasury,
        fee,]);
      await instance.deployed();
    });
  });

  async function deployFixture() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(true, false);
    mockBaseHTS.setFailType(0);

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(10, 10);

    const LpTokenCont = await ethers.getContractFactory("LPToken");
    const lpTokenCont = await upgrades.deployProxy(LpTokenCont, [mockBaseHTS.address]);
    await lpTokenCont.deployed();

    const SwapV2 = await ethers.getContractFactory("Pair");
    const swapV2 = await upgrades.deployProxy(SwapV2, [mockBaseHTS.address, lpTokenCont.address,tokenAAddress,
      tokenBAddress,
      treasury,
      fee]);
    await swapV2.deployed();

    precision = await swapV2.getPrecisionValue();

    const Factory = await ethers.getContractFactory("Factory");
    const factory = await Factory.deploy();
    

    return { swapV2 , mockBaseHTS, lpTokenCont, factory};
  }

  async function deployFailureFixture() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(false, false);
    await mockBaseHTS.setFailType(0);

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(10, 10);

    const LpTokenCont = await ethers.getContractFactory("LPToken");
    const lpTokenCont = await upgrades.deployProxy(LpTokenCont, [mockBaseHTS.address]);
    await lpTokenCont.deployed();

    const SwapV2 = await ethers.getContractFactory("Pair");
    const swapV2 = await upgrades.deployProxy(SwapV2, [mockBaseHTS.address, lpTokenCont.address, tokenAAddress,
      tokenBAddress,
      treasury,
      fee]);
    await swapV2.deployed();

    precision = await swapV2.getPrecisionValue();

    return { swapV2, mockBaseHTS, lpTokenCont};
  }

  describe("Factory Contract positive Tests",  async () => {

    it("Check createPair method", async function () {
      const { factory, mockBaseHTS } = await loadFixture(deployFixture);
      await factory.setUpFactory(mockBaseHTS.address);
      await factory.createPair(tokenAAddress, tokenBAddress, treasury, fee);
      const pair1 = await factory.getPair(tokenAAddress, tokenBAddress);
      await factory.createPair(tokenAAddress, tokenBAddress, treasury, fee);
      const pair2 = await factory.getPair(tokenAAddress, tokenBAddress);
      expect(pair1).to.be.equals(pair2);
      const pairs = await factory.getPairs(0)
      expect(pairs[0]).to.be.equals(1);
    });

    it("Check getPairs method", async function () {
      const { factory, mockBaseHTS } = await loadFixture(deployFixture);
      await factory.setUpFactory(mockBaseHTS.address);
      const pairCreateTransaction1 = await factory.createPair(tokenAAddress, tokenBAddress,treasury, fee);
      const record = await pairCreateTransaction1.wait();
      const pair1 = record.events[2].args._pairAddress.toString();
      const pairs = await factory.getPairs(0)
      expect(pairs[1][0].toString()).to.be.equals(pair1);
      const pairCreateTransaction2 = await factory.createPair(tokenAAddress, tokenBAddress,treasury, fee);
      const record2 = await pairCreateTransaction2.wait();
      const pair2 = record2.events[2].args._pairAddress.toString();
      const pairs2 = await factory.getPairs(0);
      expect(pairs2[1][1].toString()).to.be.equals(pair2);
      expect(pairs2[0]).to.be.equals(2);
    });

    it("Check For identical Tokens", async function () {
      const { factory, mockBaseHTS } = await loadFixture(deployFixture);
      await factory.setUpFactory(mockBaseHTS.address);
      await expect(factory.createPair(tokenAAddress, tokenAAddress, treasury, fee)).to.revertedWith("IDENTICAL_ADDRESSES");
    });

    it("Check For zero Token address", async function () {
      const { factory, mockBaseHTS } = await loadFixture(deployFixture);
      await factory.setUpFactory(mockBaseHTS.address);
      await expect(factory.createPair(newZeroAddress, tokenAAddress, treasury, fee)).to.revertedWith("ZERO_ADDRESS");
    });

    it("Check getPair method", async function () {
      const { factory, mockBaseHTS } = await loadFixture(deployFixture);
      await factory.setUpFactory(mockBaseHTS.address);
      await factory.createPair(tokenAAddress, tokenBAddress, treasury, fee);
      const pair = await factory.getPair(tokenAAddress, tokenBAddress);
      expect(pair).to.be.not.equal(zeroAddress);
    });
  });

  it("Create a token pair with 0 unit each ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const qtys = await swapV2.getPairQty();
    expect(qtys[0]).to.be.equals(precision.mul(0));
    expect(qtys[1]).to.be.equals(precision.mul(0));
  });

  it("Swap 1 units of token A  ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const tokenAPoolQty = BigNumber.from(200).mul(precision);
    const tokenBPoolQty = BigNumber.from(220).mul(precision);
    await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, tokenAPoolQty, tokenBPoolQty);
    const tokenBeforeQty = await swapV2.getPairQty(); 
    expect(Number(tokenBeforeQty[0])).to.be.equals(tokenAPoolQty);
    var addTokenAQty = BigNumber.from(1).mul(precision);
    const feeForTokenA = await swapV2.feeForToken(addTokenAQty);
    const addTokenAQtyAfterFee =  Number(addTokenAQty) - (Number(feeForTokenA)/2);
    const tx = await swapV2.swapToken(zeroAddress, tokenAAddress, addTokenAQty);
    await tx.wait();
    
    const tokenQty = await swapV2.getPairQty();
    expect(tokenQty[0]).to.be.equals(tokenAPoolQty.add(addTokenAQtyAfterFee));
    const feeForTokenB = await swapV2.feeForToken(tokenQty[1]);
    const tokenBResultantQtyAfterFee = Number(tokenQty[1]) - Number(feeForTokenB);
    const tokenBResultantQty = Number(tokenBResultantQtyAfterFee)/Number(precision);
    expect(tokenBResultantQty).to.be.equals(217.8163702);
  });


it("Swap 1 units of token B  ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const tokenAPoolQty = BigNumber.from(114).mul(precision);
    const tokenBPoolQty = BigNumber.from(220).mul(precision);
    await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, tokenAPoolQty, tokenBPoolQty);
    const tokenBeforeQty = await swapV2.getPairQty(); 
    expect(Number(tokenBeforeQty[1])).to.be.equals(tokenBPoolQty);
    const addTokenBQty = BigNumber.from(1).mul(precision);
    const feeForTokenB = await swapV2.feeForToken(addTokenBQty);
    const addTokenBQtyAfterFee =  Number(addTokenBQty) - (Number(feeForTokenB)/2);
    const tx = await swapV2.swapToken(zeroAddress, tokenBAddress, addTokenBQty);
    await tx.wait();
    
    const tokenQty = await swapV2.getPairQty();
    expect(tokenQty[1]).to.be.equals(tokenBPoolQty.add(addTokenBQtyAfterFee));
    // const tokenAResultantQty = Number(tokenQty[0])/Number(precision);
    const feeForTokenA = await swapV2.feeForToken(tokenQty[0]);
    const tokenAResultantQtyAfterFee = Number(tokenQty[0]) - Number(feeForTokenA);
    const tokenAResultantQty = Number(tokenAResultantQtyAfterFee)/Number(precision);
    expect(tokenAResultantQty).to.be.equals(112.9146473);
  });

  it("Swap 100 units of token A - breaching slippage  ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const tokenAPoolQty = BigNumber.from(200).mul(precision);
    const tokenBPoolQty = BigNumber.from(220).mul(precision);
    await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, tokenAPoolQty, tokenBPoolQty);
    const tokenBeforeQty = await swapV2.getPairQty(); 
    expect(Number(tokenBeforeQty[0])).to.be.equals(tokenAPoolQty);
    const addTokenAQty = BigNumber.from(100).mul(precision);
    await expect(swapV2.swapToken(zeroAddress, tokenAAddress, addTokenAQty)).to.revertedWith("Slippage threshold breached.");
  });

  it("Swap 100 units of token B - breaching slippage  ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const tokenAPoolQty = BigNumber.from(114).mul(precision);
    const tokenBPoolQty = BigNumber.from(220).mul(precision);
    await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, tokenAPoolQty, tokenBPoolQty);
    const tokenBeforeQty = await swapV2.getPairQty(); 
    expect(Number(tokenBeforeQty[1])).to.be.equals(tokenBPoolQty);
    const addTokenBQty = BigNumber.from(100).mul(precision);
    await expect(swapV2.swapToken(zeroAddress, tokenBAddress, addTokenBQty)).to.revertedWith("Slippage threshold breached.");
  });

  it("Remove liquidity to the pool by removing 5 units of lpToken  ", async function () {
    const { swapV2, lpTokenCont } = await loadFixture(deployFixture);
    await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, precision.mul(100), precision.mul(100));
    const tokenBeforeQty = await swapV2.getPairQty();
    expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
    expect(tokenBeforeQty[1]).to.be.equals(precision.mul(100));

    const allLPToken = await lpTokenCont.getAllLPTokenCount();
    expect(allLPToken).to.be.equals(10);

    const tx = await swapV2.removeLiquidity(zeroAddress, 5);
    await tx.wait();

    const userlpToken =  await lpTokenCont.lpTokenForUser(zeroAddress);
    expect(userlpToken).to.be.equals(10);

    const tokenQty =  await swapV2.getPairQty();
    expect(tokenQty[0]).to.be.equals(precision.mul(50));
    expect(tokenQty[1]).to.be.equals(precision.mul(50));
  });

  it("Add liquidity to the pool by adding 50 units of token and 50 units of token B  ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const tx = await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, precision.mul(50), precision.mul(50));
    await tx.wait();
    const tokenQty =  await swapV2.getPairQty();
    expect(tokenQty[0]).to.be.equals(precision.mul(50));
    expect(tokenQty[1]).to.be.equals(precision.mul(50));
  });

  describe("When HTS gives failure response",  async () => {

    it("Contract gives 100 as qty for tokens ", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, precision.mul(100), precision.mul(100));
      const qtys = await swapV2.getPairQty();
      expect(qtys[0]).to.be.equals(precision.mul(100));
      expect(qtys[1]).to.be.equals(precision.mul(100));
    });

    it("Passing unknown A token to swap", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(swapV2.swapToken(zeroAddress, zeroAddress, 30)).to.revertedWith("Pls pass correct token to swap.");
    });

    it("Passing unknown B token to swap", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(swapV2.swapToken(zeroAddress, zeroAddress, 30)).to.revertedWith("Pls pass correct token to swap.");
    });

    //----------------------------------------------------------------------
    it("Swap Token A with Fail A transfer", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, precision.mul(100), precision.mul(100));
      const tokenBeforeQty = await swapV2.getPairQty();
      await expect(swapV2.swapToken(zeroAddress, tokenAAddress, 30)).to.revertedWith("swapTokenA: Transferring token A to contract failed with status code");
    });

    //----------------------------------------------------------------------

    it("Swap Token A with Fail B transfer", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(2);
      const totalQtyA = precision.mul(1000);
      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, totalQtyA, precision.mul(50));
      const tokenBeforeQty = await swapV2.getPairQty();

      expect(tokenBeforeQty[0]).to.be.equals(totalQtyA);
      await expect(swapV2.swapToken(zeroAddress, tokenAAddress, precision.mul(1))).to.revertedWith("swapTokenA: Transferring token B to user failed with status code");
    });

    //----------------------------------------------------------------------
    it("Swap Token B with Fail B transfer", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(12);
      const totalQtyA = precision.mul(1000);
      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, totalQtyA, precision.mul(1000));
      const tokenBeforeQty = await swapV2.getPairQty(); 
      expect(Number(tokenBeforeQty[0])).to.be.equals(precision.mul(1000));

      await expect(swapV2.swapToken(zeroAddress, tokenBAddress, precision.mul(1))).to.revertedWith("swapTokenB: Transferring token B to contract failed with status code");
    });

    it("Swap Token B with Fail A transfer", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(9);
      const totalQtyA = precision.mul(1000);
      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, totalQtyA, precision.mul(1000));
      const tokenBeforeQty = await swapV2.getPairQty(); 
      expect(Number(tokenBeforeQty[0])).to.be.equals(precision.mul(1000));
      await expect(swapV2.swapToken(zeroAddress, tokenBAddress, precision.mul(1))).to.revertedWith("swapTokenB: Transferring token A to user failed with status code");
    });

    //----------------------------------------------------------------------
    it("Add liquidity Fail A Transfer", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(7);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 30, 30)).to.revertedWith("Add liquidity: Transfering token A to contract failed with status code");
    });

    it("Add liquidity Fail B Transfer", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(4);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 30, 30)).to.revertedWith("Add liquidity: Transfering token B to contract failed with status code");
    });

    //----------------------------------------------------------------------
    it("Remove liquidity Fail A Transfer", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(8);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(swapV2.removeLiquidity(zeroAddress, 5)).to.revertedWith("Remove liquidity: Transferring token A to contract failed with status code");
    });

    it("Remove liquidity Fail B Transfer", async function () {
      const { swapV2, mockBaseHTS, lpTokenCont } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(5);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(swapV2.removeLiquidity(zeroAddress, 5)).to.revertedWith("Remove liquidity: Transferring token B to contract failed with status code");
    });

    it("Remove liquidity Fail not sufficient tokens", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(5);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(swapV2.removeLiquidity(zeroAddress, 110)).to.revertedWith("user does not have sufficient lpTokens");
    });

    it("Add liquidity Fail Minting", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(10);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 30, 30)).to.revertedWith("Mint Failed");
    });

    it("Add liquidity Transfer LPToken Fail", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(11);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 30, 30)).to.revertedWith("LP token transfer failed.");
    });

    it("allotLPToken fail for zero token count", async function () {
      const { swapV2, mockBaseHTS, lpTokenCont } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(11);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(lpTokenCont.allotLPTokenFor(0, 10, zeroAddress)).to.revertedWith("Please provide positive token counts");
    });

    it("LPToken creation failed while initialize LP contract.", async function () {
      const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
      const mockBaseHTS = await MockBaseHTS.deploy(false, false);
      await mockBaseHTS.setFailType(13);

      const LpTokenCont = await ethers.getContractFactory("LPToken");
      await expect(upgrades.deployProxy(LpTokenCont, [mockBaseHTS.address])).to.revertedWith("Token creation failed.");
    });

    it("removeLPTokenFor fail for less lp Token", async function () {
      const { swapV2, lpTokenCont } = await loadFixture(deployFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(lpTokenCont.removeLPTokenFor(130, zeroAddress)).to.revertedWith("User Does not have lp amount");
    });

    it("allotLPToken check LP Tokens", async function () {
      const { swapV2, lpTokenCont } = await loadFixture(deployFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await lpTokenCont.allotLPTokenFor(10, 10, userAddress);
      const result = await lpTokenCont.lpTokenForUser(userAddress);
      await expect(result).to.equal(10);
    });
  });

  describe("Swap Base Constant Product Algorithm Tests",  async () => {
    it("Check spot price for tokens A", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 100, 50);
      const value = await swapV2.getSpotPrice();

      expect(value).to.be.equals(20000000);
    });

    it("Check spot price for tokens B", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 50, 100);
      const value = await swapV2.getSpotPrice();

      expect(value).to.be.equals(5000000);
    });

    it("Check spot price for tokens with reverse", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 100, 200);
      const value = await swapV2.getSpotPrice();

      expect(value).to.be.equals(5000000);
    });

    it("check get out given In price value without precision", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 24, 16);
      const value = await swapV2.getOutGivenIn(10);

      expect(value).to.be.equals(5);
    });

    it("check get in given out price value without precision", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 24, 16);
      const value = await swapV2.getInGivenOut(11);

      expect(value).to.be.equals(52);
    });

    it("check spot price by multiplying with precision value", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const precisionValue = await swapV2.getPrecisionValue()
      const tokenAQ = 134.0293628 * Number(precisionValue);
      const tokenBQ = 187.5599813 * Number(precisionValue);

      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, tokenAQ, tokenBQ);
      const value = await swapV2.getSpotPrice();

      expect(Number(value)).to.be.equals(Number(7145946));
    });

    it("check spot price for front end", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const precisionValue = await swapV2.getPrecisionValue()
      const tokenAQ = 134.0293628 * Number(precisionValue);
      const tokenBQ = 187.5599813 * Number(precisionValue);

      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, tokenAQ, tokenBQ);
      const value = await swapV2.getSpotPrice();
      const output = Number(value) / Number(precisionValue);

      expect(output).to.be.equals(0.7145946);
    });

    it("check spot price for big number", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const tokenAQ = BigNumber.from("29362813400293628");
      const tokenBQ = BigNumber.from("55998131875599813");
      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, tokenAQ, tokenBQ);
      const value = await swapV2.getSpotPrice();
      expect(Number(value)).to.be.equals(Number(5243534));
    });

    it("check precision value", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const value = await swapV2.getPrecisionValue();
      expect(Number(value)).to.be.equals(Number(10000000));
    });

    it("check getOutGivenIn for big number with precision", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const precision = await swapV2.getPrecisionValue();
      const tokenAQ = BigNumber.from(24).mul(precision);
      const tokenBQ = BigNumber.from(16).mul(precision);
      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, tokenAQ, tokenBQ);
      const deltaAQty = BigNumber.from(10).mul(precision);
      const value = await swapV2.getOutGivenIn(deltaAQty);

      expect(Number(value)).to.be.equals(Number(47058824));
    });

    it("check getInGivenOut for big number with precision", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const tokenAQ = BigNumber.from("114").mul(precision);
      const tokenBQ = BigNumber.from("220").mul(precision);
      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, tokenAQ, tokenBQ);
      const value = await swapV2.getInGivenOut(BigNumber.from("1").mul(precision));
      const valueWithoutPrecision = Number(value)/Number(precision);
      expect(valueWithoutPrecision).to.be.equals(0.5205479);
    });
  });

  describe("Slippage test cases",  async () => {

    it("Verify default slippage", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const value = await swapV2.getSlippage();
      const tmp = Number(precision);
      const v = tmp * 0.005;
      expect(value).to.be.equals(v);
    });

    it("Verify slippage update", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      await swapV2.setSlippage(6);
      const value = await swapV2.getSlippage();
      expect(value).to.be.equals(6);
    });

    it("Verify slippageOutGivenIn ", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const tokenAPoolQty = BigNumber.from(114).mul(precision);
      const tokenBPoolQty = BigNumber.from(220).mul(precision);
      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, tokenAPoolQty, tokenBPoolQty);
      const deltaAQty = BigNumber.from(1).mul(precision);
      const slippage = await swapV2.slippageOutGivenIn(deltaAQty);
      const slippageWithoutPrecision = Number(slippage)/Number(precision);
      expect(slippageWithoutPrecision).to.be.equals(0.0086956);
    });

    it("Verify slippageInGivenOut ", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const tokenAPoolQty = BigNumber.from(114).mul(precision);
      const tokenBPoolQty = BigNumber.from(220).mul(precision);
      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, tokenAPoolQty, tokenBPoolQty);
      const deltaBQty = BigNumber.from(1).mul(precision);
      const slippage = await swapV2.slippageInGivenOut(deltaBQty);
      const slippageWithoutPrecision = Number(slippage)/Number(precision);
      expect(slippageWithoutPrecision).to.be.equals(0.0045661);
    });
  });

  describe("Mirror Node API requirement test cases",  async () => {
  
    it("Get Token Pair address", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const value = await swapV2.getTokenPairAddress();
      expect(value[0]).to.be.equals(tokenAAddress);
      expect(value[1]).to.be.equals(tokenBAddress);
    });
  });

  describe("fee test cases",  async () => {
    it("get fee value", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const value = await swapV2.getFee();
      const valueWithoutPrecision = Number(value);
      expect(Number(valueWithoutPrecision)).to.be.equals(Number(1));

    });

    it("get token quantity from fee", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const tokenAPoolQty = BigNumber.from(10).mul(precision);
      await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, tokenAPoolQty, 10);
      const value = await swapV2.feeForToken(tokenAPoolQty);
      expect(value).to.be.equals(Number(500000));

    });
  });
})

