import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";

describe("Vault Tests", function () {
  const stakingToken = "0x0000000000000000000000000000000000020002";
  const rewardToken1 = "0x0000000000000000000000000000000000010001";
  const rewardToken2 = "0x0000000000000000000000000000000000020003";
  const newZeroAddress = "0x0000000000000000000000000000000000000000";

  const precision = 100000000;
  const total = 100 * precision;

  it("Verify if the Vault Initialisation works", async function () {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(true, true);
    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(100000000000, 100000000000);

    const Vault0 = await ethers.getContractFactory("Vault");
    await expect(
      upgrades.deployProxy(Vault0, [newZeroAddress, 100, mockBaseHTS.address])
    ).to.revertedWith("Staking token should not be empty.");

    const vault0 = await upgrades.deployProxy(Vault0, [
      tokenCont.address,
      100,
      mockBaseHTS.address,
    ]);
    await expect(
      vault0.initialize(newZeroAddress, 100, mockBaseHTS.address)
    ).to.revertedWith("Initializable: contract is already initialized");
  });

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

  async function deployFailFixture() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(false, false);
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

  it("Add staking token", async function () {
    const { vaultContract, signers } = await loadFixture(deployFixture);
    await vaultContract.connect(signers[1]).addStake(10);
    const totalValue = await vaultContract.getTotalVolume();
    expect(totalValue).equals(10);
    await expect(vaultContract.connect(signers[1]).addStake(0)).to.revertedWith(
      "Please provide amount"
    );
  });

  it("Add reward token", async function () {
    const { vaultContract, signers } = await loadFixture(deployFixture);
    await expect(
      vaultContract
        .connect(signers[0])
        .addReward(rewardToken1, 10, signers[0].address)
    ).to.revertedWith("No token staked yet");
  });

  it("Add reward token fail", async function () {
    const { vaultContract, signers, mockBaseHTS } = await loadFixture(
      deployFailFixture
    );
    await vaultContract.connect(signers[1]).addStake(10);
    mockBaseHTS.setFailType(15); //1 pass transaction
    await expect(
      vaultContract
        .connect(signers[0])
        .addReward(rewardToken1, 10, signers[0].address)
    ).to.revertedWith("Vault: Add reward failed on token exist.");
    mockBaseHTS.setFailType(0); //multiple pass transaction
    await vaultContract
      .connect(signers[0])
      .addReward(rewardToken1, 10, signers[0].address);
    mockBaseHTS.setFailType(16); // 0 pass transaction
    await expect(
      vaultContract
        .connect(signers[0])
        .addReward(rewardToken1, 10, signers[0].address)
    ).to.revertedWith("Vault: Add reward failed on token not exist.");
  });

  it("Add stake token fail", async function () {
    const { vaultContract, signers, mockBaseHTS } = await loadFixture(
      deployFailFixture
    );
    mockBaseHTS.setFailType(16); // 0 pass transaction
    await expect(
      vaultContract.connect(signers[1]).addStake(10)
    ).to.revertedWith("Vault: Add stake failed.");

    mockBaseHTS.setFailType(0); //multiple pass transaction
    await vaultContract.connect(signers[1]).addStake(10);
    await vaultContract
      .connect(signers[0])
      .addReward(rewardToken1, 10, signers[0].address);
    mockBaseHTS.setFailType(15); //1 pass transaction
    await expect(
      vaultContract.connect(signers[1]).addStake(10)
    ).to.revertedWith("Claim reward failed.");
    mockBaseHTS.setFailType(17); //2 pass transaction
    await expect(
      vaultContract.connect(signers[1]).addStake(10)
    ).to.revertedWith("Vault: Add stake failed.");
  });

  it("withdraw token fail", async function () {
    const { vaultContract, signers, mockBaseHTS } = await loadFixture(
      deployFailFixture
    );
    await expect(
      vaultContract.connect(signers[1]).withdraw(signers[1].address, 0, 0)
    ).to.revertedWith("Please provide amount");
    await vaultContract.connect(signers[1]).addStake(10);
    await vaultContract
      .connect(signers[0])
      .addReward(rewardToken1, 10, signers[0].address);
    mockBaseHTS.setFailType(17); //2 pass transaction
    await expect(
      vaultContract.connect(signers[1]).withdraw(signers[1].address, 0, 10)
    ).to.revertedWith("Withdraw failed.");
  });

  it("claim Specific token fail", async function () {
    const { vaultContract, signers, mockBaseHTS } = await loadFixture(
      deployFailFixture
    );
    await expect(
      vaultContract.connect(signers[1]).withdraw(signers[1].address, 0, 0)
    ).to.revertedWith("Please provide amount");
    await vaultContract.connect(signers[1]).addStake(10);
    await vaultContract
      .connect(signers[0])
      .addReward(rewardToken1, 10, signers[0].address);
    mockBaseHTS.setFailType(15); //1 pass transaction
    await expect(
      vaultContract
        .connect(signers[1])
        .claimSpecificReward([rewardToken1], signers[1].address)
    ).to.revertedWith("Claim reward failed.");
  });

  it("Get staked amount", async function () {
    const { vaultContract, signers } = await loadFixture(deployFixture);
    await vaultContract.connect(signers[1]).addStake(10);
    const totalValue = await vaultContract
      .connect(signers[1])
      .getLockedAmount(signers[1].address);
    expect(totalValue).equals(10);
  });

  it("Get TVL", async function () {
    const { vaultContract, signers } = await loadFixture(deployFixture);
    await vaultContract.connect(signers[1]).addStake(10);
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
    await vaultContract.connect(signers[1]).addStake(10);
    await vaultContract
      .connect(signers[0])
      .addReward(rewardToken1, 10, signers[0].address);
    await vaultContract.connect(signers[1]).withdraw(signers[1].address, 0, 10);
    const totalValue = await vaultContract.getTotalVolume();
    expect(totalValue).equals(0);
  });

  it("two people, two type of reward, one withdraw, add reward", async function () {
    const { vaultContract, signers } = await loadFixture(deployFixture);
    await vaultContract.connect(signers[1]).addStake(10);
    await vaultContract.connect(signers[2]).addStake(10);

    await vaultContract
      .connect(signers[0])
      .addReward(rewardToken1, 10, signers[0].address);
    await vaultContract
      .connect(signers[0])
      .addReward(rewardToken2, 10, signers[0].address);

    await vaultContract.connect(signers[1]).withdraw(signers[1].address, 0, 5);

    const totalValue = await vaultContract.getTotalVolume();
    expect(totalValue).equals(15);
  });

  it("one people, one type of reward,  add reward, one withdraw, all claim", async function () {
    const { vaultContract, signers } = await loadFixture(deployFixture);
    await vaultContract.connect(signers[1]).addStake(10);
    await vaultContract
      .connect(signers[0])
      .addReward(rewardToken1, 10, signers[0].address);
    await vaultContract.connect(signers[1]).withdraw(signers[1].address, 0, 10);
    const result = await vaultContract.callStatic.claimAllReward(
      0,
      signers[0].address
    );
    expect(result[0]).equals(0);
    expect(result[1]).equals(1);
  });

  it("one people, one type of reward,  add reward, one withdraw, claim specific reward", async function () {
    const { vaultContract, signers } = await loadFixture(deployFixture);
    await vaultContract.connect(signers[1]).addStake(10);
    await vaultContract
      .connect(signers[0])
      .addReward(rewardToken1, 10, signers[0].address);
    await vaultContract.connect(signers[1]).withdraw(signers[1].address, 0, 10);
    const result = await vaultContract.callStatic.claimSpecificReward(
      [rewardToken1],
      signers[0].address
    );
    expect(result).equals(1);
  });
});
