import { expect } from "chai";
import { TestHelper } from "./TestHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("Splitter tests", function () {
  const LOCKING_PERIOD = 50;

  const STAKED_AMOUNT_1 = TestHelper.toPrecision(1000);
  const STAKED_AMOUNT_2 = TestHelper.toPrecision(50);
  const STAKED_AMOUNT_3 = TestHelper.toPrecision(100);
  const STAKED_ARRAY = [STAKED_AMOUNT_1, STAKED_AMOUNT_2, STAKED_AMOUNT_3];
  const TOTAL_STAKED_AMOUNT = STAKED_ARRAY.reduce((a, b) => a + b);

  const MULTIPLIERS = [1, 14, 30];
  const REWARD_AMOUNT = TestHelper.toPrecision(100);
  const EACH_VAULT_WEIGHT = MULTIPLIERS.map(
    (value, index) => value * STAKED_ARRAY[index]
  );
  const ALL_VAULTS_WEIGHT = EACH_VAULT_WEIGHT.reduce((a, b) => a + b);

  const REWARDS_AMOUNT_ARRAY = EACH_VAULT_WEIGHT.map((item) =>
    parseInt(((item * REWARD_AMOUNT) / ALL_VAULTS_WEIGHT).toString())
  );

  async function deployFixture() {
    const signers = await TestHelper.getSigners();
    const owner = signers[0];

    const hederaService = await TestHelper.deployMockHederaService();
    const stakingTokenContract = await TestHelper.deployERC20Mock();
    await stakingTokenContract.setUserBalance(
      owner.address,
      TOTAL_STAKED_AMOUNT
    );

    const rewardTokenContract = await TestHelper.deployERC20Mock();
    await rewardTokenContract.setUserBalance(owner.address, REWARD_AMOUNT);

    const ARGS = [
      hederaService.address,
      stakingTokenContract.address,
      LOCKING_PERIOD,
    ];
    const vaultContract1 = await TestHelper.deployProxy("Vault", ...ARGS);
    await vaultContract1.stake(STAKED_AMOUNT_1);

    const vaultContract2 = await TestHelper.deployProxy("Vault", ...ARGS);
    await vaultContract2.stake(STAKED_AMOUNT_2);

    const vaultContract3 = await TestHelper.deployProxy("Vault", ...ARGS);
    await vaultContract3.stake(STAKED_AMOUNT_3);

    const nonUsedVaultContract = await TestHelper.deployProxy("Vault", ...ARGS);

    const USED_VAULTS = [vaultContract1, vaultContract2, vaultContract3];

    const SPLITTER_ARGS = [
      USED_VAULTS.map((contract) => contract.address),
      MULTIPLIERS,
    ];
    const splitterContract = await TestHelper.deployLogic("Splitter");
    const txn = await splitterContract.initialize(...SPLITTER_ARGS);
    const vaultAddedEvents = await TestHelper.readEvents(txn, ["VaultAdded"]);
    expect(vaultAddedEvents.length).equals(USED_VAULTS.length);
    vaultAddedEvents.forEach((element: any, index: number) => {
      expect(element.args.length).equals(2);
      expect(element.args.vault).equals(USED_VAULTS[index].address);
      expect(element.args.multiplier).equals(MULTIPLIERS[index]);
    });

    const nonInitSplitterContract = await TestHelper.deployLogic("Splitter");

    return {
      ARGS,
      owner,
      vaults: USED_VAULTS,
      rewards: REWARDS_AMOUNT_ARRAY,
      hederaService,
      signers,
      SPLITTER_ARGS,
      vaultContract1,
      vaultContract2,
      vaultContract3,
      splitterContract,
      rewardTokenContract,
      nonUsedVaultContract,
      stakingTokenContract,
      nonInitSplitterContract,
    };
  }

  describe("Common tests", function () {
    it("Verify contract should be reverted for multiple initialization call", async function () {
      const { splitterContract, SPLITTER_ARGS } = await loadFixture(
        deployFixture
      );
      await expect(splitterContract.initialize(...SPLITTER_ARGS)).revertedWith(
        "Initializable: contract is already initialized"
      );
    });

    it("Verify contract initialization call should be reverted when vaults and multipliers length mismatch", async function () {
      const { nonInitSplitterContract, vaultContract1 } = await loadFixture(
        deployFixture
      );
      await expect(
        nonInitSplitterContract.initialize([vaultContract1.address], [1, 14])
      ).revertedWith(
        "Splitter: vaults and multipliers length must be greater than zero"
      );
    });

    it("Verify contract initialization call should be reverted when vaults or multipliers length is zero", async function () {
      const { nonInitSplitterContract, vaultContract1 } = await loadFixture(
        deployFixture
      );
      await expect(
        nonInitSplitterContract.initialize([vaultContract1.address], [])
      ).revertedWith(
        "Splitter: vaults and multipliers length must be greater than zero"
      );
    });

    it("Verify split token method call", async function () {
      const { owner, splitterContract, rewardTokenContract, vaults, rewards } =
        await loadFixture(deployFixture);
      const txn = await splitterContract.splitTokens(
        rewardTokenContract.address,
        owner.address,
        REWARD_AMOUNT
      );
      const events = (await txn.wait()).events;
      for (let i = 0; i < events.length; i++) {
        const eventData = events[i];
        expect(eventData.event).equals("TokenTransferred");
        expect(eventData.args.length).equals(2);
        expect(eventData.args.vault).equals(vaults[i].address);
        expect(eventData.args.amount).equals(rewards[i]);
        expect(await rewardTokenContract.balanceOf(vaults[i].address)).equals(
          rewards[i]
        );
      }
    });
  });

  describe("Register vault tests", function () {
    it("Check register operation should be reverted for non owner user", async function () {
      const { splitterContract, nonUsedVaultContract, signers } =
        await loadFixture(deployFixture);
      await expect(
        splitterContract
          .connect(signers[1])
          .registerVault(nonUsedVaultContract.address, 16)
      ).revertedWith("Ownable: caller is not the owner");
    });

    it("Check register operation should be reverted for vault address zero", async function () {
      const { splitterContract } = await loadFixture(deployFixture);
      await expect(
        splitterContract.registerVault(TestHelper.ZERO_ADDRESS, 16)
      ).revertedWith("Splitter: vault address should not be zero");
    });

    it("Check register operation should be reverted for non positive multiplier", async function () {
      const { splitterContract, nonUsedVaultContract } = await loadFixture(
        deployFixture
      );
      await expect(
        splitterContract.registerVault(nonUsedVaultContract.address, 0)
      ).revertedWith("Splitter: multiplier should be a positive number");
    });

    it("Check register operation should be reverted for registered vault", async function () {
      const { splitterContract, vaultContract1 } = await loadFixture(
        deployFixture
      );
      await expect(
        splitterContract.registerVault(vaultContract1.address, 1)
      ).revertedWith("Splitter: vault already registered");
    });

    it("Check register operation should be succeeded for non-register vault", async function () {
      const { splitterContract, nonUsedVaultContract, vaults } =
        await loadFixture(deployFixture);
      expect((await splitterContract.getVaults()).length).equals(vaults.length);
      const txn = await splitterContract.registerVault(
        nonUsedVaultContract.address,
        16
      );
      const { name, args } = await TestHelper.readLastEvent(txn);
      expect(name).equals("VaultAdded");
      expect(args.length).equals(2);
      expect(args[0]).equals(nonUsedVaultContract.address);
      expect(args[1]).equals(16);
      expect((await splitterContract.getVaults()).length).equals(
        vaults.length + 1
      );

      expect(
        await splitterContract.getVaultMultiplier(nonUsedVaultContract.address)
      ).equals(16);

      await expect(
        splitterContract.registerVault(nonUsedVaultContract.address, 16)
      ).revertedWith("Splitter: vault already registered");
    });
  });

  describe("Deregister vault tests", function () {
    it("Check deregister operation should be reverted for non owner user", async function () {
      const { splitterContract, vaultContract1, signers } = await loadFixture(
        deployFixture
      );
      await expect(
        splitterContract
          .connect(signers[1])
          .deregisterVault(vaultContract1.address)
      ).revertedWith("Ownable: caller is not the owner");
    });

    it("Check deregister operation should be succeeded for owner user", async function () {
      const { splitterContract, vaultContract1 } = await loadFixture(
        deployFixture
      );
      await splitterContract.deregisterVault(vaultContract1.address);
    });
  });
});
