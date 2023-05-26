// Commenting test as contract has dependency on HTS service which we need to mock somehow.
import { expect } from "chai";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { BigNumber, Contract } from "ethers";
import { Helper } from "../utils/Helper";
import { TestHelper } from "./TestHelper";

describe("LPToken, Pair and Factory tests", function () {
  const tokenBAddress = "0x0000000000000000000000000000000000010001";
  const tokenAAddress = "0x0000000000000000000000000000000000020002";
  const tokenCAddress = "0x0000000000000000000000000000000000020003";
  const zeroAddress = "0x1111111000000000000000000000000000000000";
  const newZeroAddress = "0x0000000000000000000000000000000000000000";
  const userAddress = "0x0000000000000000000000000000000000020008";
  const treasury = "0x0000000000000000000000000000000002d70207";
  let precision: BigNumber;
  const fee = BigNumber.from(1);
  const fee2 = BigNumber.from(2);
  const defaultSlippageInput = BigNumber.from(0);

  async function lpTokenFixture() {
    const signers = await TestHelper.getSigners();
    const hederaService = await TestHelper.deployMockHederaService();
    const LP_TOKEN_ARGS = [
      hederaService.address,
      signers[0].address,
      "LpToken-Name",
      "LpToken-Symbol",
    ];
    const lpTokenContract = await TestHelper.deployLogic("LPToken");
    await lpTokenContract.initialize(...LP_TOKEN_ARGS);
    const lpToken = await TestHelper.getContract(
      "ERC20Mock",
      await lpTokenContract.getLpTokenAddress()
    );
    return {
      hederaService,
      signers,
      lpTokenContract,
      lpToken,
      LP_TOKEN_ARGS,
      user: signers[1],
    };
  }

  async function deployERC20Mock() {
    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(
      "tokenName1",
      "tokenSymbol1",
      10,
      10
    );
    return tokenCont;
  }

  async function deployBasics(
    mockHederaService: any,
    tokenCont: any,
    isLpTokenRequired: boolean,
    configuration: Contract
  ) {
    const signers = await ethers.getSigners();

    const token1Address = tokenCont.address;

    const tokenCont1 = await deployERC20Mock();
    const token2Address = tokenCont1.address;

    const tokenCont2 = await deployERC20Mock();
    const token3Address = tokenCont2.address;
    const pair = await TestHelper.deployLogic("Pair");
    const lpTokenCont = await TestHelper.deployLogic("MockLPToken");

    await lpTokenCont.initialize(
      mockHederaService.address,
      pair.address,
      "tokenName",
      "tokenSymbol"
    );

    await lpTokenCont.deployed();
    const lpToken = await deployERC20Mock();
    if (isLpTokenRequired) {
      await lpTokenCont.setLPToken(lpToken.address);
      await lpToken.setUserBalance(lpTokenCont.address, 100);
    }

    await pair.initialize(
      mockHederaService.address,
      lpTokenCont.address,
      token1Address,
      token2Address,
      treasury,
      fee,
      configuration.address
    );

    precision = await pair.getPrecisionValue();
    await tokenCont.setUserBalance(signers[0].address, precision.mul(1000));
    await tokenCont1.setUserBalance(signers[0].address, precision.mul(1000));

    const Factory = await ethers.getContractFactory("Factory");
    const factory = await Factory.deploy();

    return {
      pair,
      mockHederaService,
      lpTokenCont,
      factory,
      token1Address,
      token2Address,
      signers,
      token3Address,
      lpToken,
      tokenCont,
      tokenCont1,
      configuration,
    };
  }

  async function deployConfiguration(): Promise<Contract> {
    const Configuration = await ethers.getContractFactory("Configuration");
    const configuration = await Configuration.deploy();
    await configuration.initialize();
    return configuration;
  }

  describe("Pair Upgradeable", function () {
    it("Verify if the Pair contract is upgradeable safe ", async function () {
      const mockHederaService = await TestHelper.deployMockHederaService();
      const configuration = await deployConfiguration();
      const Pair = await ethers.getContractFactory("Pair");
      const instance = await upgrades.deployProxy(
        Pair,
        [
          mockHederaService.address,
          zeroAddress,
          tokenAAddress,
          tokenBAddress,
          treasury,
          fee,
          configuration.address,
        ],
        { unsafeAllow: ["delegatecall"] }
      );
      await instance.deployed();
    });
  });

  async function deployFixtureTokenTest() {
    const configuration = await deployConfiguration();
    const mockHederaService = await TestHelper.deployMockHederaService();
    const tokenCont = await deployERC20Mock();
    return deployBasics(mockHederaService, tokenCont, true, configuration);
  }

  async function deployFixture() {
    const configuration = await deployConfiguration();
    const mockHederaService = await TestHelper.deployMockHederaService();
    const tokenCont = await deployERC20Mock();
    return deployBasics(mockHederaService, tokenCont, false, configuration);
  }

  async function deployFixtureHBARX() {
    const configuration = await deployConfiguration();
    const tokenCont = await deployERC20Mock();
    const mockHederaService = await TestHelper.deployMockHederaService();
    await configuration.setHbarxAddress(tokenCont.address);
    return deployBasics(mockHederaService, tokenCont, false, configuration);
  }

  describe("HBAR pool test cases", async function () {
    it("Add liquidity for HBAR", async function () {
      const { pair, token1Address, token2Address } = await loadFixture(
        deployFixtureHBARX
      );
      const tx = await pair.addLiquidity(
        zeroAddress,
        token2Address,
        token1Address,
        precision.mul(50),
        0,
        {
          value: ethers.utils.parseEther("0.0000000050"),
        }
      );
      await tx.wait();
      const tokenQty = await pair.getPairQty();
      expect(tokenQty[0]).to.be.equals(precision.mul(50));
      expect(tokenQty[1]).to.be.equals(precision.mul(50));
    });

    it("Given a pair of HBAR/TOKEN-B exists when user try to swap 1 unit of Hbar then swapped quantities should match the expectation ", async function () {
      const {
        pair,
        signers,
        token1Address: hbarToken,
        token2Address: tokenBAddress,
        tokenCont1: tokenBMockContract,
      } = await loadFixture(deployFixtureHBARX);
      const tokenBPoolQty = BigNumber.from(200).mul(precision);
      const hbars = ethers.utils.parseEther("0.0000000220");

      await pair.addLiquidity(
        signers[0].address,
        hbarToken,
        tokenBAddress,
        0,
        tokenBPoolQty,
        {
          value: hbars,
        }
      );

      const tokenBeforeQty = await pair.getPairQty();
      expect(Number(tokenBeforeQty[1])).to.be.equals(tokenBPoolQty);
      expect(Number(tokenBeforeQty[0])).to.be.equals(hbars);

      const pairAccountBalance = await tokenBMockContract.balanceOf(
        pair.address
      );
      expect(pairAccountBalance).to.be.equals(tokenBeforeQty[1]);

      const addTokenAQty = ethers.utils.parseEther("0.0000000001");

      const { tokenAQtyAfterSubtractingFee, tokenBResultantQty } =
        await quantitiesAfterSwappingTokenA(pair, addTokenAQty);

      const tx = await pair.swapToken(
        signers[0].address,
        hbarToken,
        0,
        1200000,
        {
          value: addTokenAQty,
        }
      );
      await tx.wait();

      const tokenQty = await pair.getPairQty();

      expect(tokenQty[0]).to.be.equals(hbars.add(tokenAQtyAfterSubtractingFee));
      expect(tokenQty[1]).to.be.equals(tokenBPoolQty.sub(tokenBResultantQty));

      const tokenBBalance = await tokenBMockContract.balanceOf(pair.address);
      expect(tokenBBalance).to.be.equals(tokenQty[1]);
    });

    it("Swap 1 units of token HBAR fail ", async function () {
      const { pair, signers, token1Address, token2Address } = await loadFixture(
        deployFixtureHBARX
      );
      const tokenAPoolQty = BigNumber.from(200).mul(precision);
      await pair.addLiquidity(
        signers[0].address,
        token2Address,
        token1Address,
        tokenAPoolQty,
        0,
        {
          value: ethers.utils.parseEther("0.0000000220"),
        }
      );
      const addTokenAQty = BigNumber.from(1).mul(precision);
      await expect(
        pair.swapToken(
          zeroAddress,
          token1Address,
          addTokenAQty,
          defaultSlippageInput,
          {
            value: ethers.utils.parseEther("0.0000000001"),
          }
        )
      ).to.revertedWith("HBARs should be passed as payble");
    });
  });

  const quantitiesAfterSwappingTokenA = async (
    pair: any,
    addTokenAQty: BigNumber
  ) => {
    const result = await pair.getOutGivenIn(addTokenAQty);
    return {
      tokenAQtyAfterSubtractingFee: result[1],
      tokenBResultantQty: Number(result[2]) + Number(result[3]),
    };
  };

  const quantitiesAfterSwappingTokenB = async (
    pair: any,
    addTokenBQty: BigNumber
  ) => {
    const result = await pair.getInGivenOut(addTokenBQty);
    return {
      tokenBQtyAfterSubtractingFee: result[1],
      tokenAResultantQty: Number(result[2]) + Number(result[3]),
    };
  };

  describe("Factory Contract positive Tests", async () => {
    it("Check createPair method, Same Tokens and same fees", async function () {
      const {
        factory,
        mockHederaService,
        signers,
        token1Address,
        token2Address,
        configuration,
        pair,
        lpTokenCont,
      } = await loadFixture(deployFixture);
      // Given
      await factory.setUpFactory(
        mockHederaService.address,
        signers[0].address,
        pair.address,
        lpTokenCont.address,
        configuration.address
      );

      // When
      // we call createPair with same token pair and fees multiple time,
      // and fetch pair after creating
      await factory.createPair(token1Address, token2Address, treasury, fee);
      const pair1 = await factory.getPair(token1Address, token2Address, fee);
      await factory.createPair(token1Address, token2Address, treasury, fee);
      const pair2 = await factory.getPair(token1Address, token2Address, fee);

      // Then
      // The fetched Pair after each creation should be same
      expect(pair1).to.be.equals(pair2);

      // as we created only 1 Token Pair, the first pair in allPairs list should be the fetched pair.
      const pairs = await factory.getPairs();
      expect(pairs[0]).to.be.equals(pair1);
    });

    it("Check createPair method, Same Tokens and different fees", async function () {
      const {
        factory,
        mockHederaService,
        signers,
        token1Address,
        token2Address,
        configuration,
        pair,
        lpTokenCont,
      } = await loadFixture(deployFixture);
      // Given
      await factory.setUpFactory(
        mockHederaService.address,
        signers[0].address,
        pair.address,
        lpTokenCont.address,
        configuration.address
      );

      // When
      // we call createPair with same token pair and different fees multiple time,
      // and fetch pair after creating
      await factory.createPair(token1Address, token2Address, treasury, fee);
      const pair1 = await factory.getPair(token1Address, token2Address, fee);
      await factory.createPair(token1Address, token2Address, treasury, fee2);
      const pair2 = await factory.getPair(token1Address, token2Address, fee2);

      // Then
      // The fetched Pair after each creation should not be same
      expect(pair1).to.not.be.equals(pair2);
      const pairs = await factory.getPairs();
      // as we created 2 Token Pairs, first and second pairs in allPairs list should not be the same.
      expect(pairs[0]).to.not.be.equals(pairs[1]);
    });

    it("When user try to createPair with zero fee then pair creation should fail", async function () {
      const {
        factory,
        mockHederaService,
        signers,
        token1Address,
        token2Address,
        configuration,
        pair,
        lpTokenCont,
      } = await loadFixture(deployFixture);
      // Given
      await factory.setUpFactory(
        mockHederaService.address,
        signers[0].address,
        pair.address,
        lpTokenCont.address,
        configuration.address
      );

      const zeroFee = 0;
      await expect(
        factory.createPair(token1Address, token2Address, treasury, zeroFee)
      ).to.be.revertedWith("Pair: Fee should be greater than zero.");
    });

    describe("Recommended pool for swap tests ", () => {
      it("Given no pool of pair exists when user asks for swap recommendation then no pair should be returned ", async function () {
        const {
          factory,
          mockHederaService,
          signers,
          token1Address,
          token2Address,
          configuration,
          pair,
          lpTokenCont,
        } = await loadFixture(deployFixture);

        await factory.setUpFactory(
          mockHederaService.address,
          signers[0].address,
          pair.address,
          lpTokenCont.address,
          configuration.address
        );

        const tokenSwapResult = await factory.recommendedPairToSwap(
          token1Address,
          token2Address,
          BigNumber.from(10).mul(precision)
        );
        expect(tokenSwapResult[0]).to.be.equals(
          "0x0000000000000000000000000000000000000000"
        );
      });

      it("Given one pool of pair exists when user asks for swap recommendation then that should be returned ", async function () {
        const {
          pair,
          factory,
          mockHederaService,
          signers,
          token1Address,
          token2Address,
          configuration,
          lpTokenCont,
        } = await loadFixture(deployFixture);
        await factory.setUpFactory(
          mockHederaService.address,
          signers[0].address,
          pair.address,
          lpTokenCont.address,
          configuration.address
        );

        const initialFees = Helper.convertToFeeObjectArray(
          await configuration.getTransactionsFee()
        );

        const poolFee = initialFees[0].value;

        await factory.createPair(
          token1Address,
          token2Address,
          treasury,
          poolFee
        );
        const pair1 = await factory.getPair(
          token1Address,
          token2Address,
          poolFee
        );

        const pool1 = await pair.attach(pair1);
        let tokenAPoolQty = BigNumber.from(200).mul(precision);
        let tokenBPoolQty = BigNumber.from(210).mul(precision);
        await pool1
          .connect(signers[1])
          .addLiquidity(
            signers[1].address,
            token1Address,
            token2Address,
            tokenAPoolQty,
            tokenBPoolQty
          );

        const token2SwapResult = await factory.recommendedPairToSwap(
          token2Address,
          token1Address,
          BigNumber.from(10).mul(precision)
        );

        expect(token2SwapResult[0]).not.to.be.equals(
          "0x0000000000000000000000000000000000000000"
        );
        expect(token2SwapResult[1]).to.be.equals(token1Address);
        expect(token2SwapResult[3]).to.be.equals(poolFee);
      });

      it("Given multiple pools(with low fee pool first) of a exist when user asks for recommendation for swap then pool that gives maximum quantity should be returned. ", async function () {
        const {
          pair,
          factory,
          mockHederaService,
          signers,
          token1Address,
          token2Address,
          configuration,
          lpTokenCont,
        } = await loadFixture(deployFixture);
        await factory.setUpFactory(
          mockHederaService.address,
          signers[0].address,
          pair.address,
          lpTokenCont.address,
          configuration.address
        );

        const initialFees = Helper.convertToFeeObjectArray(
          await configuration.getTransactionsFee()
        );

        const poolFee1With5PerFee = initialFees[0].value;
        const poolFee2With30PerFee = initialFees[1].value;

        await factory.createPair(
          token1Address,
          token2Address,
          treasury,
          poolFee1With5PerFee
        );
        const pair1 = await factory.getPair(
          token1Address,
          token2Address,
          poolFee1With5PerFee
        );
        await factory.createPair(
          token1Address,
          token2Address,
          treasury,
          poolFee2With30PerFee
        );
        const pair2 = await factory.getPair(
          token1Address,
          token2Address,
          poolFee2With30PerFee
        );

        const pool1 = await pair.attach(pair1);
        let tokenAPoolQty = BigNumber.from(10000).mul(precision);
        let tokenBPoolQty = BigNumber.from(10000).mul(precision);
        await pool1
          .connect(signers[1])
          .addLiquidity(
            signers[1].address,
            token1Address,
            token2Address,
            tokenAPoolQty,
            tokenBPoolQty
          );

        const pool2 = await pair.attach(pair2);
        await pool2
          .connect(signers[1])
          .addLiquidity(
            signers[1].address,
            token1Address,
            token2Address,
            tokenAPoolQty,
            tokenBPoolQty
          );

        const tokenSwapResult = await factory.recommendedPairToSwap(
          token1Address,
          token2Address,
          BigNumber.from(100).mul(precision)
        );

        expect(tokenSwapResult[0]).not.to.be.equals(
          "0x0000000000000000000000000000000000000000"
        );
        expect(tokenSwapResult[1]).to.be.equals(token2Address);
        expect(tokenSwapResult[3]).to.be.equals(poolFee1With5PerFee);
      });

      it("Given multiple pools(with high fee pool first) of a exist when user asks for recommendation for swap then pool that gives maximum quantity should be returned. ", async function () {
        const {
          pair,
          factory,
          mockHederaService,
          signers,
          token1Address,
          token2Address,
          configuration,
          lpTokenCont,
        } = await loadFixture(deployFixture);
        await factory.setUpFactory(
          mockHederaService.address,
          signers[0].address,
          pair.address,
          lpTokenCont.address,
          configuration.address
        );

        const initialFees = Helper.convertToFeeObjectArray(
          await configuration.getTransactionsFee()
        );

        const poolFee1With30PerFee = initialFees[1].value;
        const poolFee2With10PerFee = initialFees[2].value;

        await factory.createPair(
          token1Address,
          token2Address,
          treasury,
          poolFee1With30PerFee
        );
        const pair1 = await factory.getPair(
          token1Address,
          token2Address,
          poolFee1With30PerFee
        );
        await factory.createPair(
          token1Address,
          token2Address,
          treasury,
          poolFee2With10PerFee
        );
        const pair2 = await factory.getPair(
          token1Address,
          token2Address,
          poolFee2With10PerFee
        );

        const pool1 = await pair.attach(pair1);
        let tokenAPoolQty = BigNumber.from(10000).mul(precision);
        let tokenBPoolQty = BigNumber.from(10000).mul(precision);
        await pool1
          .connect(signers[1])
          .addLiquidity(
            signers[1].address,
            token1Address,
            token2Address,
            tokenAPoolQty,
            tokenBPoolQty
          );

        const pool2 = await pair.attach(pair2);
        await pool2
          .connect(signers[1])
          .addLiquidity(
            signers[1].address,
            token1Address,
            token2Address,
            tokenAPoolQty,
            tokenBPoolQty
          );

        const tokenSwapResult = await factory.recommendedPairToSwap(
          token1Address,
          token2Address,
          BigNumber.from(100).mul(precision)
        );

        expect(tokenSwapResult[0]).not.to.be.equals(
          "0x0000000000000000000000000000000000000000"
        );
        expect(tokenSwapResult[1]).to.be.equals(token2Address);
        expect(tokenSwapResult[3]).to.be.equals(poolFee2With10PerFee);
      });

      it("Given multiple pools exist when user ask for recommendation for swap(other token) then pool that gives maximum quantity should be returned. ", async function () {
        const {
          pair,
          factory,
          mockHederaService,
          signers,
          token1Address,
          token2Address,
          configuration,
          lpTokenCont,
        } = await loadFixture(deployFixture);
        await factory.setUpFactory(
          mockHederaService.address,
          signers[0].address,
          pair.address,
          lpTokenCont.address,
          configuration.address
        );

        const initialFees = Helper.convertToFeeObjectArray(
          await configuration.getTransactionsFee()
        );

        const poolFee1 = initialFees[0].value;
        const poolFee2 = initialFees[1].value;
        const poolFee3 = initialFees[2].value;

        await factory.createPair(
          token1Address,
          token2Address,
          treasury,
          poolFee1
        );
        const pair1 = await factory.getPair(
          token1Address,
          token2Address,
          poolFee1
        );
        await factory.createPair(
          token1Address,
          token2Address,
          treasury,
          poolFee2
        );
        const pair2 = await factory.getPair(
          token1Address,
          token2Address,
          poolFee2
        );
        await factory.createPair(
          token1Address,
          token2Address,
          treasury,
          poolFee3
        );
        const pair3 = await factory.getPair(
          token1Address,
          token2Address,
          poolFee3
        );

        const pool1 = await pair.attach(pair1);
        //This pool gives more tokenA qty after swap as tokenA is 5 times tokenB
        let tokenAPoolQty = BigNumber.from(10000).mul(precision);
        let tokenBPoolQty = BigNumber.from(10000).mul(precision);
        await pool1
          .connect(signers[1])
          .addLiquidity(
            signers[1].address,
            token1Address,
            token2Address,
            tokenAPoolQty,
            tokenBPoolQty
          );

        const pool2 = await pair.attach(pair2);
        await pool2
          .connect(signers[1])
          .addLiquidity(
            signers[1].address,
            token1Address,
            token2Address,
            tokenAPoolQty,
            tokenBPoolQty
          );

        const pool3 = await pair.attach(pair3);
        await pool3
          .connect(signers[1])
          .addLiquidity(
            signers[1].address,
            token1Address,
            token2Address,
            tokenAPoolQty,
            tokenBPoolQty
          );

        const tokenSwapResult = await factory.recommendedPairToSwap(
          token2Address,
          token1Address,
          BigNumber.from(100).mul(precision)
        );

        expect(tokenSwapResult[0]).not.to.be.equals(
          "0x0000000000000000000000000000000000000000"
        );
        expect(tokenSwapResult[1]).to.be.equals(token1Address);
        expect(tokenSwapResult[3]).to.be.equals(poolFee1);
      });
    });

    it("verify factory initization should be failed for subsequent initization call", async function () {
      const {
        factory,
        mockHederaService,
        signers,
        configuration,
        pair,
        lpTokenCont,
      } = await loadFixture(deployFixture);
      await factory.setUpFactory(
        mockHederaService.address,
        signers[0].address,
        pair.address,
        lpTokenCont.address,
        configuration.address
      );
      await expect(
        factory.setUpFactory(
          mockHederaService.address,
          signers[0].address,
          pair.address,
          lpTokenCont.address,
          configuration.address
        )
      ).to.revertedWith("Initializable: contract is already initialized");
    });

    it("Check getPairs method", async function () {
      const {
        factory,
        mockHederaService,
        signers,
        token1Address,
        token2Address,
        token3Address,
        configuration,
        pair,
        lpTokenCont,
      } = await loadFixture(deployFixture);
      await factory.setUpFactory(
        mockHederaService.address,
        signers[0].address,
        pair.address,
        lpTokenCont.address,
        configuration.address
      );
      await factory.createPair(token1Address, token2Address, treasury, fee);
      const pairs = await factory.getPairs();
      expect(pairs.length).to.be.equals(1);
      await factory.createPair(token2Address, token3Address, treasury, fee);
      const pairs2 = await factory.getPairs();
      expect(pairs2.length).to.be.equals(2);
    });

    it("Check For identical Tokens", async function () {
      const {
        factory,
        mockHederaService,
        signers,
        configuration,
        pair,
        lpTokenCont,
      } = await loadFixture(deployFixture);
      await factory.setUpFactory(
        mockHederaService.address,
        signers[0].address,
        pair.address,
        lpTokenCont.address,
        configuration.address
      );
      await expect(
        factory.createPair(tokenAAddress, tokenAAddress, treasury, fee)
      ).to.revertedWith("IDENTICAL_ADDRESSES");
    });

    it("Check For zero Token address", async function () {
      const {
        factory,
        mockHederaService,
        signers,
        configuration,
        pair,
        lpTokenCont,
      } = await loadFixture(deployFixture);
      await factory.setUpFactory(
        mockHederaService.address,
        signers[0].address,
        pair.address,
        lpTokenCont.address,
        configuration.address
      );
      await expect(
        factory.createPair(newZeroAddress, tokenAAddress, treasury, fee)
      ).to.revertedWith("ZERO_ADDRESS");
    });

    it("Check getPair method", async function () {
      const {
        factory,
        mockHederaService,
        signers,
        token1Address,
        token2Address,
        configuration,
        pair,
        lpTokenCont,
      } = await loadFixture(deployFixture);
      await factory.setUpFactory(
        mockHederaService.address,
        signers[0].address,
        pair.address,
        lpTokenCont.address,
        configuration.address
      );
      await factory.createPair(token1Address, token2Address, treasury, fee);
      const pairFromFactory = await factory.getPair(
        token1Address,
        token2Address,
        fee
      );
      expect(pairFromFactory).to.be.not.equal(zeroAddress);
    });
  });

  it("verify pair initization should be failed for subsequent initization call", async function () {
    const { pair, mockHederaService, lpTokenCont } = await loadFixture(
      deployFixture
    );
    await expect(
      pair.initialize(
        mockHederaService.address,
        lpTokenCont.address,
        tokenAAddress,
        tokenBAddress,
        treasury,
        fee,
        zeroAddress
      )
    ).to.revertedWith("Initializable: contract is already initialized");
  });

  it("verify pair addresses count", async function () {
    const { pair } = await loadFixture(deployFixture);
    const items = await pair.getPair();
    expect(items.length).to.be.equals(2);
  });

  it("verify contract address is non-empty", async function () {
    const { pair } = await loadFixture(deployFixture);
    const address = await pair.getContractAddress();
    expect(address).to.not.equals("");
  });

  it("Create a token pair with 0 unit each ", async function () {
    const { pair } = await loadFixture(deployFixture);
    const qtys = await pair.getPairQty();
    expect(qtys[0]).to.be.equals(precision.mul(0));
    expect(qtys[1]).to.be.equals(precision.mul(0));
  });

  it("Swap 1 unit of token A within slippage threshold input", async function () {
    const {
      pair,
      token1Address,
      token2Address,
      tokenCont,
      tokenCont1,
      signers,
    } = await loadFixture(deployFixtureTokenTest);
    const tokenAPoolQty = BigNumber.from(200).mul(precision);
    const tokenBPoolQty = BigNumber.from(220).mul(precision);
    const slippageInput = BigNumber.from(2).mul(precision.div(100));

    await pair.addLiquidity(
      signers[0].address,
      token1Address,
      token2Address,
      tokenAPoolQty,
      tokenBPoolQty
    );

    const tokenBeforeQty = await pair.getPairQty();
    expect(Number(tokenBeforeQty[0])).to.be.equals(tokenAPoolQty);

    const addTokenAQty = BigNumber.from(1).mul(precision);

    const { tokenAQtyAfterSubtractingFee, tokenBResultantQty } =
      await quantitiesAfterSwappingTokenA(pair, addTokenAQty);

    const tx = await pair.swapToken(
      signers[0].address,
      token1Address,
      addTokenAQty,
      slippageInput
    );

    await tx.wait();

    const tokenQty = await pair.getPairQty();
    const pairAccountBalance = await tokenCont.balanceOf(pair.address);
    expect(pairAccountBalance).to.be.equals(tokenQty[0]);
    expect(tokenQty[0]).to.be.equals(
      tokenAPoolQty.add(tokenAQtyAfterSubtractingFee)
    );

    expect(tokenQty[1]).to.be.equals(tokenBPoolQty.sub(tokenBResultantQty));

    const pairAccountBalance1 = await tokenCont1.balanceOf(pair.address);
    expect(pairAccountBalance1).to.be.equals(tokenQty[1]);
  });

  it("Swap 1 units of token B within slippage threshold input", async function () {
    const {
      pair,
      token1Address,
      token2Address,
      signers,
      tokenCont,
      tokenCont1,
    } = await loadFixture(deployFixtureTokenTest);
    const tokenAPoolQty = BigNumber.from(114).mul(precision);
    const tokenBPoolQty = BigNumber.from(220).mul(precision);
    const slippageInput = BigNumber.from(2).mul(precision.div(100));
    await pair.addLiquidity(
      signers[0].address,
      token1Address,
      token2Address,
      tokenAPoolQty,
      tokenBPoolQty
    );

    const tokenBeforeQty = await pair.getPairQty();
    expect(Number(tokenBeforeQty[1])).to.be.equals(tokenBPoolQty);

    const addTokenBQty = BigNumber.from(1).mul(precision);

    const { tokenBQtyAfterSubtractingFee, tokenAResultantQty } =
      await quantitiesAfterSwappingTokenB(pair, addTokenBQty);

    const tx = await pair.swapToken(
      signers[0].address,
      token2Address,
      addTokenBQty,
      slippageInput
    );
    await tx.wait();

    const tokenQty = await pair.getPairQty();
    const pairAccountBalance = await tokenCont.balanceOf(pair.address);
    expect(pairAccountBalance).to.be.equals(tokenQty[0]);
    expect(tokenQty[0]).to.be.equals(tokenAPoolQty.sub(tokenAResultantQty));

    expect(tokenQty[1]).to.be.equals(
      tokenBPoolQty.add(tokenBQtyAfterSubtractingFee)
    );

    const pairAccountBalance1 = await tokenCont1.balanceOf(pair.address);
    expect(pairAccountBalance1).to.be.equals(tokenQty[1]);
  });

  it("Swap 100 units of token A - default breaching slippage  ", async function () {
    const { pair, token1Address, token2Address } = await loadFixture(
      deployFixture
    );
    const tokenAPoolQty = BigNumber.from(200).mul(precision);
    const tokenBPoolQty = BigNumber.from(220).mul(precision);
    await pair.addLiquidity(
      zeroAddress,
      token1Address,
      token2Address,
      tokenAPoolQty,
      tokenBPoolQty
    );
    const tokenBeforeQty = await pair.getPairQty();
    expect(Number(tokenBeforeQty[0])).to.be.equals(tokenAPoolQty);
    const addTokenAQty = BigNumber.from(101).mul(precision);
    await expect(
      pair.swapToken(
        zeroAddress,
        token1Address,
        addTokenAQty,
        defaultSlippageInput
      )
    )
      .to.be.revertedWithCustomError(pair, "SlippageBreached")
      .withArgs(
        "The calculated slippage is over the slippage threshold.",
        33941496,
        500000
      );
  });

  it("Swap 100 units of token B - default breaching slippage  ", async function () {
    const { pair, token1Address, token2Address } = await loadFixture(
      deployFixture
    );
    const tokenAPoolQty = BigNumber.from(2222200).mul(precision);
    const tokenBPoolQty = BigNumber.from(2222200).mul(precision);
    await pair.addLiquidity(
      zeroAddress,
      token1Address,
      token2Address,
      tokenAPoolQty,
      tokenBPoolQty
    );
    const tokenBeforeQty = await pair.getPairQty();
    expect(Number(tokenBeforeQty[1])).to.be.equals(tokenBPoolQty);
    const addTokenBQty = BigNumber.from(100).mul(precision);
    await expect(
      pair.swapToken(
        zeroAddress,
        token2Address,
        addTokenBQty,
        defaultSlippageInput
      )
    )
      .to.be.revertedWithCustomError(pair, "SlippageBreached")
      .withArgs(
        "The calculated slippage is over the slippage threshold.",
        753193,
        500000
      );
  });

  it("Remove liquidity to the pool by removing 5 units of lpToken  ", async function () {
    const {
      pair,
      lpTokenCont,
      lpToken,
      signers,
      token1Address,
      token2Address,
    } = await loadFixture(deployFixtureTokenTest);
    const tokenAPoolQty = BigNumber.from(100).mul(precision);
    const tokenBPoolQty = BigNumber.from(100).mul(precision);
    await pair.addLiquidity(
      signers[0].address,
      token1Address,
      token2Address,
      tokenAPoolQty,
      tokenBPoolQty
    );
    const tokenBeforeQty = await pair.getPairQty();
    expect(tokenBeforeQty[0]).to.be.equals(precision.mul(100));
    expect(tokenBeforeQty[1]).to.be.equals(precision.mul(100));
    lpToken.setUserBalance(signers[0].address, precision.mul(100));
    lpToken.setTotal(precision.mul(100));
    const allLPToken = await lpTokenCont.getAllLPTokenCount();
    expect(allLPToken).to.be.equals(precision.mul(100));

    const tx = await pair.removeLiquidity(signers[0].address, precision.mul(5));
    await tx.wait();

    const userlpToken = await lpTokenCont.lpTokenForUser(signers[0].address);
    expect(userlpToken).to.be.equals(precision.mul(95));

    const tokenQty = await pair.getPairQty();
    expect(tokenQty[0]).to.be.equals(precision.mul(95));
    expect(tokenQty[1]).to.be.equals(precision.mul(95));
  });

  it("Add liquidity to the pool by adding 50 units of token and 50 units of token B  ", async function () {
    const { pair, token1Address, token2Address } = await loadFixture(
      deployFixture
    );
    const tx = await pair.addLiquidity(
      zeroAddress,
      token1Address,
      token2Address,
      precision.mul(50),
      precision.mul(50)
    );
    await tx.wait();
    const tokenQty = await pair.getPairQty();
    expect(tokenQty[0]).to.be.equals(precision.mul(50));
    expect(tokenQty[1]).to.be.equals(precision.mul(50));
  });

  describe("When HTS gives failure response", async () => {
    it("Contract gives 100 as qty for tokens ", async function () {
      const { pair, token2Address, token1Address } = await loadFixture(
        deployFixture
      );
      await pair.addLiquidity(
        zeroAddress,
        token2Address,
        token1Address,
        precision.mul(100),
        precision.mul(100)
      );
      const qtys = await pair.getPairQty();
      expect(qtys[0]).to.be.equals(precision.mul(100));
      expect(qtys[1]).to.be.equals(precision.mul(100));
    });

    it("Passing unknown A token to swap", async function () {
      const { pair } = await loadFixture(deployFixture);
      const tokenBeforeQty = await pair.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(
        pair.swapToken(zeroAddress, zeroAddress, 30, defaultSlippageInput)
      ).to.revertedWith("Pls pass correct token to swap.");
    });

    it("Verify pair info call should return data", async function () {
      const { pair, token1Address, token2Address } = await loadFixture(
        deployFixture
      );
      await pair.addLiquidity(
        zeroAddress,
        token1Address,
        token2Address,
        precision.mul(100),
        precision.mul(120)
      );
      const info = await pair.getPairInfo();
      const pairObject = info[0];
      const amountObject = info[1];
      expect(info.length).to.be.equals(2);
      expect(
        ethers.utils.arrayify(pairObject.tokenA.tokenAddress).length
      ).greaterThan(0);
      expect(
        ethers.utils.arrayify(pairObject.tokenB.tokenAddress).length
      ).greaterThan(0);
      expect(amountObject.tokenASpotPrice).equals(83333333);
      expect(amountObject.tokenBSpotPrice).equals(120000000);
      expect(amountObject.precision).equals(100000000);
      expect(amountObject.feePrecision).equals(100);
      expect(amountObject.fee).equals(1);
    });

    it("Passing unknown B token to swap", async function () {
      const { pair } = await loadFixture(deployFixture);
      const tokenBeforeQty = await pair.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(
        pair.swapToken(zeroAddress, zeroAddress, 30, defaultSlippageInput)
      ).to.revertedWith("Pls pass correct token to swap.");
    });

    // ----------------------------------------------------------------------
    it("Swap Token A with Fail A transfer", async function () {
      const { pair, token1Address, token2Address } = await loadFixture(
        deployFixture
      );
      await pair.addLiquidity(
        zeroAddress,
        token1Address,
        token2Address,
        precision.mul(100),
        precision.mul(100)
      );
      const tokenA = await ethers.getContractAt("ERC20Mock", token1Address);
      await tokenA.setTransaferFailed(true);
      await expect(
        pair.swapToken(zeroAddress, token1Address, 30, defaultSlippageInput)
      ).to.revertedWith(
        "swapTokenA: Transferring token A to contract failed with status code"
      );
    });

    // ----------------------------------------------------------------------

    it("Swap Token A with Fail B transfer", async function () {
      const { pair, token1Address, token2Address, tokenCont1 } =
        await loadFixture(deployFixture);
      const totalQtyA = precision.mul(1000);
      await pair.addLiquidity(
        zeroAddress,
        token1Address,
        token2Address,
        totalQtyA,
        precision.mul(50)
      );
      const tokenBeforeQty = await pair.getPairQty();

      expect(tokenBeforeQty[0]).to.be.equals(totalQtyA);
      await tokenCont1.setTransaferFailed(true);
      await expect(
        pair.swapToken(zeroAddress, token1Address, precision.mul(1), 1200000)
      ).to.revertedWith(
        "swapTokenA: Transferring token B to user failed with status code"
      );
    });

    // ----------------------------------------------------------------------
    it("Swap Token B with Fail B transfer", async function () {
      const { pair, token1Address, token2Address } = await loadFixture(
        deployFixture
      );
      const totalQtyA = precision.mul(1000);
      await pair.addLiquidity(
        zeroAddress,
        token1Address,
        token2Address,
        totalQtyA,
        precision.mul(1000)
      );
      const tokenBeforeQty = await pair.getPairQty();
      expect(Number(tokenBeforeQty[0])).to.be.equals(precision.mul(1000));
      const tokenB = await ethers.getContractAt("ERC20Mock", token2Address);
      await tokenB.setTransaferFailed(true); //Forcing transfer to fail
      await expect(
        pair.swapToken(zeroAddress, token2Address, precision.mul(1), 1200000)
      ).to.revertedWith(
        "swapTokenB: Transferring token B to contract failed with status code"
      );
    });

    it("Swap Token B with Fail A transfer", async function () {
      const { pair, token1Address, token2Address, tokenCont } =
        await loadFixture(deployFixture);
      const totalQtyA = precision.mul(1000);
      await pair.addLiquidity(
        zeroAddress,
        token1Address,
        token2Address,
        totalQtyA,
        precision.mul(1000)
      );
      const tokenBeforeQty = await pair.getPairQty();
      expect(Number(tokenBeforeQty[0])).to.be.equals(precision.mul(1000));
      await tokenCont.setTransaferFailed(true);
      await expect(
        pair.swapToken(zeroAddress, token2Address, precision.mul(1), 1200000)
      ).to.revertedWith(
        "swapTokenB: Transferring token A to user failed with status code"
      );
    });

    // ----------------------------------------------------------------------
    it("Add liquidity Fail A Transfer", async function () {
      const { pair, token1Address, token2Address } = await loadFixture(
        deployFixture
      );
      const tokenA = await ethers.getContractAt("ERC20Mock", token1Address);
      await tokenA.setTransaferFailed(true);
      const tokenBeforeQty = await pair.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(
        pair.addLiquidity(zeroAddress, token1Address, token2Address, 30, 30)
      ).to.revertedWith(
        "Add liquidity: Transfering token A to contract failed with status code"
      );
    });

    it("Add liquidity Fail B Transfer", async function () {
      const { pair, token1Address, token2Address } = await loadFixture(
        deployFixture
      );
      const tokenB = await ethers.getContractAt("ERC20Mock", token2Address);
      await tokenB.setTransaferFailed(true);
      const tokenBeforeQty = await pair.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(
        pair.addLiquidity(zeroAddress, token1Address, token2Address, 30, 30)
      ).to.revertedWith(
        "Add liquidity: Transfering token B to contract failed with status code"
      );
    });

    // ----------------------------------------------------------------------
    it("verify remove liquidity should failed when user don't have enough balance ", async function () {
      const { pair, token2Address, token1Address } = await loadFixture(
        deployFixture
      );
      await pair.addLiquidity(
        zeroAddress,
        token2Address,
        token1Address,
        10,
        10
      );
      await expect(pair.removeLiquidity(zeroAddress, 11)).to.revertedWith(
        "user does not have sufficient lpTokens"
      );
    });

    it("Remove liquidity Fail A Transfer", async function () {
      const { pair, lpToken, signers, tokenCont } = await loadFixture(
        deployFixtureTokenTest
      );
      const tokenBeforeQty = await pair.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await tokenCont.setTransaferFailed(true);
      lpToken.setUserBalance(signers[0].address, 10);
      await expect(pair.removeLiquidity(signers[0].address, 5)).to.revertedWith(
        "Remove liquidity: Transferring token A to contract failed with status code"
      );
    });

    it("Remove liquidity Fail B Transfer", async function () {
      const { pair, tokenCont1, lpToken, signers } = await loadFixture(
        deployFixtureTokenTest
      );
      await tokenCont1.setTransaferFailed(true);
      lpToken.setUserBalance(signers[0].address, 10);
      const tokenBeforeQty = await pair.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(pair.removeLiquidity(signers[0].address, 5)).to.revertedWith(
        "Remove liquidity: Transferring token B to contract failed with status code"
      );
    });

    it("Remove liquidity Fail not sufficient tokens", async function () {
      const { pair } = await loadFixture(deployFixture);
      const tokenBeforeQty = await pair.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await expect(pair.removeLiquidity(zeroAddress, 110)).to.revertedWith(
        "user does not have sufficient lpTokens"
      );
    });

    it("Add liquidity Fail Minting", async function () {
      const { pair, token1Address, token2Address, lpTokenCont } =
        await loadFixture(deployFixture);
      const tokenBeforeQty = await pair.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      const lpTokenAddress = await lpTokenCont.getLpTokenAddress();
      const lpToken = await ethers.getContractAt("ERC20Mock", lpTokenAddress);
      await lpToken.setName("FAIL"); //Forcing transfer to fail
      await expect(
        pair.addLiquidity(zeroAddress, token1Address, token2Address, 30, 30)
      ).to.revertedWith("LP token minting failed.");
    });

    it("Add liquidity Transfer LPToken Fail", async function () {
      const {
        pair,
        token1Address,
        token2Address,
        mockHederaService,
        lpTokenCont,
      } = await loadFixture(deployFixture);
      const tokenBeforeQty = await pair.getPairQty();
      expect(tokenBeforeQty[0]).to.be.equals(precision.mul(0));
      await mockHederaService.setPassTransactionCount(7);
      const lpTokenAddress = await lpTokenCont.getLpTokenAddress();
      const lpToken = await ethers.getContractAt("ERC20Mock", lpTokenAddress);
      await lpToken.setTransaferFailed(true); //Forcing transfer to fail
      await expect(
        pair.addLiquidity(zeroAddress, token1Address, token2Address, 30, 30)
      ).to.revertedWith("LPToken: token transfer failed from contract.");
    });
  });

  describe("LpToken Contract tests", async () => {
    it("Verify contract should be reverted for multiple initialization", async function () {
      const { lpTokenContract, LP_TOKEN_ARGS } = await loadFixture(
        lpTokenFixture
      );
      await expect(lpTokenContract.initialize(...LP_TOKEN_ARGS)).revertedWith(
        "Initializable: contract is already initialized"
      );
    });

    it("Verify that lp-token address exist", async function () {
      const { lpTokenContract } = await loadFixture(lpTokenFixture);
      expect(await lpTokenContract.getLpTokenAddress()).not.equals(
        TestHelper.ZERO_ADDRESS
      );
    });

    it("Verify token creation should be failed while initializing the contract", async function () {
      const { hederaService, signers } = await loadFixture(lpTokenFixture);
      const tokenContract = await TestHelper.deployLogic("LPToken");
      await expect(
        tokenContract.initialize(
          hederaService.address,
          signers[0].address,
          "FAIL",
          "FAIL"
        )
      ).revertedWith("LPToken: Token creation failed.");
    });

    it("Verify allotLPTokenFor should be reverted if initialization is not done", async function () {
      const lpTokenContract = await TestHelper.deployLogic("LPToken");
      await expect(
        lpTokenContract.allotLPTokenFor(10, 10, TestHelper.ONE_ADDRESS)
      ).revertedWith("Ownable: caller is not the owner");
    });

    it("Verify allotLPTokenFor should be reverted for non-positive amount", async function () {
      const { lpTokenContract, user } = await loadFixture(lpTokenFixture);
      await expect(
        lpTokenContract.allotLPTokenFor(0, 0, user.address)
      ).revertedWith("Please provide positive token counts");
    });

    it("Verify allotLPTokenFor should be reverted during mint", async function () {
      const { lpTokenContract, user, lpToken } = await loadFixture(
        lpTokenFixture
      );
      await lpToken.setName("FAIL");
      await expect(
        lpTokenContract.allotLPTokenFor(30, 30, user.address)
      ).revertedWith("LP token minting failed.");
    });

    it("Verify allotLPTokenFor should be reverted during transfer-token call", async function () {
      const { lpTokenContract, user, lpToken } = await loadFixture(
        lpTokenFixture
      );
      await lpToken.setUserBalance(lpTokenContract.address, 500);
      await lpToken.setTransaferFailed(true);
      await expect(
        lpTokenContract.allotLPTokenFor(100, 100, user.address)
      ).revertedWith("LPToken: token transfer failed from contract.");
    });

    it("Verify allotLPTokenFor should increase user balance", async function () {
      const { lpTokenContract, user, lpToken } = await loadFixture(
        lpTokenFixture
      );
      await lpToken.setUserBalance(lpTokenContract.address, 500);
      await lpTokenContract.allotLPTokenFor(100, 100, user.address);
      const userBalance = await lpTokenContract.lpTokenForUser(user.address);
      expect(userBalance).equals(100);
    });

    it("Verify removeLPTokenFor should be reverted if initialization is not done", async function () {
      const lpTokenContract = await TestHelper.deployLogic("LPToken");
      await expect(
        lpTokenContract.removeLPTokenFor(101, TestHelper.ONE_ADDRESS)
      ).revertedWith("Ownable: caller is not the owner");
    });

    it("Verify removeLPTokenFor should be reverted for non-positive amount", async function () {
      const { lpTokenContract, user } = await loadFixture(lpTokenFixture);
      await expect(
        lpTokenContract.removeLPTokenFor(0, user.address)
      ).revertedWith("Please provide token counts");
    });

    it("Verify removeLPTokenFor should be reverted if user don't have enough balance", async function () {
      const { lpTokenContract, user, lpToken } = await loadFixture(
        lpTokenFixture
      );
      await lpToken.setUserBalance(user.address, 100);
      await expect(
        lpTokenContract.removeLPTokenFor(101, user.address)
      ).revertedWith("User Does not have lp amount");
    });

    it("verify removeLPTokenFor should be reverted during burn", async function () {
      const { lpTokenContract, user, lpToken } = await loadFixture(
        lpTokenFixture
      );
      await lpToken.setUserBalance(lpTokenContract.address, 10);
      await lpTokenContract.allotLPTokenFor(10, 10, user.address);
      await lpToken.setName("FAIL");
      await expect(
        lpTokenContract.removeLPTokenFor(5, user.address)
      ).to.revertedWith("LP token burn failed.");
    });

    it("Verify removeLPTokenFor should be reverted during transfer-token call", async function () {
      const { lpTokenContract, user, lpToken } = await loadFixture(
        lpTokenFixture
      );
      await lpToken.setUserBalance(lpTokenContract.address, 10);
      await lpTokenContract.allotLPTokenFor(10, 10, user.address);
      await lpToken.setTransaferFailed(true);
      await expect(
        lpTokenContract.removeLPTokenFor(5, user.address)
      ).revertedWith("LPToken: token transfer failed to contract.");
    });
  });

  describe("Pair Base Constant Product Algorithm Tests", async () => {
    it("Check spot price for tokens", async function () {
      const { pair, token1Address, token2Address } = await loadFixture(
        deployFixture
      );
      await pair.addLiquidity(
        zeroAddress,
        token1Address,
        token2Address,
        50,
        100
      );
      const token2SpotPrice = await pair.getSpotPrice(token2Address);
      expect(token2SpotPrice).to.be.equals(200000000);
      const token1SpotPrice = await pair.getSpotPrice(token1Address);
      expect(token1SpotPrice).to.be.equals(50000000);
    });

    it("check get out given in price value without precision", async function () {
      const { pair, token2Address, token1Address } = await loadFixture(
        deployFixture
      );
      await pair.addLiquidity(
        zeroAddress,
        token1Address,
        token2Address,
        24,
        16
      );
      const value = await pair.getOutGivenIn(10);
      expect(Number(value[2]) + Number(value[3])).to.be.equals(5);
    });

    it("check get in given out price value without precision", async function () {
      const { pair, token1Address, token2Address } = await loadFixture(
        deployFixture
      );
      await pair.addLiquidity(
        zeroAddress,
        token1Address,
        token2Address,
        100,
        50
      );
      const value = await pair.getInGivenOut(5);

      expect(value[2]).to.be.equals(10);
    });

    it("check spot price by multiplying with precision value", async function () {
      const { pair, token1Address, token2Address } = await loadFixture(
        deployFixture
      );
      const precisionValue = await pair.getPrecisionValue();
      const tokenAQ = 134.0293628 * Number(precisionValue);
      const tokenBQ = 187.5599813 * Number(precisionValue);

      await pair.addLiquidity(
        zeroAddress,
        token1Address,
        token2Address,
        tokenAQ,
        tokenBQ
      );
      const token2SpotPrice = await pair.getSpotPrice(token2Address);
      expect(token2SpotPrice).to.be.equals(139939471);
      const token1SpotPrice = await pair.getSpotPrice(token1Address);
      expect(token1SpotPrice).to.be.equals(71459466);
    });

    it("check spot price for front end", async function () {
      const { pair, token1Address, token2Address } = await loadFixture(
        deployFixture
      );
      const precisionValue = await pair.getPrecisionValue();
      const tokenAQ = 134.0293628 * Number(precisionValue);
      const tokenBQ = 187.5599813 * Number(precisionValue);

      await pair.addLiquidity(
        zeroAddress,
        token1Address,
        token2Address,
        tokenAQ,
        tokenBQ
      );
      const token2SpotPrice = await pair.getSpotPrice(token2Address);
      const token2SpotPriceOutput =
        Number(token2SpotPrice) / Number(precisionValue);
      expect(token2SpotPriceOutput).to.be.equals(1.39939471);
      const token1SpotPrice = await pair.getSpotPrice(token1Address);
      const token1SpotPriceOutput =
        Number(token1SpotPrice) / Number(precisionValue);
      expect(token1SpotPriceOutput).to.be.equals(0.71459466);
    });

    it("check spot price for big number", async function () {
      const { pair, token1Address, token2Address } = await loadFixture(
        deployFixture
      );
      const tokenAQ = BigNumber.from("29362813400293628");
      const tokenBQ = BigNumber.from("55998131875599813");
      await pair.addLiquidity(
        zeroAddress,
        token1Address,
        token2Address,
        tokenAQ,
        tokenBQ
      );

      const token2SpotPrice = await pair.getSpotPrice(token2Address);
      expect(token2SpotPrice).to.be.equals(190711057);
      const token1SpotPrice = await pair.getSpotPrice(token1Address);
      expect(token1SpotPrice).to.be.equals(52435344);
    });

    it("check precision value", async function () {
      const { pair } = await loadFixture(deployFixture);
      const value = await pair.getPrecisionValue();
      expect(Number(value)).to.be.equals(Number(100000000));
    });

    it("check getOutGivenIn for big number with precision", async function () {
      const { pair, token1Address, token2Address } = await loadFixture(
        deployFixture
      );
      const precision = await pair.getPrecisionValue();
      const tokenAQ = BigNumber.from(220).mul(precision);
      const tokenBQ = BigNumber.from(220).mul(precision);
      await pair.addLiquidity(
        zeroAddress,
        token1Address,
        token2Address,
        tokenAQ,
        tokenBQ,
        {
          value: ethers.utils.parseEther("10"),
        }
      );
      const deltaAQty = BigNumber.from(10).mul(precision);
      const value = await pair.getOutGivenIn(deltaAQty);

      expect(Number(value[2]) + Number(value[3])).to.be.equals(
        Number(949566211)
      );
    });

    it("check getInGivenOut for big number with precision", async function () {
      const { pair, token1Address, token2Address } = await loadFixture(
        deployFixture
      );
      const tokenAQ = BigNumber.from("220").mul(precision);
      const tokenBQ = BigNumber.from("220").mul(precision);
      await pair.addLiquidity(
        zeroAddress,
        token1Address,
        token2Address,
        tokenAQ,
        tokenBQ
      );
      const value = await pair.getInGivenOut(
        BigNumber.from("10").mul(precision)
      );
      const valueWithoutPrecision =
        (Number(value[2]) + Number(value[3])) / Number(precision);
      expect(valueWithoutPrecision).to.be.equals(9.49566211);
    });
  });

  describe("Slippage test cases", async () => {
    it("Verify default slippage", async function () {
      const { pair } = await loadFixture(deployFixture);
      const value = await pair.getSlippage();
      const tmp = Number(precision);
      const v = tmp * 0.005;
      expect(value).to.be.equals(v);
    });

    it("Verify slippage update", async function () {
      const { pair } = await loadFixture(deployFixture);
      await pair.setSlippage(6);
      const value = await pair.getSlippage();
      expect(value).to.be.equals(6);
    });

    it("Verify slippageOutGivenIn ", async function () {
      const { pair, token1Address, token2Address } = await loadFixture(
        deployFixture
      );
      const tokenAPoolQty = BigNumber.from(114).mul(precision);
      const tokenBPoolQty = BigNumber.from(220).mul(precision);
      await pair.addLiquidity(
        zeroAddress,
        token1Address,
        token2Address,
        tokenAPoolQty,
        tokenBPoolQty
      );
      const deltaAQty = BigNumber.from(1).mul(precision);
      const slippage = await pair.slippageOutGivenIn(deltaAQty);
      const slippageWithoutPrecision = Number(slippage) / Number(precision);
      expect(slippageWithoutPrecision).to.be.equals(0.01607525);
    });

    it("Verify slippageInGivenOut ", async function () {
      const { pair, token1Address, token2Address } = await loadFixture(
        deployFixture
      );
      const tokenAPoolQty = BigNumber.from(114).mul(precision);
      const tokenBPoolQty = BigNumber.from(220).mul(precision);
      await pair.addLiquidity(
        zeroAddress,
        token1Address,
        token2Address,
        tokenAPoolQty,
        tokenBPoolQty
      );
      const deltaBQty = BigNumber.from(1).mul(precision);
      const slippage = await pair.slippageInGivenOut(deltaBQty);
      const slippageWithoutPrecision = Number(slippage) / Number(precision);
      expect(Math.abs(slippageWithoutPrecision)).to.be.equals(0.01195611);
    });
  });

  describe("Mirror Node API requirement test cases", async () => {
    it("Get Token Pair address", async function () {
      const { pair, token1Address, token2Address } = await loadFixture(
        deployFixture
      );
      const value = await pair.getTokenPairAddress();
      expect(value[0]).to.be.equals(token1Address);
      expect(value[1]).to.be.equals(token2Address);
      expect(value[2]).to.not.be.equals(newZeroAddress);
      expect(value[3]).to.be.equals(fee);
    });
  });

  describe("fee test cases", async () => {
    it("get fee value", async function () {
      const { pair } = await loadFixture(deployFixture);
      const value = await pair.getFee();
      const valueWithoutPrecision = Number(value);
      expect(Number(valueWithoutPrecision)).to.be.equals(Number(1));
    });

    it("get token quantity from fee", async function () {
      const { pair, token1Address, token2Address } = await loadFixture(
        deployFixture
      );
      const tokenAPoolQty = BigNumber.from(10).mul(precision);
      await pair.addLiquidity(
        zeroAddress,
        token1Address,
        token2Address,
        tokenAPoolQty,
        10
      );
      const value = await pair.feeForToken(tokenAPoolQty);
      expect(value).to.be.equals(Number(5000000));
    });
  });
});
