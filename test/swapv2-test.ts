// Commenting test as contract has dependency on HTS service which we need to mock somehow.
import {  expect } from "chai";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";


describe("Swap", function () {
  const tokenBAddress = "0x0000000000000000000000000000000000010001";
  const tokenAAddress = "0x0000000000000000000000000000000000020002";
  const zeroAddress = "0x1111111000000000000000000000000000000000";
  const newZeroAddress = "0x0000000000000000000000000000000000000000";
  const userAddress = "0x0000000000000000000000000000000000020008";
  let precision: BigNumber;

  describe("Swap Upgradeable", function () {
    it("Verify if the Swap contract is upgradeable safe ", async function () {
      const Swap = await ethers.getContractFactory("Pair");
      const instance = await upgrades.deployProxy(Swap, [zeroAddress, zeroAddress], {unsafeAllow: ['delegatecall']});
      await instance.deployed();
    });
  });

  // describe("Factory", function () {
  //   it.only("Testing Factory Contract",async function() {
  //     const Factory = await ethers.getContractFactory("Factory");
  //     const factory = await Factory.deploy();
  //     await factory.deployNew("first User");
  //     const result = await factory.getAllUser();
  //     console.log(result[0]);
  //     expect(result[0]).to.be.equals(22);
  //   })
  // });

  async function deployFixture() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(true);
    mockBaseHTS.setFailType(0);

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy();

    const LpTokenCont = await ethers.getContractFactory("LPTokenTest");
    const lpTokenCont = await LpTokenCont.deploy(tokenCont.address, mockBaseHTS.address);

    const SwapV2 = await ethers.getContractFactory("PairTest");
    const swapV2 = await SwapV2.deploy(mockBaseHTS.address, lpTokenCont.address);
    precision = await swapV2.getPrecisionValue();
    
    const tokenAPoolQty = BigNumber.from(100).mul(precision);
    const tokenBPoolQty = BigNumber.from(100).mul(precision);

    await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, tokenAPoolQty, tokenBPoolQty);
    
    return { swapV2 , mockBaseHTS, lpTokenCont};
  }

  async function deployFailureFixture() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(false);
    await mockBaseHTS.setFailType(0);

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy();

    const LpTokenCont = await ethers.getContractFactory("LPTokenTest");
    const lpTokenCont = await LpTokenCont.deploy(tokenCont.address, mockBaseHTS.address);

    const SwapV2 = await ethers.getContractFactory("PairTest");
    const swapV2 = await SwapV2.deploy(mockBaseHTS.address, lpTokenCont.address);
    precision = await swapV2.getPrecisionValue();

    const tokenAPoolQty = BigNumber.from(100).mul(precision);
    const tokenBPoolQty = BigNumber.from(100).mul(precision);
    
    await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, tokenAPoolQty, tokenBPoolQty);

    return { swapV2, mockBaseHTS, lpTokenCont};
  }

  it("Create a token pair with 100 unit each ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const qtys = await swapV2.getPairQty();
    expect(qtys[0]).to.be.equals(precision.mul(100));
    expect(qtys[1]).to.be.equals(precision.mul(100));
  });

  it("Swap 1 units of token A  ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const tokenAPoolQty = BigNumber.from(200).mul(precision);
    const tokenBPoolQty = BigNumber.from(220).mul(precision);
    await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, tokenAPoolQty, tokenBPoolQty);
    const tokenBeforeQty = await swapV2.getPairQty(); 
    expect(Number(tokenBeforeQty[0])).to.be.equals(tokenAPoolQty);
    const addTokenAQty = BigNumber.from(1).mul(precision);
    const tx = await swapV2.swapToken(zeroAddress, tokenAAddress, zeroAddress, addTokenAQty, 0);
    await tx.wait();
    
    const tokenQty = await swapV2.getPairQty();
    expect(tokenQty[0]).to.be.equals(tokenAPoolQty.add(addTokenAQty));
    const tokenBResultantQty = Number(tokenQty[1])/Number(precision);
    expect(tokenBResultantQty).to.be.equals(218.9054726);
  });

  it("Swap 100 units of token A - breaching slippage  ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const tokenAPoolQty = BigNumber.from(200).mul(precision);
    const tokenBPoolQty = BigNumber.from(220).mul(precision);
    await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, tokenAPoolQty, tokenBPoolQty);
    const tokenBeforeQty = await swapV2.getPairQty(); 
    expect(Number(tokenBeforeQty[0])).to.be.equals(tokenAPoolQty);
    const addTokenAQty = BigNumber.from(100).mul(precision);
    await expect(swapV2.swapToken(zeroAddress, tokenAAddress, zeroAddress, addTokenAQty, 0)).to.revertedWith("Slippage threshold breached.");
  });

  it("Swap 1 units of token B  ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const tokenAPoolQty = BigNumber.from(114).mul(precision);
    const tokenBPoolQty = BigNumber.from(220).mul(precision);
    await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, tokenAPoolQty, tokenBPoolQty);
    const tokenBeforeQty = await swapV2.getPairQty(); 
    expect(Number(tokenBeforeQty[1])).to.be.equals(tokenBPoolQty);
    const addTokenBQty = BigNumber.from(1).mul(precision);
    const tx = await swapV2.swapToken(zeroAddress, zeroAddress, tokenBAddress, 0, addTokenBQty);
    await tx.wait();
    
    const tokenQty = await swapV2.getPairQty();
    expect(tokenQty[1]).to.be.equals(tokenBPoolQty.add(addTokenBQty));
    const tokenAResultantQty = Number(tokenQty[0])/Number(precision);
    expect(tokenAResultantQty).to.be.equals(113.4794521);
  });

  it("Swap 100 units of token B - breaching slippage  ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const tokenAPoolQty = BigNumber.from(114).mul(precision);
    const tokenBPoolQty = BigNumber.from(220).mul(precision);
    await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, tokenAPoolQty, tokenBPoolQty);
    const tokenBeforeQty = await swapV2.getPairQty(); 
    expect(Number(tokenBeforeQty[1])).to.be.equals(tokenBPoolQty);
    const addTokenBQty = BigNumber.from(100).mul(precision);
    await expect(swapV2.swapToken(zeroAddress, zeroAddress, tokenBAddress, 0, addTokenBQty)).to.revertedWith("Slippage threshold breached.");
  });

  it("Remove liquidity to the pool by removing 5 units of lpToken  ", async function () {
    const { swapV2, lpTokenCont } = await loadFixture(deployFixture);
    const tokenBeforeQty = await swapV2.getPairQty();
    expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
    expect(tokenBeforeQty[1]).to.be.equals(precision.mul(100));

    const allLPToken = await lpTokenCont.getAllLPTokenCount();
    expect(allLPToken).to.be.equals(100);

    const tx = await swapV2.removeLiquidity(zeroAddress, 5);
    await tx.wait();

    const userlpToken =  await lpTokenCont.lpTokenForUser(zeroAddress);
    expect(userlpToken).to.be.equals(10);

    const tokenQty =  await swapV2.getPairQty();
    expect(tokenQty[0]).to.be.equals(precision.mul(95));
    expect(tokenQty[1]).to.be.equals(precision.mul(95));
  });

  it("Add liquidity to the pool by adding 50 units of token and 50 units of token B  ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const tokenBeforeQty = await swapV2.getPairQty();
    expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
    expect(tokenBeforeQty[1]).to.be.equals(precision.mul(100));
    const tx = await swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, precision.mul(50), precision.mul(50));
    await tx.wait();
    const tokenQty =  await swapV2.getPairQty();
    expect(tokenQty[0]).to.be.equals(precision.mul(150));
    expect(tokenQty[1]).to.be.equals(precision.mul(150));
  });

  describe("When HTS gives failure response",  async () => {
  
    it("Create a token pair fails with revert exception Transfer A", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(7);
      await expect(swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, 100, 100)).to.revertedWith("Creating contract: Transfering token A to contract failed with status code");
    });
  
    it("Create a token pair fails with revert exception Transfer B ", async function () {
      const { swapV2 , mockBaseHTS} = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(8);
      await expect(swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, 100, 100)).to.revertedWith("Creating contract: Transfering token B to contract failed with status code");
    });
  
    it("Contract gives 100 as qty for tokens ", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      const qtys = await swapV2.getPairQty();
      expect(qtys[0]).to.be.equals(precision.mul(100));
      expect(qtys[1]).to.be.equals(precision.mul(100));
    });

    it("Passing unknown A token to swap", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
      await expect(swapV2.swapToken(zeroAddress, zeroAddress, zeroAddress, 30, 0)).to.revertedWith("Pls pass correct token to swap.");
    });

    it("Passing unknown B token to swap", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
      await expect(swapV2.swapToken(zeroAddress, zeroAddress, zeroAddress, 30, 0)).to.revertedWith("Pls pass correct token to swap.");
    });

    //----------------------------------------------------------------------
    it("Swap Token A with Fail A transfer", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
      await expect(swapV2.swapToken(zeroAddress, tokenAAddress, zeroAddress, 30, 0)).to.revertedWith("swapTokenA: Transferring token A to contract failed with status code");
    });

    it("Swap Token A with Fail passing Both Addresses", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
      await expect(swapV2.swapToken(zeroAddress, tokenAAddress, tokenBAddress, 30, 0)).to.revertedWith("Token A should have correct address and token B address will be ignored.");
    });

    //----------------------------------------------------------------------
  
    it("Swap Token A with Fail B transfer", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(2);
      const totalQtyA = precision.mul(1000);
      await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, totalQtyA, precision.mul(50));
      const tokenBeforeQty = await swapV2.getPairQty();

      expect(tokenBeforeQty[0]).to.be.equals(totalQtyA);
      await expect(swapV2.swapToken(zeroAddress, tokenAAddress, zeroAddress, precision.mul(1), 0)).to.revertedWith("swapTokenA: Transferring token B to contract failed with status code");
    });

    //----------------------------------------------------------------------
    it("Swap Token B with Fail B transfer", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(12);
      const totalQtyA = precision.mul(1000);
      await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, totalQtyA, precision.mul(1000));
      const tokenBeforeQty = await swapV2.getPairQty(); 
      expect(Number(tokenBeforeQty[0])).to.be.equals(precision.mul(1000));

      await expect(swapV2.swapToken(zeroAddress, zeroAddress, tokenBAddress, 0, precision.mul(1))).to.revertedWith("swapTokenB: Transferring token B to contract failed with status code");
    });

    it("Swap Token B with Fail A transfer", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(9);
      const totalQtyA = precision.mul(1000);
      await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, totalQtyA, precision.mul(1000));
      const tokenBeforeQty = await swapV2.getPairQty(); 
      expect(Number(tokenBeforeQty[0])).to.be.equals(precision.mul(1000));
      await expect(swapV2.swapToken(zeroAddress, zeroAddress, tokenBAddress, 0, precision.mul(1))).to.revertedWith("swapTokenB: Transferring token A to contract failed with status code");
    });

    //----------------------------------------------------------------------
    it("Add liquidity Fail A Transfer", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
      await expect(swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 30, 30)).to.revertedWith("Add liquidity: Transfering token A to contract failed with status code");
    });

    it("Add liquidity Fail B Transfer", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(4);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
      await expect(swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 30, 30)).to.revertedWith("Add liquidity: Transfering token B to contract failed with status code");
    });

    //----------------------------------------------------------------------
    it("Remove liquidity Fail A Transfer", async function () {
      const { swapV2, lpTokenCont } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
      await expect(swapV2.removeLiquidity(zeroAddress, 5)).to.revertedWith("Remove liquidity: Transferring token A to contract failed with status code");
    });

    it("Remove liquidity Fail B Transfer", async function () {
      const { swapV2, mockBaseHTS, lpTokenCont } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(5);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
      await expect(swapV2.removeLiquidity(zeroAddress, 5)).to.revertedWith("Remove liquidity: Transferring token B to contract failed with status code");
    });

    it("Remove liquidity Fail not sufficient tokens", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(5);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
      await expect(swapV2.removeLiquidity(zeroAddress, 110)).to.revertedWith("user does not have sufficient lpTokens");
    });

    it("Add liquidity Fail Minting", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(10);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
      await expect(swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 30, 30)).to.revertedWith("Mint Failed");
    });

    it("Add liquidity Transfer LPToken Fail", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(11);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
      await expect(swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 30, 30)).to.revertedWith("LP Token Transfer Fail");
    });

    it("allotLPToken fail for zero token count", async function () {
      const { swapV2, mockBaseHTS, lpTokenCont } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(11);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
      await lpTokenCont.initializeParams(zeroAddress, zeroAddress);
      await expect(lpTokenCont.allotLPTokenFor(0, 10, zeroAddress)).to.revertedWith("Please provide positive token counts");
    });

    it("removeLPTokenFor fail for no lp token", async function () {
      const { swapV2, mockBaseHTS, lpTokenCont } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(11);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
      await lpTokenCont.initializeParams(newZeroAddress, newZeroAddress)
      await expect(lpTokenCont.removeLPTokenFor(10, zeroAddress)).to.revertedWith("Liquidity Token not initialized");
    });

    it("removeLPTokenFor fail for less lp Token", async function () {
      const { swapV2, mockBaseHTS, lpTokenCont } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setFailType(11);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
      await expect(lpTokenCont.removeLPTokenFor(130, zeroAddress)).to.revertedWith("User Does not have lp amount");
    });

    it("allotLPToken check LP Tokens", async function () {
      const { swapV2, mockBaseHTS, lpTokenCont } = await loadFixture(deployFixture);
      mockBaseHTS.setFailType(11);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
      await lpTokenCont.allotLPTokenFor(10, 10, userAddress);
      const result = await lpTokenCont.lpTokenForUser(userAddress);
      await expect(result).to.equal(10);
    });
  });

  describe("Swap Base Constant Product Algorithm Tests",  async () => {
    it("Check spot price for tokens A", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, 100, 50);
      const value = await swapV2.getSpotPrice();

      expect(value).to.be.equals(20000000);
    });

    it("Check spot price for tokens B", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, 50, 100);
      const value = await swapV2.getSpotPrice();

      expect(value).to.be.equals(5000000);
    });

    it("Check spot price for tokens with reverse", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, 100, 200);
      const value = await swapV2.getSpotPrice();

      expect(value).to.be.equals(5000000);
    });

    it("check get out given In price value without precision", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, 24, 16);
      const value = await swapV2.getOutGivenIn(10);

      expect(value).to.be.equals(5);
    });

    it("check get in given out price value without precision", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, 24, 16);
      const value = await swapV2.getInGivenOut(11);

      expect(value).to.be.equals(52);
    });

    it("check spot price by multiplying with precision value", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const precisionValue = await swapV2.getPrecisionValue()
      const tokenAQ = 134.0293628 * Number(precisionValue);
      const tokenBQ = 187.5599813 * Number(precisionValue);

      await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, tokenAQ, tokenBQ);
      const value = await swapV2.getSpotPrice();

      expect(Number(value)).to.be.equals(Number(7145946));
    });

    it("check spot price for front end", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const precisionValue = await swapV2.getPrecisionValue()
      const tokenAQ = 134.0293628 * Number(precisionValue);
      const tokenBQ = 187.5599813 * Number(precisionValue);

      await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, tokenAQ, tokenBQ);
      const value = await swapV2.getSpotPrice();
      const output = Number(value) / Number(precisionValue);

      expect(output).to.be.equals(0.7145946);
    });

    it("check spot price for big number", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const tokenAQ = BigNumber.from("29362813400293628");
      const tokenBQ = BigNumber.from("55998131875599813");
      await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, tokenAQ, tokenBQ);
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
      await swapV2.initializeContract(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        tokenAQ,
        tokenBQ
      );
      const deltaAQty = BigNumber.from(10).mul(precision);
      const value = await swapV2.getOutGivenIn(deltaAQty);

      expect(Number(value)).to.be.equals(Number(47058824));
    });

    it("check getInGivenOut for big number with precision", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const tokenAQ = BigNumber.from("114").mul(precision);
      const tokenBQ = BigNumber.from("220").mul(precision);
      await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, tokenAQ, tokenBQ);
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
      await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, tokenAPoolQty, tokenBPoolQty);
      const deltaAQty = BigNumber.from(1).mul(precision);
      const slippage = await swapV2.slippageOutGivenIn(deltaAQty);
      const slippageWithoutPrecision = Number(slippage)/Number(precision);
      expect(slippageWithoutPrecision).to.be.equals(0.0086956);
    });

    it("Verify slippageInGivenOut ", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const tokenAPoolQty = BigNumber.from(114).mul(precision);
      const tokenBPoolQty = BigNumber.from(220).mul(precision);
      await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, tokenAPoolQty, tokenBPoolQty);
      const deltaBQty = BigNumber.from(1).mul(precision);
      const slippage = await swapV2.slippageInGivenOut(deltaBQty);
      const slippageWithoutPrecision = Number(slippage)/Number(precision);
      expect(slippageWithoutPrecision).to.be.equals(0.0045661);
    });
  });

  describe("Mirror Node API requirement test cases",  async () => {
  
    it("Get Token Pair address", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      await swapV2.initializeContract(zeroAddress, tokenAAddress, tokenBAddress, 50, 100);
      const value = await swapV2.getTokenPairAddress();
      expect(value[0]).to.be.equals(tokenAAddress);
      expect(value[1]).to.be.equals(tokenBAddress);
    });
  });
})

