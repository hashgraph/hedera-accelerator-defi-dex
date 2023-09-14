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

    expect(initialFees.length).to.be.equals(3);

    expect(initialFees[0].key).to.be.equals(1);
    expect(initialFees[0].value).to.be.equals(5);

    expect(initialFees[1].key).to.be.equals(2);
    expect(initialFees[1].value).to.be.equals(30);

    expect(initialFees[2].key).to.be.equals(3);
    expect(initialFees[2].value).to.be.equals(10);
  });

  it("Verify Configuration contract revert for multiple initialization", async function () {
    const { configurationInstance } = await loadFixture(deployFixture);
    await expect(configurationInstance.initialize()).to.revertedWith(
      "Initializable: contract is already initialized"
    );
  });

  it("Verify setTransactionFee should update the new data for existing key", async function () {
    const { configurationInstance } = await loadFixture(deployFixture);
    const initialFees = Helper.convertToFeeObjectArray(
      await configurationInstance.getTransactionsFee()
    );
    expect(initialFees[0].key).to.be.equals(1);
    expect(initialFees[0].value).to.be.equals(5);

    await configurationInstance.setTransactionFee(1, 10);

    const updatedFees = Helper.convertToFeeObjectArray(
      await configurationInstance.getTransactionsFee()
    );
    expect(updatedFees[0].key).to.be.equals(1);
    expect(updatedFees[0].value).to.be.equals(10);
  });

  it("Verify setTransactionFee should increase the map size for new key", async function () {
    const { configurationInstance } = await loadFixture(deployFixture);
    const initialFees = Helper.convertToFeeObjectArray(
      await configurationInstance.getTransactionsFee()
    );
    expect(initialFees.length).to.be.equals(3);

    await configurationInstance.setTransactionFee(10, 10);

    const updatedFees = Helper.convertToFeeObjectArray(
      await configurationInstance.getTransactionsFee()
    );
    expect(updatedFees.length).to.be.equals(4);

    expect(updatedFees[3].key).to.be.equals(10);
    expect(updatedFees[3].value).to.be.equals(10);
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

  it("Verify user can get habrxAddress", async () => {
    const { configurationInstance } = await loadFixture(deployFixture);
    const hbarxAdd = await configurationInstance.getHbarxAddress();
    expect(hbarxAdd).not.equals("0x0");
  });

  it("Verify user can set habrxAddress after initialization", async () => {
    const { configurationInstance, signers } = await loadFixture(deployFixture);
    const anyAddress = signers[1].address;
    await configurationInstance.setHbarxAddress(anyAddress);
  });

  it("When non-owner try to set hbarAddress then transaction should be reverted.", async () => {
    const { configurationInstance, signers } = await loadFixture(deployFixture);
    const nonOwner = signers[1];
    const anyAddress = signers[2].address;
    const oldOwner = await configurationInstance.owner();
    expect(signers[0].address).to.be.equals(oldOwner);
    await expect(
      configurationInstance.connect(nonOwner).setHbarxAddress(anyAddress)
    ).to.revertedWith("Ownable: caller is not the owner");
  });
});
