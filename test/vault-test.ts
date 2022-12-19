import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";

describe("Vault Tests", function () {
  const stakingToken = "0x0000000000000000000000000000000000020002";
  const rewardToken1 = "0x0000000000000000000000000000000000010001";
  const rewardToken2 = "0x0000000000000000000000000000000000020003";
  const precision = 100000000;
  const total = 100 * precision;

  async function deployFixture() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(true, false);
    mockBaseHTS.setFailType(0);

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(total, 0);

    const signers = await ethers.getSigners();

    const VaultContract = await ethers.getContractFactory("Vault");
    const vaultContract = await upgrades.deployProxy(VaultContract, [
      stakingToken,
      1,
      mockBaseHTS.address,
    ]);

    await vaultContract.deployed();

    return { mockBaseHTS, vaultContract, tokenCont, signers };
  }

  it("Check initialize method", async function () {
    const { mockBaseHTS, vaultContract } = await loadFixture(deployFixture);
    await vaultContract.initialize(stakingToken, 1, mockBaseHTS.address);
  });

  it("Add staking token", async function () {
    const { vaultContract, signers } = await loadFixture(deployFixture);
    await vaultContract.connect(signers[1]).addToken(stakingToken, 10);
    const totalValue = await vaultContract.getTotalVolume();
    expect(totalValue).equals(10);
  });

  it("Get staked amount", async function () {
    const { vaultContract, signers } = await loadFixture(deployFixture);
    await vaultContract.connect(signers[1]).addToken(stakingToken, 10);
    const totalValue = await vaultContract
      .connect(signers[1])
      .getLockedAmount();
    expect(totalValue).equals(10);
  });

  it("Get TVL", async function () {
    const { vaultContract, signers } = await loadFixture(deployFixture);
    await vaultContract.connect(signers[1]).addToken(stakingToken, 10);
    const totalValue = await vaultContract.getTotalVolume();
    expect(totalValue).equals(10);
  });

  it("Get lock period", async function () {
    const { vaultContract } = await loadFixture(deployFixture);
    const lockPeriod = await vaultContract.getLockPeriod();
    expect(lockPeriod).equals(1);
  });

  it("one people, one type of reward, add reward, withdraw", async function () {
    const { vaultContract, signers } = await loadFixture(deployFixture);
    await vaultContract.connect(signers[1]).addToken(stakingToken, 10);
    await vaultContract.connect(signers[0]).addToken(rewardToken1, 10);
    await vaultContract.connect(signers[1]).withdraw(0, 10);
    const totalValue = await vaultContract.getTotalVolume();
    expect(totalValue).equals(0);
  });

  it("two people, two type of reward, one withdraw, add reward", async function () {
    const { vaultContract, signers } = await loadFixture(deployFixture);
    await vaultContract.connect(signers[1]).addToken(stakingToken, 10);
    await vaultContract.connect(signers[2]).addToken(stakingToken, 10);

    await vaultContract.connect(signers[0]).addToken(rewardToken1, 10);
    await vaultContract.connect(signers[0]).addToken(rewardToken2, 10);

    await vaultContract.connect(signers[1]).withdraw(0, 5);

    const totalValue = await vaultContract.getTotalVolume();
    expect(totalValue).equals(15);
  });

  it("one people, one type of reward,  add reward, one withdraw, all claim", async function () {
    const { vaultContract, signers } = await loadFixture(deployFixture);
    await vaultContract.connect(signers[1]).addToken(stakingToken, 10);
    await vaultContract.connect(signers[0]).addToken(rewardToken1, 10);
    await vaultContract.connect(signers[1]).withdraw(0, 10);
    const result = await vaultContract.callStatic.claimAllReward(0);
    expect(result[0]).equals(0);
    expect(result[1]).equals(1);
  });

  it("one people, one type of reward,  add reward, one withdraw, claim specific reward", async function () {
    const { vaultContract, signers } = await loadFixture(deployFixture);
    await vaultContract.connect(signers[1]).addToken(stakingToken, 10);
    await vaultContract.connect(signers[0]).addToken(rewardToken1, 10);
    await vaultContract.connect(signers[1]).withdraw(0, 10);
    const result = await vaultContract.callStatic.claimSpecificReward([
      rewardToken1,
    ]);
    expect(result).equals(1);
  });
});
