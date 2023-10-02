import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { TestHelper } from "./TestHelper";

describe("AssetsHolder contract tests", function () {
  async function deployFixture() {
    const signers = await TestHelper.getSigners();
    const ftToken = await TestHelper.deployERC20Mock();
    const hederaService = await TestHelper.deployMockHederaService();

    const INIT_ARGS = {
      _governanceToken: ftToken.address,
      _iHederaService: hederaService.address,
    };

    const assetsHolder = await TestHelper.deployAssetsHolder();
    await expect(assetsHolder.initialize(...Object.values(INIT_ARGS)))
      .emit(assetsHolder, "LogicUpdated")
      .emit(assetsHolder, "OwnershipTransferred");
    return {
      signers,
      ftToken,
      nonOwner: signers[1],
      assetsHolder,
      hederaService,
      INIT_ARGS,
    };
  }

  it("Verify contract should be reverted for multiple initialization", async function () {
    const { assetsHolder, INIT_ARGS } = await loadFixture(deployFixture);
    await expect(
      assetsHolder.initialize(...Object.values(INIT_ARGS)),
    ).revertedWith("Initializable: contract is already initialized");
  });

  it("Verify init params set properly", async function () {
    const { assetsHolder, signers, INIT_ARGS } =
      await loadFixture(deployFixture);

    const tokenAddress = await assetsHolder.governanceToken();
    expect(tokenAddress).equals(INIT_ARGS._governanceToken);

    const htsAddress = await assetsHolder.getHederaServiceVersion();
    expect(htsAddress).equals(INIT_ARGS._iHederaService);

    const ownerAddress = await assetsHolder.owner();
    expect(ownerAddress).equals(signers[0].address);
  });

  it("Verify calling associate should be reverted for non-owner user", async function () {
    const { assetsHolder, nonOwner } = await loadFixture(deployFixture);
    await expect(
      assetsHolder.connect(nonOwner).associate(TestHelper.ONE_ADDRESS),
    ).revertedWith("Ownable: caller is not the owner");
  });

  it("Verify calling createToken should be reverted for non-owner user", async function () {
    const { assetsHolder, nonOwner } = await loadFixture(deployFixture);
    await expect(
      assetsHolder.connect(nonOwner).createToken("TT", "TT", 1e8),
    ).revertedWith("Ownable: caller is not the owner");
  });

  it("Verify calling mintToken should be reverted for non-owner user", async function () {
    const { assetsHolder, nonOwner } = await loadFixture(deployFixture);
    await expect(
      assetsHolder.connect(nonOwner).mintToken(TestHelper.ZERO_ADDRESS, 1e8),
    ).revertedWith("Ownable: caller is not the owner");
  });

  it("Verify calling burnToken should be reverted for non-owner user", async function () {
    const { assetsHolder, nonOwner } = await loadFixture(deployFixture);
    await expect(
      assetsHolder.connect(nonOwner).burnToken(TestHelper.ZERO_ADDRESS, 1e8),
    ).revertedWith("Ownable: caller is not the owner");
  });

  it("Verify calling setText should be reverted for non-owner user", async function () {
    const { assetsHolder, nonOwner } = await loadFixture(deployFixture);
    await expect(assetsHolder.connect(nonOwner).setText()).revertedWith(
      "Ownable: caller is not the owner",
    );
  });

  it("Verify calling transfer should be reverted for non-owner user", async function () {
    const { assetsHolder, nonOwner } = await loadFixture(deployFixture);
    await expect(
      assetsHolder
        .connect(nonOwner)
        .transfer(TestHelper.ZERO_ADDRESS, TestHelper.ZERO_ADDRESS, 1e8),
    ).revertedWith("Ownable: caller is not the owner");
  });

  it("Verify calling upgradeProxy should be reverted for non-owner user", async function () {
    const { assetsHolder, nonOwner } = await loadFixture(deployFixture);
    await expect(
      assetsHolder
        .connect(nonOwner)
        .upgradeProxy(
          TestHelper.ZERO_ADDRESS,
          TestHelper.ZERO_ADDRESS,
          TestHelper.ZERO_ADDRESS,
        ),
    ).revertedWith("Ownable: caller is not the owner");
  });

  it("Verify calling upgradeHederaService should be reverted for non-owner user", async function () {
    const { assetsHolder, nonOwner } = await loadFixture(deployFixture);
    await expect(
      assetsHolder
        .connect(nonOwner)
        .upgradeHederaService(TestHelper.ZERO_ADDRESS),
    ).revertedWith("Ownable: caller is not the owner");
  });
});
