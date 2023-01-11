// Commenting test as contract has dependency on HTS service which we need to mock somehow.
import { expect } from "chai";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";

describe("All Tests", function () {
  const tokenBAddress = "0x0000000000000000000000000000000000010001";
  let tokenAAddress = "0x0000000000000000000000000000000000020002";
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
      const instance = await upgrades.deployProxy(Swap, [
        zeroAddress,
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        treasury,
        fee,
      ]);
      await instance.deployed();
    });
  });

  async function deployFixture() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(false, tokenCAddress);

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(10, 10);
    const token1Address = tokenCont.address;

    const TokenCont1 = await ethers.getContractFactory("ERC20Mock");
    const tokenCont1 = await TokenCont1.deploy(10, 10);
    const token2Address = tokenCont1.address;

    const LpTokenCont = await ethers.getContractFactory("LPToken");
    const lpTokenCont = await upgrades.deployProxy(LpTokenCont, [
      mockBaseHTS.address,
    ]);
    await lpTokenCont.deployed();

    const SwapV2 = await ethers.getContractFactory("Pair");
    const swapV2 = await upgrades.deployProxy(SwapV2, [
      mockBaseHTS.address,
      lpTokenCont.address,
      token1Address,
      token2Address,
      treasury,
      fee,
    ]);
    await swapV2.deployed();

    precision = await swapV2.getPrecisionValue();

    const Factory = await ethers.getContractFactory("Factory");
    const factory = await Factory.deploy();

    return {
      swapV2,
      mockBaseHTS,
      lpTokenCont,
      factory,
      token1Address,
      token2Address,
    };
  }

  async function deployFixtureHBARX() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(false, tokenCAddress);
    const signers = await ethers.getSigners();

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(10, 10);

    const LpTokenCont = await ethers.getContractFactory("LPToken");
    const lpTokenCont = await upgrades.deployProxy(LpTokenCont, [
      mockBaseHTS.address,
    ]);
    await lpTokenCont.deployed();

    const SwapV2 = await ethers.getContractFactory("Pair");
    const swapV2 = await upgrades.deployProxy(SwapV2, [
      mockBaseHTS.address,
      lpTokenCont.address,
      tokenAAddress,
      tokenCAddress,
      treasury,
      fee,
    ]);
    await swapV2.deployed();

    precision = await swapV2.getPrecisionValue();

    const Factory = await ethers.getContractFactory("Factory");
    const factory = await Factory.deploy();

    return { swapV2, mockBaseHTS, lpTokenCont, factory, signers };
  }

  async function deployFailureFixture() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(false, tokenCAddress);

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(10, 10);

    const LpTokenCont = await ethers.getContractFactory("LPToken");
    const lpTokenCont = await upgrades.deployProxy(LpTokenCont, [
      mockBaseHTS.address,
    ]);
    await lpTokenCont.deployed();

    const SwapV2 = await ethers.getContractFactory("Pair");
    const swapV2 = await upgrades.deployProxy(SwapV2, [
      mockBaseHTS.address,
      lpTokenCont.address,
      tokenAAddress,
      tokenBAddress,
      treasury,
      fee,
    ]);
    await swapV2.deployed();

    precision = await swapV2.getPrecisionValue();

    return { swapV2, mockBaseHTS, lpTokenCont };
  }

  it("Add liquidity to the pool by adding 50 units of HBAR and 50 units of token B  ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const tx = await swapV2.addLiquidity(
      zeroAddress,
      tokenAAddress,
      tokenBAddress,
      precision.mul(50),
      precision.mul(50)
    );
    await tx.wait();
    const tokenQty = await swapV2.getPairQty();
    expect(tokenQty[0]).to.be.equals(precision.mul(50));
    expect(tokenQty[1]).to.be.equals(precision.mul(50));
  });

  it("Add liquidity for HBAR", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const tx = await swapV2.addLiquidity(
      zeroAddress,
      tokenAAddress,
      tokenCAddress,
      precision.mul(50),
      precision.mul(50),
      {
        value: ethers.utils.parseEther("0.0000000050"),
      }
    );
    await tx.wait();
    const tokenQty = await swapV2.getPairQty();
    expect(tokenQty[0]).to.be.equals(precision.mul(50));
    expect(tokenQty[1]).to.be.equals(precision.mul(50));
  });

  it("Add liquidity for HBAR fail", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    await expect(
      swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenCAddress,
        precision.mul(50),
        precision.mul(50),
        {
          value: ethers.utils.parseEther("0.0000000030"),
        }
      )
    ).to.revertedWith("Please pass valid Hbars");
  });

  it("Swap 1 units of token HBAR  ", async function () {
    const { swapV2, signers } = await loadFixture(deployFixtureHBARX);
    const tokenAPoolQty = BigNumber.from(200).mul(precision);
    const tokenCPoolQty = BigNumber.from(220).mul(precision);
    await swapV2.addLiquidity(
      signers[0].address,
      tokenAAddress,
      tokenCAddress,
      tokenAPoolQty,
      tokenCPoolQty,
      {
        value: ethers.utils.parseEther("0.0000000220"),
      }
    );
    const tokenBeforeQty = await swapV2.getPairQty();
    expect(Number(tokenBeforeQty[0])).to.be.equals(tokenAPoolQty);
    var addTokenAQty = BigNumber.from(1).mul(precision);
    const feeForTokenA = await swapV2.feeForToken(addTokenAQty);
    const addTokenAQtyAfterFee =
      Number(addTokenAQty) - Number(feeForTokenA) / 2;
    const tx = await swapV2.swapToken(zeroAddress, tokenAAddress, addTokenAQty);
    await tx.wait();

    const tokenQty = await swapV2.getPairQty();
    expect(tokenQty[0]).to.be.equals(tokenAPoolQty.add(addTokenAQtyAfterFee));
    const feeForTokenB = await swapV2.feeForToken(tokenQty[1]);
    const tokenBResultantQtyAfterFee =
      Number(tokenQty[1]) - Number(feeForTokenB);
    const tokenBResultantQty =
      Number(tokenBResultantQtyAfterFee) / Number(precision);
    expect(tokenBResultantQty).to.be.equals(217.81637026);
  });

  describe("Factory Contract positive Tests", async () => {
    it("Check createPair method", async function () {
      const { factory, mockBaseHTS } = await loadFixture(deployFixture);
      await factory.setUpFactory(mockBaseHTS.address);
      await factory.createPair(tokenAAddress, tokenBAddress, treasury, fee);
      const pair1 = await factory.getPair(tokenAAddress, tokenBAddress);
      await factory.createPair(tokenAAddress, tokenBAddress, treasury, fee);
      const pair2 = await factory.getPair(tokenAAddress, tokenBAddress);
      expect(pair1).to.be.equals(pair2);
      const pairs = await factory.getPairs();
      expect(pairs[0]).to.be.equals(pair1);
    });

    it("verify factory initization should be failed for subsequent initization call", async function () {
      const { factory, mockBaseHTS } = await loadFixture(deployFixture);
      await factory.setUpFactory(mockBaseHTS.address);
      await expect(factory.setUpFactory(mockBaseHTS.address)).to.revertedWith(
        "Initializable: contract is already initialized"
      );
    });

    it("Check getPairs method", async function () {
      const { factory, mockBaseHTS } = await loadFixture(deployFixture);
      await factory.setUpFactory(mockBaseHTS.address);
      await factory.createPair(tokenAAddress, tokenBAddress, treasury, fee);
      const pairs = await factory.getPairs();
      expect(pairs.length).to.be.equals(1);
      await factory.createPair(tokenAAddress, tokenCAddress, treasury, fee);
      const pairs2 = await factory.getPairs();
      expect(pairs2.length).to.be.equals(2);
    });

    it("Check For identical Tokens", async function () {
      const { factory, mockBaseHTS } = await loadFixture(deployFixture);
      await factory.setUpFactory(mockBaseHTS.address);
      await expect(
        factory.createPair(tokenAAddress, tokenAAddress, treasury, fee)
      ).to.revertedWith("IDENTICAL_ADDRESSES");
    });

    it("Check For zero Token address", async function () {
      const { factory, mockBaseHTS } = await loadFixture(deployFixture);
      await factory.setUpFactory(mockBaseHTS.address);
      await expect(
        factory.createPair(newZeroAddress, tokenAAddress, treasury, fee)
      ).to.revertedWith("ZERO_ADDRESS");
    });

    it("Check getPair method", async function () {
      const { factory, mockBaseHTS } = await loadFixture(deployFixture);
      await factory.setUpFactory(mockBaseHTS.address);
      await factory.createPair(tokenAAddress, tokenBAddress, treasury, fee);
      const pair = await factory.getPair(tokenAAddress, tokenBAddress);
      expect(pair).to.be.not.equal(zeroAddress);
    });
  });

  it("verify pair initization should be failed for subsequent initization call", async function () {
    const { swapV2, mockBaseHTS, lpTokenCont } = await loadFixture(
      deployFixture
    );
    await expect(
      swapV2.initialize(
        mockBaseHTS.address,
        lpTokenCont.address,
        tokenAAddress,
        tokenBAddress,
        treasury,
        fee
      )
    ).to.revertedWith("Initializable: contract is already initialized");
  });

  it("verify pair addresses count", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const items = await swapV2.getPair();
    expect(items.length).to.be.equals(2);
  });

  it("verify contract address is non-empty", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const address = await swapV2.getContractAddress();
    expect(address).to.not.equals("");
  });

  it("Create a token pair with 0 unit each ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const qtys = await swapV2.getPairQty();
    expect(qtys[0]).to.be.equals(precision.mul(0));
    expect(qtys[1]).to.be.equals(precision.mul(0));
  });

  it("Swap 1 units of token A  ", async function () {
    const { swapV2, token1Address, token2Address } = await loadFixture(
      deployFixture
    );
    const tokenAPoolQty = BigNumber.from(200).mul(precision);
    const tokenBPoolQty = BigNumber.from(220).mul(precision);
    await swapV2.addLiquidity(
      zeroAddress,
      token1Address,
      token2Address,
      tokenAPoolQty,
      tokenBPoolQty
    );
    const tokenBeforeQty = await swapV2.getPairQty();
    expect(Number(tokenBeforeQty[0])).to.be.equals(tokenAPoolQty);
    var addTokenAQty = BigNumber.from(1).mul(precision);
    const feeForTokenA = await swapV2.feeForToken(addTokenAQty);
    const addTokenAQtyAfterFee =
      Number(addTokenAQty) - Number(feeForTokenA) / 2;
    const tx = await swapV2.swapToken(zeroAddress, token1Address, addTokenAQty);
    await tx.wait();

    const tokenQty = await swapV2.getPairQty();
    expect(tokenQty[0]).to.be.equals(tokenAPoolQty.add(addTokenAQtyAfterFee));
    const feeForTokenB = await swapV2.feeForToken(tokenQty[1]);
    const tokenBResultantQtyAfterFee =
      Number(tokenQty[1]) - Number(feeForTokenB);
    const tokenBResultantQty =
      Number(tokenBResultantQtyAfterFee) / Number(precision);
    expect(tokenBResultantQty).to.be.equals(217.81637026);
  });

  it("Swap 1 units of token B  ", async function () {
    const { swapV2, token1Address, token2Address } = await loadFixture(
      deployFixture
    );
    const tokenAPoolQty = BigNumber.from(114).mul(precision);
    const tokenBPoolQty = BigNumber.from(220).mul(precision);
    await swapV2.addLiquidity(
      zeroAddress,
      token1Address,
      token2Address,
      tokenAPoolQty,
      tokenBPoolQty
    );
    const tokenBeforeQty = await swapV2.getPairQty();
    expect(Number(tokenBeforeQty[1])).to.be.equals(tokenBPoolQty);
    const addTokenBQty = BigNumber.from(1).mul(precision);
    const feeForTokenB = await swapV2.feeForToken(addTokenBQty);
    const addTokenBQtyAfterFee =
      Number(addTokenBQty) - Number(feeForTokenB) / 2;
    const tx = await swapV2.swapToken(zeroAddress, token2Address, addTokenBQty);
    await tx.wait();

    const tokenQty = await swapV2.getPairQty();
    expect(tokenQty[1]).to.be.equals(tokenBPoolQty.add(addTokenBQtyAfterFee));
    // const tokenAResultantQty = Number(tokenQty[0])/Number(precision);
    const feeForTokenA = await swapV2.feeForToken(tokenQty[0]);
    const tokenAResultantQtyAfterFee =
      Number(tokenQty[0]) - Number(feeForTokenA);
    const tokenAResultantQty =
      Number(tokenAResultantQtyAfterFee) / Number(precision);
    expect(tokenAResultantQty).to.be.equals(112.91464718);
  });

  it("Swap 100 units of token A - breaching slippage  ", async function () {
    const { swapV2, token1Address, token2Address } = await loadFixture(
      deployFixture
    );
    const tokenAPoolQty = BigNumber.from(200).mul(precision);
    const tokenBPoolQty = BigNumber.from(220).mul(precision);
    await swapV2.addLiquidity(
      zeroAddress,
      token1Address,
      token2Address,
      tokenAPoolQty,
      tokenBPoolQty
    );
    const tokenBeforeQty = await swapV2.getPairQty();
    expect(Number(tokenBeforeQty[0])).to.be.equals(tokenAPoolQty);
    const addTokenAQty = BigNumber.from(100).mul(precision);
    await expect(
      swapV2.swapToken(zeroAddress, token1Address, addTokenAQty)
    ).to.revertedWith("Slippage threshold breached.");
  });

  it("Swap 100 units of token B - breaching slippage  ", async function () {
    const { swapV2, token1Address, token2Address } = await loadFixture(
      deployFixture
    );
    const tokenAPoolQty = BigNumber.from(114).mul(precision);
    const tokenBPoolQty = BigNumber.from(220).mul(precision);
    await swapV2.addLiquidity(
      zeroAddress,
      token1Address,
      token2Address,
      tokenAPoolQty,
      tokenBPoolQty
    );
    const tokenBeforeQty = await swapV2.getPairQty();
    expect(Number(tokenBeforeQty[1])).to.be.equals(tokenBPoolQty);
    const addTokenBQty = BigNumber.from(100).mul(precision);
    await expect(
      swapV2.swapToken(zeroAddress, token2Address, addTokenBQty)
    ).to.revertedWith("Slippage threshold breached.");
  });

  it("Remove liquidity to the pool by removing 5 units of lpToken  ", async function () {
    const { swapV2, lpTokenCont } = await loadFixture(deployFixture);
    await swapV2.addLiquidity(
      zeroAddress,
      tokenAAddress,
      tokenBAddress,
      precision.mul(100),
      precision.mul(100)
    );
    const tokenBeforeQty = await swapV2.getPairQty();
    expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
    expect(tokenBeforeQty[1]).to.be.equals(precision.mul(100));

    const allLPToken = await lpTokenCont.getAllLPTokenCount();
    expect(allLPToken).to.be.equals(10);

    const tx = await swapV2.removeLiquidity(zeroAddress, 5);
    await tx.wait();

    const userlpToken = await lpTokenCont.lpTokenForUser(zeroAddress);
    expect(userlpToken).to.be.equals(10);

    const tokenQty = await swapV2.getPairQty();
    expect(tokenQty[0]).to.be.equals(precision.mul(50));
    expect(tokenQty[1]).to.be.equals(precision.mul(50));
  });

  it("Add liquidity to the pool by adding 50 units of token and 50 units of token B  ", async function () {
    const { swapV2 } = await loadFixture(deployFixture);
    const tx = await swapV2.addLiquidity(
      zeroAddress,
      tokenAAddress,
      tokenBAddress,
      precision.mul(50),
      precision.mul(50)
    );
    await tx.wait();
    const tokenQty = await swapV2.getPairQty();
    expect(tokenQty[0]).to.be.equals(precision.mul(50));
    expect(tokenQty[1]).to.be.equals(precision.mul(50));
  });

  describe("When HTS gives failure response", async () => {
    it("Contract gives 100 as qty for tokens ", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        precision.mul(100),
        precision.mul(100)
      );
      const qtys = await swapV2.getPairQty();
      expect(qtys[0]).to.be.equals(precision.mul(100));
      expect(qtys[1]).to.be.equals(precision.mul(100));
    });

    it("Passing unknown A token to swap", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(
        swapV2.swapToken(zeroAddress, zeroAddress, 30)
      ).to.revertedWith("Pls pass correct token to swap.");
    });

    it("Passing unknown B token to swap", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(
        swapV2.swapToken(zeroAddress, zeroAddress, 30)
      ).to.revertedWith("Pls pass correct token to swap.");
    });

    //----------------------------------------------------------------------
    it("Swap Token A with Fail A transfer", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        precision.mul(100),
        precision.mul(100)
      );
      await mockBaseHTS.setPassTransactionCount(0);
      await expect(
        swapV2.swapToken(zeroAddress, tokenAAddress, 30)
      ).to.revertedWith(
        "swapTokenA: Transferring token A to contract failed with status code"
      );
    });

    //----------------------------------------------------------------------

    it("Swap Token A with Fail B transfer", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      const totalQtyA = precision.mul(1000);
      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        totalQtyA,
        precision.mul(50)
      );
      const tokenBeforeQty = await swapV2.getPairQty();

      expect(tokenBeforeQty[0]).to.be.equals(totalQtyA);
      mockBaseHTS.setPassTransactionCount(2);
      await expect(
        swapV2.swapToken(zeroAddress, tokenAAddress, precision.mul(1))
      ).to.revertedWith(
        "swapTokenA: Transferring token B to user failed with status code"
      );
    });

    //----------------------------------------------------------------------
    it("Swap Token B with Fail B transfer", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      const totalQtyA = precision.mul(1000);
      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        totalQtyA,
        precision.mul(1000)
      );
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(Number(tokenBeforeQty[0])).to.be.equals(precision.mul(1000));
      mockBaseHTS.setPassTransactionCount(0);
      await expect(
        swapV2.swapToken(zeroAddress, tokenBAddress, precision.mul(1))
      ).to.revertedWith(
        "swapTokenB: Transferring token B to contract failed with status code"
      );
    });

    it("Swap Token B with Fail A transfer", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      const totalQtyA = precision.mul(1000);
      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        totalQtyA,
        precision.mul(1000)
      );
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(Number(tokenBeforeQty[0])).to.be.equals(precision.mul(1000));
      mockBaseHTS.setPassTransactionCount(2);
      await expect(
        swapV2.swapToken(zeroAddress, tokenBAddress, precision.mul(1))
      ).to.revertedWith(
        "swapTokenB: Transferring token A to user failed with status code"
      );
    });

    //----------------------------------------------------------------------
    it("Add liquidity Fail A Transfer", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setPassTransactionCount(2);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(
        swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 30, 30)
      ).to.revertedWith(
        "Add liquidity: Transfering token A to contract failed with status code"
      );
    });

    it("Add liquidity Fail B Transfer", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      mockBaseHTS.setPassTransactionCount(3);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(
        swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 30, 30)
      ).to.revertedWith(
        "Add liquidity: Transfering token B to contract failed with status code"
      );
    });

    //----------------------------------------------------------------------
    it("verify remove liquidity should failed when user don't have enough balance ", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        10,
        10
      );
      await expect(swapV2.removeLiquidity(zeroAddress, 11)).to.revertedWith(
        "user does not have sufficient lpTokens"
      );
    });

    it("Remove liquidity Fail A Transfer", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      mockBaseHTS.setPassTransactionCount(0);
      await expect(swapV2.removeLiquidity(zeroAddress, 5)).to.revertedWith(
        "Remove liquidity: Transferring token A to contract failed with status code"
      );
    });

    it("Remove liquidity Fail B Transfer", async function () {
      const { swapV2, mockBaseHTS, lpTokenCont } = await loadFixture(
        deployFailureFixture
      );
      mockBaseHTS.setPassTransactionCount(1);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(swapV2.removeLiquidity(zeroAddress, 5)).to.revertedWith(
        "Remove liquidity: Transferring token B to contract failed with status code"
      );
    });

    it("Remove liquidity Fail not sufficient tokens", async function () {
      const { swapV2 } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(swapV2.removeLiquidity(zeroAddress, 110)).to.revertedWith(
        "user does not have sufficient lpTokens"
      );
    });

    it("Add liquidity Fail Minting", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await mockBaseHTS.setPassTransactionCount(5);
      await expect(
        swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 30, 30)
      ).to.revertedWith("LP token minting failed.");
    });

    it("Add liquidity Transfer LPToken Fail", async function () {
      const { swapV2, mockBaseHTS } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await mockBaseHTS.setPassTransactionCount(6);
      await expect(
        swapV2.addLiquidity(zeroAddress, tokenAAddress, tokenBAddress, 30, 30)
      ).to.revertedWith("LPToken: token transfer failed from contract.");
    });

    it("allotLPToken fail for zero token count", async function () {
      const { swapV2, lpTokenCont } = await loadFixture(deployFailureFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(
        lpTokenCont.allotLPTokenFor(0, 10, zeroAddress)
      ).to.revertedWith("Please provide positive token counts");
    });

    it("LPToken creation failed while initialize LP contract.", async function () {
      const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
      const mockBaseHTS = await MockBaseHTS.deploy(false, newZeroAddress);

      const LpTokenCont = await ethers.getContractFactory("LPToken");
      await mockBaseHTS.setPassTransactionCount(0);
      await expect(
        upgrades.deployProxy(LpTokenCont, [mockBaseHTS.address])
      ).to.revertedWith("LPToken: Token creation failed.");
    });

    it("removeLPTokenFor fail for less lp Token", async function () {
      const { swapV2, lpTokenCont } = await loadFixture(deployFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(
        lpTokenCont.removeLPTokenFor(130, zeroAddress)
      ).to.revertedWith("User Does not have lp amount");
    });

    it("verify removeLPTokenFor call should failed when given amount is <= 0", async function () {
      const { lpTokenCont } = await loadFixture(deployFixture);
      await expect(
        lpTokenCont.removeLPTokenFor(0, zeroAddress)
      ).to.revertedWith("Please provide token counts");
    });

    it("verify removeLPTokenFor call should failed during transfer-token call", async function () {
      const { mockBaseHTS, lpTokenCont } = await loadFixture(deployFixture);
      await lpTokenCont.allotLPTokenFor(10, 10, userAddress);
      await mockBaseHTS.setPassTransactionCount(0);
      await expect(
        lpTokenCont.removeLPTokenFor(5, userAddress)
      ).to.revertedWith("LPToken: token transfer failed to contract.");
    });

    it("verify removeLPTokenFor call should failed during burn-token call", async function () {
      const { mockBaseHTS, lpTokenCont } = await loadFixture(deployFixture);
      await lpTokenCont.allotLPTokenFor(10, 10, userAddress);
      await mockBaseHTS.setPassTransactionCount(1);
      await expect(
        lpTokenCont.removeLPTokenFor(5, userAddress)
      ).to.revertedWith("LP token burn failed.");
    });

    it("allotLPToken check LP Tokens", async function () {
      const { swapV2, lpTokenCont } = await loadFixture(deployFixture);
      const tokenBeforeQty = await swapV2.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await lpTokenCont.allotLPTokenFor(10, 10, userAddress);
      const result = await lpTokenCont.lpTokenForUser(userAddress);
      await expect(result).to.equal(10);
    });

    it("verify allotLPToken call when lptoken not exist", async function () {
      const LPToken = await ethers.getContractFactory("LPToken");
      const instance = await LPToken.deploy();
      await expect(
        instance.allotLPTokenFor(10, 10, userAddress)
      ).to.revertedWith("Liquidity Token not initialized");
    });

    it("verify that lptoken address exist", async function () {
      const { lpTokenCont } = await loadFixture(deployFixture);
      const address = await lpTokenCont.getLpTokenAddress();
      expect(address).to.not.equals("");
    });

    it("verify that lpToken initization failed for subsequent initization call", async function () {
      const { lpTokenCont, mockBaseHTS } = await loadFixture(deployFixture);
      await expect(lpTokenCont.initialize(mockBaseHTS.address)).to.revertedWith(
        "Initializable: contract is already initialized"
      );
    });
  });

  describe("Swap Base Constant Product Algorithm Tests", async () => {
    it("Check spot price for tokens A", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        100,
        50
      );
      const value = await swapV2.getSpotPrice();

      expect(value).to.be.equals(200000000);
    });

    it("Check spot price for tokens B", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        50,
        100
      );
      const value = await swapV2.getSpotPrice();

      expect(value).to.be.equals(50000000);
    });

    it("Check spot price for tokens with reverse", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        100,
        200
      );
      const value = await swapV2.getSpotPrice();

      expect(value).to.be.equals(50000000);
    });

    it("check get out given In price value without precision", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        24,
        16
      );
      const value = await swapV2.getOutGivenIn(10);

      expect(value).to.be.equals(5);
    });

    it("check get in given out price value without precision", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        24,
        16
      );
      const value = await swapV2.getInGivenOut(11);

      expect(value).to.be.equals(52);
    });

    it("check spot price by multiplying with precision value", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const precisionValue = await swapV2.getPrecisionValue();
      const tokenAQ = 134.0293628 * Number(precisionValue);
      const tokenBQ = 187.5599813 * Number(precisionValue);

      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        tokenAQ,
        tokenBQ
      );
      const value = await swapV2.getSpotPrice();

      expect(Number(value)).to.be.equals(Number(71459466));
    });

    it("check spot price for front end", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const precisionValue = await swapV2.getPrecisionValue();
      const tokenAQ = 134.0293628 * Number(precisionValue);
      const tokenBQ = 187.5599813 * Number(precisionValue);

      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        tokenAQ,
        tokenBQ
      );
      const value = await swapV2.getSpotPrice();
      const output = Number(value) / Number(precisionValue);

      expect(output).to.be.equals(0.71459466);
    });

    it("check spot price for big number", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const tokenAQ = BigNumber.from("29362813400293628");
      const tokenBQ = BigNumber.from("55998131875599813");
      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        tokenAQ,
        tokenBQ
      );
      const value = await swapV2.getSpotPrice();
      expect(Number(value)).to.be.equals(Number(52435344));
    });

    it("check precision value", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const value = await swapV2.getPrecisionValue();
      expect(Number(value)).to.be.equals(Number(100000000));
    });

    it("check getOutGivenIn for big number with precision", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const precision = await swapV2.getPrecisionValue();
      const tokenAQ = BigNumber.from(24).mul(precision);
      const tokenBQ = BigNumber.from(16).mul(precision);
      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        tokenAQ,
        tokenBQ,
        {
          value: ethers.utils.parseEther("10"),
        }
      );
      const deltaAQty = BigNumber.from(10).mul(precision);
      const value = await swapV2.getOutGivenIn(deltaAQty);

      expect(Number(value)).to.be.equals(Number(470588236));
    });

    it("check getInGivenOut for big number with precision", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const tokenAQ = BigNumber.from("114").mul(precision);
      const tokenBQ = BigNumber.from("220").mul(precision);
      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        tokenAQ,
        tokenBQ
      );
      const value = await swapV2.getInGivenOut(
        BigNumber.from("1").mul(precision)
      );
      const valueWithoutPrecision = Number(value) / Number(precision);
      expect(valueWithoutPrecision).to.be.equals(0.52054794);
    });
  });

  describe("Slippage test cases", async () => {
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
      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        tokenAPoolQty,
        tokenBPoolQty
      );
      const deltaAQty = BigNumber.from(1).mul(precision);
      const slippage = await swapV2.slippageOutGivenIn(deltaAQty);
      const slippageWithoutPrecision = Number(slippage) / Number(precision);
      expect(slippageWithoutPrecision).to.be.equals(0.00869565);
    });

    it("Verify slippageInGivenOut ", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const tokenAPoolQty = BigNumber.from(114).mul(precision);
      const tokenBPoolQty = BigNumber.from(220).mul(precision);
      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        tokenAPoolQty,
        tokenBPoolQty
      );
      const deltaBQty = BigNumber.from(1).mul(precision);
      const slippage = await swapV2.slippageInGivenOut(deltaBQty);
      const slippageWithoutPrecision = Number(slippage) / Number(precision);
      expect(slippageWithoutPrecision).to.be.equals(0.00456621);
    });
  });

  describe("Mirror Node API requirement test cases", async () => {
    it("Get Token Pair address", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const value = await swapV2.getTokenPairAddress();
      expect(value[0]).to.be.equals(tokenAAddress);
      expect(value[1]).to.be.equals(tokenBAddress);
      expect(value[2]).to.not.be.equals(newZeroAddress);
    });
  });

  describe("fee test cases", async () => {
    it("get fee value", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const value = await swapV2.getFee();
      const valueWithoutPrecision = Number(value);
      expect(Number(valueWithoutPrecision)).to.be.equals(Number(1));
    });

    it("get token quantity from fee", async function () {
      const { swapV2 } = await loadFixture(deployFixture);
      const tokenAPoolQty = BigNumber.from(10).mul(precision);
      await swapV2.addLiquidity(
        zeroAddress,
        tokenAAddress,
        tokenBAddress,
        tokenAPoolQty,
        10
      );
      const value = await swapV2.feeForToken(tokenAPoolQty);
      expect(value).to.be.equals(Number(5000000));
    });
  });
});
