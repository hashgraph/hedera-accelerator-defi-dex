import { expect } from "chai";
import { TestHelper } from "./TestHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("Vault Tests", function () {
  const TOTAL_AMOUNT = TestHelper.toPrecision(100);
  const STAKED_AMOUNT = TestHelper.toPrecision(50);
  const UN_STAKED_AMOUNT = TestHelper.toPrecision(10);
  const REWARD_AMOUNT = TestHelper.toPrecision(10);
  const LOCKING_PERIOD = 50; // 50 sec locking period
  const ADVANCE_LOCKING_PERIOD = LOCKING_PERIOD + 1; // 51 sec advance locking period

  async function deployFixture() {
    const signers = await TestHelper.getSigners();
    const owner = signers[0];

    const baseHTS = await TestHelper.deployMockBaseHTS();

    const stakingTokenContract = await TestHelper.deployERC20Mock();
    await stakingTokenContract.setUserBalance(owner.address, TOTAL_AMOUNT);
    await stakingTokenContract.setUserBalance(signers[1].address, TOTAL_AMOUNT);

    const reward1TokenContract = await TestHelper.deployERC20Mock();
    await reward1TokenContract.setUserBalance(owner.address, REWARD_AMOUNT);

    const reward2TokenContract = await TestHelper.deployERC20Mock();
    await reward2TokenContract.setUserBalance(owner.address, REWARD_AMOUNT);

    const ARGS = [
      baseHTS.address,
      stakingTokenContract.address,
      LOCKING_PERIOD,
    ];
    const vaultContract = await TestHelper.deployProxy("Vault", ...ARGS);
    const nonInitVaultContract = await TestHelper.deployLogic("Vault");

    return {
      ARGS,
      signers,
      baseHTS,
      vaultContract,
      stakingTokenContract,
      reward1TokenContract,
      reward2TokenContract,
      nonInitVaultContract,
      owner,
    };
  }

  describe("Common tests", function () {
    it("Verify contract initialization should be reverted when staking token address is zero", async function () {
      const { nonInitVaultContract, baseHTS } = await loadFixture(
        deployFixture
      );
      await expect(
        nonInitVaultContract.initialize(
          baseHTS.address,
          TestHelper.ZERO_ADDRESS,
          LOCKING_PERIOD
        )
      ).revertedWith("Vault: staking token should not be zero");
    });

    it("Verify contract initialization should be reverted when locking period is zero", async function () {
      const { nonInitVaultContract, baseHTS, stakingTokenContract } =
        await loadFixture(deployFixture);
      await expect(
        nonInitVaultContract.initialize(
          baseHTS.address,
          stakingTokenContract.address,
          0
        )
      ).revertedWith("Vault: locking period should be a positive number");
    });

    it("Verify contract should be reverted for multiple initialization call", async function () {
      const { ARGS, vaultContract } = await loadFixture(deployFixture);
      await expect(vaultContract.initialize(...ARGS)).revertedWith(
        "Initializable: contract is already initialized"
      );
    });

    it("Verify contract init params set properly", async function () {
      const { vaultContract, stakingTokenContract } = await loadFixture(
        deployFixture
      );
      expect(await vaultContract.getLockingPeriod()).equals(LOCKING_PERIOD);
      expect(await vaultContract.getStakingTokenAddress()).equals(
        stakingTokenContract.address
      );
    });
  });

  describe("Stake tests", function () {
    it("Verify stake operation should be reverted for non-positive amount", async function () {
      const { vaultContract } = await loadFixture(deployFixture);
      await expect(vaultContract.stake(0)).revertedWith(
        "Vault: stake amount must be a positive number"
      );
    });

    it("Verify stake operation should be reverted for token transfer failed", async function () {
      const { vaultContract, stakingTokenContract } = await loadFixture(
        deployFixture
      );
      await stakingTokenContract.setTransaferFailed(true);
      await expect(vaultContract.stake(STAKED_AMOUNT)).revertedWith(
        "Vault: Add stake failed"
      );
    });

    it("Verify stake operation should be succeeded for valid inputs", async function () {
      const { vaultContract, owner, stakingTokenContract } = await loadFixture(
        deployFixture
      );
      expect(await vaultContract.getStakingTokenTotalSupply()).equals(0);
      expect(await vaultContract.stakedTokenByUser(owner.address)).equals(0);
      expect(await stakingTokenContract.balanceOf(owner.address)).equals(
        TOTAL_AMOUNT
      );
      await vaultContract.stake(STAKED_AMOUNT);
      expect(await vaultContract.getStakingTokenTotalSupply()).equals(
        STAKED_AMOUNT
      );
      expect(await vaultContract.stakedTokenByUser(owner.address)).equals(
        STAKED_AMOUNT
      );
      expect(await stakingTokenContract.balanceOf(owner.address)).equals(
        TOTAL_AMOUNT - STAKED_AMOUNT
      );
    });
  });

  describe("Unstake tests", function () {
    it("Verify unstake operation should be reverted for non positive amount", async function () {
      const { vaultContract } = await loadFixture(deployFixture);
      await expect(vaultContract.unstake(0)).revertedWith(
        "Vault: unstake amount must be a positive number"
      );
    });

    it("Verify unstacked operation should be reverted when locking period is not over", async function () {
      const { vaultContract } = await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      await expect(vaultContract.unstake(UN_STAKED_AMOUNT)).revertedWith(
        "Vault: unstake not allowed"
      );
    });

    it("Verify unstake operation should be reverted when unstake amount is greater then stake amount", async function () {
      const { vaultContract } = await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      await TestHelper.increaseEVMTime(ADVANCE_LOCKING_PERIOD);
      await expect(vaultContract.unstake(STAKED_AMOUNT + 1)).revertedWith(
        "Vault: unstake not allowed"
      );
    });

    it("Verify unstake operation should be reverted during token transfer", async function () {
      const { vaultContract, stakingTokenContract } = await loadFixture(
        deployFixture
      );
      await vaultContract.stake(STAKED_AMOUNT);
      await TestHelper.increaseEVMTime(ADVANCE_LOCKING_PERIOD);
      await stakingTokenContract.setTransaferFailed(true);
      await expect(vaultContract.unstake(STAKED_AMOUNT)).revertedWith(
        "Vault: unstake failed"
      );
    });

    it("Verify partial unstake operation should be succeeded", async function () {
      const { vaultContract } = await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      await TestHelper.increaseEVMTime(ADVANCE_LOCKING_PERIOD);
      await vaultContract.unstake(UN_STAKED_AMOUNT);
      expect(await vaultContract.getStakingTokenTotalSupply()).equals(
        STAKED_AMOUNT - UN_STAKED_AMOUNT
      );
    });

    it("Verify fully unstake operation should be succeeded", async function () {
      const { vaultContract } = await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      await TestHelper.increaseEVMTime(ADVANCE_LOCKING_PERIOD);
      await vaultContract.unstake(STAKED_AMOUNT);
      expect(await vaultContract.getStakingTokenTotalSupply()).equals(0);
    });
  });

  describe("Add rewards tests", function () {
    it("Verify reward operation should be reverted for zero token address", async function () {
      const { vaultContract, owner } = await loadFixture(deployFixture);
      await expect(
        vaultContract.addReward(
          TestHelper.ZERO_ADDRESS,
          REWARD_AMOUNT,
          owner.address
        )
      ).revertedWith("Vault: reward token should not be zero");
    });

    it("Verify reward operation should be reverted for zero sender address", async function () {
      const { vaultContract, reward1TokenContract } = await loadFixture(
        deployFixture
      );
      await expect(
        vaultContract.addReward(
          reward1TokenContract.address,
          REWARD_AMOUNT,
          TestHelper.ZERO_ADDRESS
        )
      ).revertedWith("Vault: from address should not be zero");
    });

    it("Verify reward operation should be reverted for non-positive amount", async function () {
      const { vaultContract, owner, reward1TokenContract } = await loadFixture(
        deployFixture
      );
      await expect(
        vaultContract.addReward(reward1TokenContract.address, 0, owner.address)
      ).revertedWith("Vault: reward amount must be a positive number");
    });

    it("Verify reward operation should be reverted if no token stacked yet", async function () {
      const { vaultContract, reward1TokenContract, owner } = await loadFixture(
        deployFixture
      );
      await expect(
        vaultContract.addReward(
          reward1TokenContract.address,
          REWARD_AMOUNT,
          owner.address
        )
      ).revertedWith("Vault: no token staked yet");
    });

    it("Verify reward operation should be reverted during token transfer", async function () {
      const { vaultContract, owner, reward1TokenContract } = await loadFixture(
        deployFixture
      );
      await vaultContract.stake(STAKED_AMOUNT);
      await reward1TokenContract.setTransaferFailed(true);
      await expect(
        vaultContract.addReward(
          reward1TokenContract.address,
          REWARD_AMOUNT,
          owner.address
        )
      ).revertedWith("Vault: Add reward failed");
    });

    it("Verify reward operation should be succeeded for valid inputs", async function () {
      const { vaultContract, owner, reward1TokenContract } = await loadFixture(
        deployFixture
      );
      expect(
        await reward1TokenContract.balanceOf(vaultContract.address)
      ).equals(0);
      await vaultContract.stake(STAKED_AMOUNT);
      await vaultContract.addReward(
        reward1TokenContract.address,
        REWARD_AMOUNT,
        owner.address
      );
      await vaultContract.addReward(
        reward1TokenContract.address,
        REWARD_AMOUNT,
        owner.address
      );
      expect(
        await reward1TokenContract.balanceOf(vaultContract.address)
      ).equals(REWARD_AMOUNT);
    });
  });

  describe("Claim rewards tests", function () {
    it("Verify specific claim rewards should be reverted for unknown token", async function () {
      const {
        owner,
        vaultContract,
        reward1TokenContract,
        reward2TokenContract,
      } = await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      await vaultContract.addReward(
        reward1TokenContract.address,
        REWARD_AMOUNT,
        owner.address
      );
      await vaultContract.addReward(
        reward2TokenContract.address,
        REWARD_AMOUNT,
        owner.address
      );
      await expect(
        vaultContract.claimSpecificRewards(owner.address, [
          TestHelper.ONE_ADDRESS,
        ])
      ).revertedWith("Vault: invalid token");
    });

    it("Verify claim rewards should be reverted during token transfer", async function () {
      const { owner, vaultContract, reward1TokenContract } = await loadFixture(
        deployFixture
      );
      await vaultContract.stake(STAKED_AMOUNT);
      await vaultContract.addReward(
        reward1TokenContract.address,
        REWARD_AMOUNT,
        owner.address
      );
      await reward1TokenContract.setTransaferFailed(true);
      await expect(
        vaultContract.claimSpecificRewards(owner.address, [
          reward1TokenContract.address,
        ])
      ).revertedWith("Vault: Claim reward failed");
    });

    it("Verify one people, one type of reward, one unstake, add reward", async function () {
      const { vaultContract, owner, reward1TokenContract } = await loadFixture(
        deployFixture
      );
      await vaultContract.stake(STAKED_AMOUNT);
      await vaultContract.addReward(
        reward1TokenContract.address,
        REWARD_AMOUNT,
        owner.address
      );
      await TestHelper.increaseEVMTime(ADVANCE_LOCKING_PERIOD);
      await vaultContract.unstake(UN_STAKED_AMOUNT);
      expect(await vaultContract.getStakingTokenTotalSupply()).equals(
        STAKED_AMOUNT - UN_STAKED_AMOUNT
      );
      expect(
        await reward1TokenContract.balanceOf(vaultContract.address)
      ).equals(0);
      expect(await reward1TokenContract.balanceOf(owner.address)).equals(
        REWARD_AMOUNT
      );
    });

    it("Verify two people, two type of rewards, one unstake, add reward", async function () {
      const {
        vaultContract,
        owner,
        signers,
        reward1TokenContract,
        reward2TokenContract,
      } = await loadFixture(deployFixture);
      await vaultContract.connect(owner).stake(STAKED_AMOUNT);
      await vaultContract.connect(signers[1]).stake(STAKED_AMOUNT);

      await vaultContract.addReward(
        reward1TokenContract.address,
        REWARD_AMOUNT,
        owner.address
      );
      await vaultContract.addReward(
        reward2TokenContract.address,
        REWARD_AMOUNT,
        owner.address
      );

      await TestHelper.increaseEVMTime(ADVANCE_LOCKING_PERIOD);
      await vaultContract.connect(owner).unstake(UN_STAKED_AMOUNT);
      expect(await vaultContract.getStakingTokenTotalSupply()).equals(
        STAKED_AMOUNT * 2 - UN_STAKED_AMOUNT
      );
      expect(await reward1TokenContract.balanceOf(owner.address)).equals(
        REWARD_AMOUNT / 2
      );
      expect(await reward2TokenContract.balanceOf(owner.address)).equals(
        REWARD_AMOUNT / 2
      );
      expect(await reward1TokenContract.balanceOf(signers[1].address)).equals(
        0
      );
      expect(await reward2TokenContract.balanceOf(signers[1].address)).equals(
        0
      );
    });

    it("one people, one type of reward, add reward, two unstake", async function () {
      const { vaultContract, owner, reward1TokenContract } = await loadFixture(
        deployFixture
      );
      const LOCAL_STAKED_AMOUNT = STAKED_AMOUNT / 2;
      await vaultContract.stake(LOCAL_STAKED_AMOUNT);
      await vaultContract.addReward(
        reward1TokenContract.address,
        REWARD_AMOUNT,
        owner.address
      );
      await vaultContract.stake(LOCAL_STAKED_AMOUNT);
      expect(await vaultContract.stakedTokenByUser(owner.address)).equals(
        STAKED_AMOUNT
      );
      expect(await reward1TokenContract.balanceOf(owner.address)).equals(
        REWARD_AMOUNT
      );
      expect(
        await reward1TokenContract.balanceOf(vaultContract.address)
      ).equals(0);

      await TestHelper.increaseEVMTime(ADVANCE_LOCKING_PERIOD);
      // 1st - unstake
      await vaultContract.unstake(LOCAL_STAKED_AMOUNT);
      expect(await vaultContract.stakedTokenByUser(owner.address)).equals(
        LOCAL_STAKED_AMOUNT
      );
      expect(await vaultContract.getStakingTokenTotalSupply()).equals(
        LOCAL_STAKED_AMOUNT
      );

      // 2nd - unstake
      await vaultContract.unstake(LOCAL_STAKED_AMOUNT);
      expect(await vaultContract.stakedTokenByUser(owner.address)).equals(0);
      expect(await vaultContract.getStakingTokenTotalSupply()).equals(0);
    });

    it("one people, one type of reward, add reward, claim all rewards", async function () {
      const {
        owner,
        vaultContract,
        reward1TokenContract,
        reward2TokenContract,
      } = await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      await vaultContract.addReward(
        reward1TokenContract.address,
        REWARD_AMOUNT,
        owner.address
      );
      await vaultContract.addReward(
        reward2TokenContract.address,
        REWARD_AMOUNT,
        owner.address
      );
      await vaultContract.claimAllRewards(owner.address);
      expect(await reward1TokenContract.balanceOf(owner.address)).equals(
        REWARD_AMOUNT
      );
      expect(await reward2TokenContract.balanceOf(owner.address)).equals(
        REWARD_AMOUNT
      );
    });

    it("one people, one type of reward, add reward, claim specific rewards", async function () {
      const {
        owner,
        vaultContract,
        reward1TokenContract,
        reward2TokenContract,
      } = await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      await vaultContract.addReward(
        reward1TokenContract.address,
        REWARD_AMOUNT,
        owner.address
      );
      await vaultContract.addReward(
        reward2TokenContract.address,
        REWARD_AMOUNT,
        owner.address
      );
      await vaultContract.claimSpecificRewards(owner.address, [
        reward1TokenContract.address,
      ]);
      expect(await reward1TokenContract.balanceOf(owner.address)).equals(
        REWARD_AMOUNT
      );
      expect(await reward2TokenContract.balanceOf(owner.address)).equals(0);
      expect(
        await reward2TokenContract.balanceOf(vaultContract.address)
      ).equals(REWARD_AMOUNT);
    });
  });
});
