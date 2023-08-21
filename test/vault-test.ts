import { expect } from "chai";
import { ethers, Contract } from "ethers";
import { TestHelper } from "./TestHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Vault Tests", function () {
  const TOTAL_AMOUNT = TestHelper.toPrecision(2000);
  const STAKED_AMOUNT = TestHelper.toPrecision(100);
  const UN_STAKED_AMOUNT = TestHelper.toPrecision(10);
  const REWARD_AMOUNT = TestHelper.toPrecision(10);
  const LOCKING_PERIOD = 50; // 50 sec locking period
  const ADVANCE_LOCKING_PERIOD = LOCKING_PERIOD + 1; // 51 sec advance locking period

  async function deployFixture() {
    const signers = await TestHelper.getSigners();
    const owner = signers[0];

    const systemRoleBasedAccess =
      await TestHelper.deploySystemRoleBasedAccess();
    const vaultAddRewardUser = await TestHelper.vaultAddRewardUser();

    const hederaService = await TestHelper.deployMockHederaService();

    const stakingTokenContract = await TestHelper.deployERC20Mock();
    await stakingTokenContract.setUserBalance(owner.address, TOTAL_AMOUNT);
    await stakingTokenContract.setUserBalance(signers[1].address, TOTAL_AMOUNT);

    const reward1TokenContract = await TestHelper.deployERC20Mock();
    await reward1TokenContract.setUserBalance(owner.address, TOTAL_AMOUNT);

    const reward2TokenContract = await TestHelper.deployERC20Mock();
    await reward2TokenContract.setUserBalance(owner.address, TOTAL_AMOUNT);

    const rewardsContract = await Promise.all(
      [...Array(100).keys()].map(async () => {
        const contract = await TestHelper.deployERC20Mock();
        await contract.setUserBalance(owner.address, TOTAL_AMOUNT);
        return contract;
      })
    );

    const ARGS = [
      hederaService.address,
      stakingTokenContract.address,
      LOCKING_PERIOD,
      systemRoleBasedAccess.address,
    ];
    const vaultContract = await TestHelper.deployProxy("Vault", ...ARGS);
    const nonInitVaultContract = await TestHelper.deployLogic("Vault");

    return {
      ARGS,
      signers,
      hederaService,
      vaultContract,
      stakingTokenContract,
      reward1TokenContract,
      reward2TokenContract,
      nonInitVaultContract,
      rewardsContract,
      owner,
      systemRoleBasedAccess,
      vaultAddRewardUser,
    };
  }

  async function verifyClaimRewardsCallResponseEvent(
    txn: any,
    owner: SignerWithAddress,
    alreadyClaimedCount: number,
    claimedRewardsCount: number,
    unclaimedRewardsCount: number,
    totalRewardsCount: number
  ) {
    const lastEvent = (
      await TestHelper.readEvents(txn, ["ClaimRewardsCallResponse"])
    ).pop();
    const { name, args } = { name: lastEvent.event, args: lastEvent.args };
    const claimedRewardsTokens = args.response.claimedRewardsTokens.filter(
      (item: string) => ethers.constants.AddressZero !== item
    );
    expect(name).equals("ClaimRewardsCallResponse");
    expect(args.length).equals(2);
    expect(args.user).equals(owner.address);
    expect(args.response.alreadyClaimedCount).equals(alreadyClaimedCount);
    expect(args.response.claimedRewardsCount).equals(claimedRewardsCount);
    expect(args.response.unclaimedRewardsCount).equals(unclaimedRewardsCount);
    expect(args.response.totalRewardsCount).equals(totalRewardsCount);
    expect(claimedRewardsTokens.length).equals(claimedRewardsCount);
  }

  async function verifyRewardAddedEvent(
    txn: any,
    owner: SignerWithAddress,
    rewardTokenContract: Contract,
    rewardAmount: number
  ) {
    const { name, args } = await TestHelper.readLastEvent(txn);
    expect(name).equals("RewardAdded");
    expect(args.length).equals(3);
    expect(args.user).equals(owner.address);
    expect(args.reward).equals(rewardTokenContract.address);
    expect(args.amount).equals(rewardAmount);
  }

  async function verifyUnStakedEvent(
    txn: any,
    owner: SignerWithAddress,
    unStakedAmount: number
  ) {
    const { name, args } = await TestHelper.readLastEvent(txn);
    expect(name).equals("UnStaked");
    expect(args.length).equals(2);
    expect(args.user).equals(owner.address);
    expect(args.amount).equals(unStakedAmount);
  }

  async function verifyStakedEvent(
    txn: any,
    owner: SignerWithAddress,
    stakedAmount: number
  ) {
    const { name, args } = await TestHelper.readLastEvent(txn);
    expect(name).equals("Staked");
    expect(args.length).equals(2);
    expect(args.user).equals(owner.address);
    expect(args.amount).equals(stakedAmount);
  }

  describe("Common tests", function () {
    it("Verify contract initialization should be reverted when staking token address is zero", async function () {
      const { nonInitVaultContract, hederaService, systemRoleBasedAccess } =
        await loadFixture(deployFixture);
      await expect(
        nonInitVaultContract.initialize(
          hederaService.address,
          TestHelper.ZERO_ADDRESS,
          LOCKING_PERIOD,
          systemRoleBasedAccess.address
        )
      ).revertedWith("Vault: staking token should not be zero");
    });

    it("Verify contract initialization should be reverted when locking period is zero", async function () {
      const {
        nonInitVaultContract,
        hederaService,
        stakingTokenContract,
        systemRoleBasedAccess,
      } = await loadFixture(deployFixture);
      await expect(
        nonInitVaultContract.initialize(
          hederaService.address,
          stakingTokenContract.address,
          0,
          systemRoleBasedAccess.address
        )
      ).revertedWith("Vault: locking period should be a positive number");
    });

    it("Verify contract should be reverted for multiple initialization call", async function () {
      const { ARGS, vaultContract } = await loadFixture(deployFixture);
      await expect(vaultContract.initialize(...ARGS)).revertedWith(
        "Initializable: contract is already initialized"
      );
    });

    it("Verify update hedera service should be reverted for non-owner user", async function () {
      const { vaultContract, hederaService, signers } = await loadFixture(
        deployFixture
      );
      await expect(
        vaultContract
          .connect(signers[1])
          .upgradeHederaService(hederaService.address)
      ).revertedWith("Ownable: caller is not the owner");
    });

    it("Verify update hedera service should be succeeded for owner user", async function () {
      const { vaultContract } = await loadFixture(deployFixture);
      const hederaService = await TestHelper.deployMockHederaService();
      await vaultContract.upgradeHederaService(hederaService.address);
      expect(await vaultContract.getHederaServiceVersion()).equals(
        hederaService.address
      );
    });

    it("Verify contract init params set properly", async function () {
      const { vaultContract, stakingTokenContract, hederaService } =
        await loadFixture(deployFixture);
      expect(await vaultContract.getStakingTokenLockingPeriod()).equals(
        LOCKING_PERIOD
      );
      expect(await vaultContract.getStakingTokenAddress()).equals(
        stakingTokenContract.address
      );
      expect(await vaultContract.getHederaServiceVersion()).equals(
        hederaService.address
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
        "Vault: staking failed"
      );
    });

    it("Verify stake operation should emit 'Staked' event", async function () {
      const { vaultContract, owner } = await loadFixture(deployFixture);
      const txn = await vaultContract.stake(STAKED_AMOUNT);
      await verifyStakedEvent(txn, owner, STAKED_AMOUNT);
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
      expect(
        await stakingTokenContract.balanceOf(vaultContract.address)
      ).equals(0);

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
      expect(
        await stakingTokenContract.balanceOf(vaultContract.address)
      ).equals(STAKED_AMOUNT);
    });

    it("Verify multiple stake calls required when rewards can not be claimed automatically in one stake call for same user", async function () {
      const { vaultContract, owner, rewardsContract, vaultAddRewardUser } =
        await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      expect(await vaultContract.getStakingTokenTotalSupply()).equals(
        STAKED_AMOUNT
      );
      for (const rewardContract of rewardsContract) {
        await vaultContract
          .connect(vaultAddRewardUser)
          .addReward(rewardContract.address, REWARD_AMOUNT, owner.address);
      }
      await vaultContract.stake(STAKED_AMOUNT);
      await vaultContract.stake(STAKED_AMOUNT);
      const txn = await vaultContract.stake(STAKED_AMOUNT);
      await verifyClaimRewardsCallResponseEvent(txn, owner, 80, 20, 0, 100);
      await verifyStakedEvent(txn, owner, STAKED_AMOUNT);
      expect(await vaultContract.getStakingTokenTotalSupply()).equals(
        STAKED_AMOUNT * 2
      );
    });

    it("Verify existing rewards will not be given out during staking for new user", async function () {
      const {
        vaultContract,
        owner,
        signers,
        reward1TokenContract,
        vaultAddRewardUser,
      } = await loadFixture(deployFixture);
      await vaultContract.connect(owner).stake(STAKED_AMOUNT);
      await vaultContract
        .connect(vaultAddRewardUser)
        .addReward(reward1TokenContract.address, REWARD_AMOUNT, owner.address);
      await vaultContract.connect(signers[1]).stake(STAKED_AMOUNT);
      expect(await vaultContract.canUserClaimRewards(owner.address)).equals(
        true
      );
      expect(
        await vaultContract.canUserClaimRewards(signers[1].address)
      ).equals(false);
    });
  });

  describe("Unstake tests", function () {
    it("Verify unstake operation should be reverted for non positive amount", async function () {
      const { vaultContract } = await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
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

    it("Verify unstake operation should be reverted when unstake amount is greater then staked amount", async function () {
      const { vaultContract } = await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      await TestHelper.increaseEVMTime(ADVANCE_LOCKING_PERIOD);
      await expect(vaultContract.unstake(STAKED_AMOUNT + 1)).revertedWith(
        "Vault: unstake not allowed"
      );
    });

    it("Verify unstake operation should be reverted when no stake amount available for given user", async function () {
      const { vaultContract, signers } = await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      await TestHelper.increaseEVMTime(ADVANCE_LOCKING_PERIOD);
      await expect(
        vaultContract.connect(signers[1]).unstake(STAKED_AMOUNT)
      ).revertedWith("Vault: unstake not allowed");
    });

    it("Verify unstake operation should be reverted during token transfer", async function () {
      const { vaultContract, stakingTokenContract } = await loadFixture(
        deployFixture
      );
      await vaultContract.stake(STAKED_AMOUNT);
      await TestHelper.increaseEVMTime(ADVANCE_LOCKING_PERIOD);
      await stakingTokenContract.setTransaferFailed(true);
      await expect(vaultContract.unstake(STAKED_AMOUNT)).revertedWith(
        "Vault: unstaking failed"
      );
    });

    it("Verify partial unstake operation should emit 'UnStaked' event", async function () {
      const { vaultContract, owner } = await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      await TestHelper.increaseEVMTime(ADVANCE_LOCKING_PERIOD);
      const txn = await vaultContract.unstake(STAKED_AMOUNT);
      await verifyUnStakedEvent(txn, owner, STAKED_AMOUNT);
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

    it("Verify multiple unstake calls required when rewards can not be claimed automatically in one unstake call", async function () {
      const { vaultContract, owner, rewardsContract, vaultAddRewardUser } =
        await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      for (const rewardContract of rewardsContract) {
        await vaultContract
          .connect(vaultAddRewardUser)
          .addReward(rewardContract.address, REWARD_AMOUNT, owner.address);
      }
      await TestHelper.increaseEVMTime(ADVANCE_LOCKING_PERIOD);
      await vaultContract.unstake(STAKED_AMOUNT);
      await vaultContract.unstake(STAKED_AMOUNT);
      const txn = await vaultContract.unstake(STAKED_AMOUNT);
      await verifyClaimRewardsCallResponseEvent(txn, owner, 80, 20, 0, 100);
      await verifyUnStakedEvent(txn, owner, STAKED_AMOUNT);
    });
  });

  describe("Add rewards tests", function () {
    it("When non-reward-user try to add reward then should fail", async function () {
      const { vaultContract, owner, signers, vaultAddRewardUser } =
        await loadFixture(deployFixture);
      const anyUser = signers[0];
      expect(anyUser.address).not.equals(vaultAddRewardUser.address);
      await expect(
        vaultContract
          .connect(anyUser)
          .addReward(TestHelper.ZERO_ADDRESS, REWARD_AMOUNT, owner.address)
      ).reverted;
    });

    it("Verify reward operation should be reverted for zero token address", async function () {
      const { vaultContract, owner, vaultAddRewardUser } = await loadFixture(
        deployFixture
      );
      await expect(
        vaultContract
          .connect(vaultAddRewardUser)
          .addReward(TestHelper.ZERO_ADDRESS, REWARD_AMOUNT, owner.address)
      ).revertedWith("Vault: reward token should not be zero");
    });

    it("Verify reward operation should be reverted for zero sender address", async function () {
      const { vaultContract, reward1TokenContract, vaultAddRewardUser } =
        await loadFixture(deployFixture);
      await expect(
        vaultContract
          .connect(vaultAddRewardUser)
          .addReward(
            reward1TokenContract.address,
            REWARD_AMOUNT,
            TestHelper.ZERO_ADDRESS
          )
      ).revertedWith("Vault: from address should not be zero");
    });

    it("Verify reward operation should be reverted for non-positive amount", async function () {
      const { vaultContract, owner, reward1TokenContract, vaultAddRewardUser } =
        await loadFixture(deployFixture);
      await expect(
        vaultContract
          .connect(vaultAddRewardUser)
          .addReward(reward1TokenContract.address, 0, owner.address)
      ).revertedWith("Vault: reward amount must be a positive number");
    });

    it("Verify reward operation should be reverted if no token stacked yet", async function () {
      const { vaultContract, reward1TokenContract, owner, vaultAddRewardUser } =
        await loadFixture(deployFixture);
      await expect(
        vaultContract
          .connect(vaultAddRewardUser)
          .addReward(reward1TokenContract.address, REWARD_AMOUNT, owner.address)
      ).revertedWith("Vault: no token staked yet");
    });

    it("Verify reward operation should be reverted during token transfer", async function () {
      const { vaultContract, owner, reward1TokenContract, vaultAddRewardUser } =
        await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      await reward1TokenContract.setTransaferFailed(true);
      await expect(
        vaultContract
          .connect(vaultAddRewardUser)
          .addReward(reward1TokenContract.address, REWARD_AMOUNT, owner.address)
      ).revertedWith("Vault: Add reward failed");
    });

    it("Verify reward and staked token cannot be same", async function () {
      const { vaultContract, owner, stakingTokenContract, vaultAddRewardUser } =
        await loadFixture(deployFixture);

      await vaultContract.stake(STAKED_AMOUNT);

      await expect(
        vaultContract
          .connect(vaultAddRewardUser)
          .addReward(stakingTokenContract.address, REWARD_AMOUNT, owner.address)
      ).revertedWith("Vault: Reward and Staking tokens cannot be same.");
    });

    it("Verify reward operation should emit 'RewardAdded' event", async function () {
      const {
        vaultContract,
        owner,
        reward1TokenContract: reward1,
        vaultAddRewardUser,
      } = await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      const txn = await vaultContract
        .connect(vaultAddRewardUser)
        .addReward(reward1.address, REWARD_AMOUNT, owner.address);
      await verifyRewardAddedEvent(txn, owner, reward1, REWARD_AMOUNT);
    });

    it("Verify reward operations should be succeeded for valid inputs", async function () {
      const {
        vaultContract,
        owner,
        reward1TokenContract: reward1,
        reward2TokenContract: reward2,
        vaultAddRewardUser,
      } = await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);

      expect(await reward1.balanceOf(vaultContract.address)).equals(0);
      expect(await reward2.balanceOf(vaultContract.address)).equals(0);

      await vaultContract
        .connect(vaultAddRewardUser)
        .addReward(reward1.address, REWARD_AMOUNT, owner.address);
      await vaultContract
        .connect(vaultAddRewardUser)
        .addReward(reward1.address, REWARD_AMOUNT, owner.address);
      await vaultContract
        .connect(vaultAddRewardUser)
        .addReward(reward2.address, REWARD_AMOUNT, owner.address);

      expect(await reward1.balanceOf(vaultContract.address)).equals(
        REWARD_AMOUNT * 2
      );
      expect(await reward2.balanceOf(vaultContract.address)).equals(
        REWARD_AMOUNT
      );
    });
  });

  describe("Claim rewards tests", function () {
    it("Verify claim rewards should be reverted during token transfer", async function () {
      const { owner, vaultContract, reward1TokenContract, vaultAddRewardUser } =
        await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      await vaultContract
        .connect(vaultAddRewardUser)
        .addReward(reward1TokenContract.address, REWARD_AMOUNT, owner.address);
      await reward1TokenContract.setTransaferFailed(true);
      await expect(vaultContract.claimRewards(owner.address)).revertedWith(
        "Vault: Claim reward failed"
      );
    });

    it("Verify claim rewards call can transfer at-most 40 in single txn", async function () {
      const {
        owner,
        vaultContract,
        rewardsContract,
        reward1TokenContract: reward1,
        vaultAddRewardUser,
      } = await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      for (const rewardContract of rewardsContract) {
        await vaultContract
          .connect(vaultAddRewardUser)
          .addReward(rewardContract.address, REWARD_AMOUNT, owner.address);
      }
      const txn = await vaultContract.claimRewards(owner.address);
      await verifyClaimRewardsCallResponseEvent(txn, owner, 0, 40, 60, 100);

      const txn1 = await vaultContract.claimRewards(owner.address);
      await verifyClaimRewardsCallResponseEvent(txn1, owner, 40, 40, 20, 100);

      const txn2 = await vaultContract.claimRewards(owner.address);
      await verifyClaimRewardsCallResponseEvent(txn2, owner, 80, 20, 0, 100);

      await vaultContract
        .connect(vaultAddRewardUser)
        .addReward(reward1.address, REWARD_AMOUNT, owner.address);

      const txn3 = await vaultContract.claimRewards(owner.address);
      await verifyClaimRewardsCallResponseEvent(txn3, owner, 100, 1, 0, 101);

      const txn4 = await vaultContract.claimRewards(owner.address);
      await verifyClaimRewardsCallResponseEvent(txn4, owner, 101, 0, 0, 101);
    });

    it("Verify claim rewards call when no reward tokens are available", async function () {
      const { owner, vaultContract } = await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);

      const txn = await vaultContract.claimRewards(owner.address);
      await verifyClaimRewardsCallResponseEvent(txn, owner, 0, 0, 0, 0);
    });

    it("Verify one people, one stake, add reward, claim reward, one unstake", async function () {
      const { vaultContract, owner, reward1TokenContract, vaultAddRewardUser } =
        await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      await vaultContract
        .connect(vaultAddRewardUser)
        .addReward(reward1TokenContract.address, REWARD_AMOUNT, owner.address);
      await TestHelper.increaseEVMTime(ADVANCE_LOCKING_PERIOD);
      await vaultContract.claimRewards(owner.address);
      await vaultContract.unstake(UN_STAKED_AMOUNT);
      expect(
        await reward1TokenContract.balanceOf(vaultContract.address)
      ).equals(0);
      expect(await reward1TokenContract.balanceOf(owner.address)).equals(
        TOTAL_AMOUNT
      );
    });

    it("Verify two people, two type of rewards, one unstake, add reward", async function () {
      const {
        vaultContract,
        owner,
        signers,
        reward1TokenContract,
        reward2TokenContract,
        vaultAddRewardUser,
      } = await loadFixture(deployFixture);
      await vaultContract.connect(owner).stake(STAKED_AMOUNT);
      await vaultContract.connect(signers[1]).stake(STAKED_AMOUNT);

      await vaultContract
        .connect(vaultAddRewardUser)
        .addReward(reward1TokenContract.address, REWARD_AMOUNT, owner.address);
      await vaultContract
        .connect(vaultAddRewardUser)
        .addReward(reward2TokenContract.address, REWARD_AMOUNT, owner.address);

      await TestHelper.increaseEVMTime(ADVANCE_LOCKING_PERIOD);
      await vaultContract.claimRewards(owner.address);
      await vaultContract.connect(owner).unstake(UN_STAKED_AMOUNT);
      expect(await vaultContract.getStakingTokenTotalSupply()).equals(
        STAKED_AMOUNT * 2 - UN_STAKED_AMOUNT
      );
      expect(await reward1TokenContract.balanceOf(owner.address)).equals(
        TOTAL_AMOUNT - REWARD_AMOUNT / 2
      );
      expect(await reward2TokenContract.balanceOf(owner.address)).equals(
        TOTAL_AMOUNT - REWARD_AMOUNT / 2
      );
      expect(await reward1TokenContract.balanceOf(signers[1].address)).equals(
        0
      );
      expect(await reward2TokenContract.balanceOf(signers[1].address)).equals(
        0
      );
    });

    it("one people, one type of reward, add reward, two unstake", async function () {
      const { vaultContract, owner, reward1TokenContract, vaultAddRewardUser } =
        await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      await vaultContract
        .connect(vaultAddRewardUser)
        .addReward(reward1TokenContract.address, REWARD_AMOUNT, owner.address);
      expect(await vaultContract.stakedTokenByUser(owner.address)).equals(
        STAKED_AMOUNT
      );
      expect(
        await reward1TokenContract.balanceOf(vaultContract.address)
      ).equals(REWARD_AMOUNT);
      await TestHelper.increaseEVMTime(ADVANCE_LOCKING_PERIOD);

      // 1st - unstake
      await vaultContract.claimRewards(owner.address);
      await vaultContract.unstake(STAKED_AMOUNT / 2);
      expect(await vaultContract.stakedTokenByUser(owner.address)).equals(
        STAKED_AMOUNT / 2
      );
      expect(await vaultContract.getStakingTokenTotalSupply()).equals(
        STAKED_AMOUNT / 2
      );

      // 2nd - unstake
      await vaultContract.unstake(STAKED_AMOUNT / 2);
      expect(await vaultContract.stakedTokenByUser(owner.address)).equals(0);
      expect(await vaultContract.getStakingTokenTotalSupply()).equals(0);
    });

    it("one people, one type of reward, add reward, claim rewards", async function () {
      const {
        owner,
        vaultContract,
        reward1TokenContract,
        reward2TokenContract,
        vaultAddRewardUser,
      } = await loadFixture(deployFixture);
      await vaultContract.stake(STAKED_AMOUNT);
      await vaultContract
        .connect(vaultAddRewardUser)
        .addReward(reward1TokenContract.address, REWARD_AMOUNT, owner.address);
      await vaultContract
        .connect(vaultAddRewardUser)
        .addReward(reward2TokenContract.address, REWARD_AMOUNT, owner.address);
      await vaultContract.claimRewards(owner.address);
      expect(await reward1TokenContract.balanceOf(owner.address)).equals(
        TOTAL_AMOUNT
      );
      expect(await reward2TokenContract.balanceOf(owner.address)).equals(
        TOTAL_AMOUNT
      );
      expect(
        await reward1TokenContract.balanceOf(vaultContract.address)
      ).equals(0);
      expect(
        await reward2TokenContract.balanceOf(vaultContract.address)
      ).equals(0);
    });
  });
});
