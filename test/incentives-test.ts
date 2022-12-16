import { expect } from "chai";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";

describe("All Tests", function () {
  describe("Swap Upgradeable", function () {
    it("Verify if the Splitter contract is upgradeable safe ", async function () {
      const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
      const mockBaseHTS = await MockBaseHTS.deploy(true, true);

      const Vault0 = await ethers.getContractFactory("Vault");
      const vault0 = await Vault0.deploy(1000);
      const Vault1 = await ethers.getContractFactory("Vault");
      const vault1 = await Vault1.deploy(50);
      const Vault2 = await ethers.getContractFactory("Vault");
      const vault2 = await Vault2.deploy(100);

      const Splitter = await ethers.getContractFactory("Splitter");
      const splitter = await upgrades.deployProxy(Splitter, [
        mockBaseHTS.address,
        [vault0.address, vault1.address, vault2.address],
        [1, 14, 30],
      ]);
      await splitter.deployed();
    });
  });

  async function deployFixture() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(true, true);
    mockBaseHTS.setFailType(0);

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(100000000000, 100000000000);

    const Vault0 = await ethers.getContractFactory("Vault");
    const vault0 = await upgrades.deployProxy(Vault0, [100000000000]);
    const Vault1 = await ethers.getContractFactory("Vault");
    const vault1 = await await upgrades.deployProxy(Vault1, [5000000000]);
    const Vault2 = await ethers.getContractFactory("Vault");
    const vault2 = await await upgrades.deployProxy(Vault2, [10000000000]);

    const Splitter = await ethers.getContractFactory("Splitter");
    const splitter = await upgrades.deployProxy(Splitter, [
      mockBaseHTS.address,
      [vault0.address, vault1.address, vault2.address],
      [1, 14, 30],
    ]);
    return { mockBaseHTS, splitter, vault0, vault1, vault2, tokenCont };
  }
  describe("Factory Contract positive Tests", async () => {
    it("Check rewardTokenPercentage method", async function () {
      const { splitter, mockBaseHTS, vault0, vault1, vault2 } =
        await loadFixture(deployFixture);
      const value = await splitter.callStatic.rewardTokenPercentage(
        vault0.address
      );
      const expectedVal = BigNumber.from(21276595);
      expect(value).to.be.equals(expectedVal);
    });

    it.only("Check split token method", async function () {
      const { splitter, mockBaseHTS, tokenCont, vault1, vault2 } =
        await loadFixture(deployFixture);
      const value = await splitter.callStatic.splitTokensToVaults(
        tokenCont.address,
        vault1.address,
        BigNumber.from(10000000000)
      );
      const expectedVal = BigNumber.from(22);
      expect(value).to.be.equals(expectedVal);
    });

    it.only("Check split token value for a vault", async function () {
      const { splitter, mockBaseHTS, tokenCont, vault0, vault1, vault2 } =
        await loadFixture(deployFixture);
      const value = await splitter.callStatic._amountToTransfer(
        vault0.address,
        BigNumber.from(10000000000)
      );
      const expectedVal = BigNumber.from(2127659500);
      expect(value).to.be.equals(expectedVal);
    });
  });
});
