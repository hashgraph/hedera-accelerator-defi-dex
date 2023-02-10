import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Helper } from "../utils/Helper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("Configuration contract tests", function () {
  async function deployFixture() {
    const Configuration = await ethers.getContractFactory("Configuration");
    const configurationInstance = await upgrades.deployProxy(Configuration);
    const signers = await ethers.getSigners();
    return { configurationInstance, signers };
  }

  it("Verify Configuration contract initialization", async function () {
    const { configurationInstance } = await loadFixture(deployFixture);
    const initialFees = Helper.convertToFeeObjectArray(
      await configurationInstance.getTransactionsFee()
    );

    expect(initialFees.length).to.been.equals(3);

    expect(initialFees[0].key).to.been.equals(1);
    expect(initialFees[0].value).to.been.equals(5);

    expect(initialFees[1].key).to.been.equals(2);
    expect(initialFees[1].value).to.been.equals(30);

    expect(initialFees[2].key).to.been.equals(3);
    expect(initialFees[2].value).to.been.equals(10);
  });

  it("Verify Configuration contract revert for multiple initialization", async function () {
    const { configurationInstance } = await loadFixture(deployFixture);
    await expect(configurationInstance.initialize()).to.revertedWith(
      "Initializable: contract is already initialized"
    );
  });

  it("Verify setTransactionFee should update the new data for existing key", async function () {
    const { configurationInstance } = await loadFixture(deployFixture);
    await configurationInstance.setTransactionFee(1, 10);
    const initialFees = Helper.convertToFeeObjectArray(
      await configurationInstance.getTransactionsFee()
    );

    expect(initialFees[0].key).to.been.equals(1);
    expect(initialFees[0].value).to.been.equals(10);
  });

  it("Verify setTransactionFee should increase the map size for new key", async function () {
    const { configurationInstance } = await loadFixture(deployFixture);
    const initialFees = Helper.convertToFeeObjectArray(
      await configurationInstance.getTransactionsFee()
    );
    expect(initialFees.length).to.been.equals(3);

    await configurationInstance.setTransactionFee(10, 10);

    const updatedFees = Helper.convertToFeeObjectArray(
      await configurationInstance.getTransactionsFee()
    );
    expect(updatedFees.length).to.been.equals(4);

    expect(updatedFees[3].key).to.been.equals(10);
    expect(updatedFees[3].value).to.been.equals(10);
  });

  it("Verify setTransactionFee should be reverted if caller is not owner", async function () {
    const { configurationInstance, signers } = await loadFixture(deployFixture);
    await expect(
      configurationInstance.connect(signers[1]).setTransactionFee(10, 10)
    ).to.revertedWith("Ownable: caller is not the owner");

    const oldOwner = await configurationInstance.owner();
    expect(signers[0].address).to.be.equals(oldOwner);

    await configurationInstance.transferOwnership(signers[1].address);
    const newOwner = await configurationInstance.owner();
    expect(signers[1].address).to.be.equals(newOwner);

    await configurationInstance.connect(signers[1]).renounceOwnership();
    const noOwner = await configurationInstance.owner();
    expect("0x0000000000000000000000000000000000000000").to.be.equals(noOwner);
  });
});
