import { expect } from "chai";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";
import { TestHelper } from "./TestHelper";

describe("All Tests", function () {
  const newZeroAddress = "0x0000000000000000000000000000000000000000";

  describe("Splitter Upgradeable", function () {
    it("Verify if the Splitter contract is upgradeable safe ", async function () {
      const mockBaseHTS = await TestHelper.deployMockBaseHTS();
      const TokenCont = await ethers.getContractFactory("ERC20Mock");
      const tokenCont = await TokenCont.deploy(
        "tokenName",
        "tokenSymbol",
        10000000000,
        0
      );

      const Vault0 = await ethers.getContractFactory("Vault");
      const vault0 = await upgrades.deployProxy(Vault0, [
        tokenCont.address,
        100,
        mockBaseHTS.address,
      ]);
      const Vault1 = await ethers.getContractFactory("Vault");
      const vault1 = await upgrades.deployProxy(Vault1, [
        tokenCont.address,
        100,
        mockBaseHTS.address,
      ]);
      const Vault2 = await ethers.getContractFactory("Vault");
      const vault2 = await upgrades.deployProxy(Vault2, [
        tokenCont.address,
        100,
        mockBaseHTS.address,
      ]);

      const Splitter = await ethers.getContractFactory("Splitter");
      const splitter = await upgrades.deployProxy(Splitter, [
        mockBaseHTS.address,
        [vault0.address, vault1.address, vault2.address],
        [1, 14, 30],
      ]);
      await splitter.deployed();
    });

    it("Verify if the Splitter Initialisation works", async function () {
      const mockBaseHTS = await TestHelper.deployMockBaseHTS();
      const TokenCont = await ethers.getContractFactory("ERC20Mock");
      const tokenCont = await TokenCont.deploy(
        "tokenName",
        "tokenSymbol",
        100000000000,
        100000000000
      );

      const Vault0 = await ethers.getContractFactory("Vault");
      const vault0 = await upgrades.deployProxy(Vault0, [
        tokenCont.address,
        100,
        mockBaseHTS.address,
      ]);
      const Vault1 = await ethers.getContractFactory("Vault");
      const vault1 = await upgrades.deployProxy(Vault1, [
        tokenCont.address,
        100,
        mockBaseHTS.address,
      ]);
      const Vault2 = await ethers.getContractFactory("Vault");
      const vault2 = await upgrades.deployProxy(Vault2, [
        tokenCont.address,
        100,
        mockBaseHTS.address,
      ]);

      const Splitter = await ethers.getContractFactory("Splitter");
      await expect(
        upgrades.deployProxy(Splitter, [
          mockBaseHTS.address,
          [vault0.address, vault1.address, vault2.address],
          [1, 14],
        ])
      ).to.revertedWith("Splitter: vault and multipliers length mismatch");
      await expect(
        upgrades.deployProxy(Splitter, [mockBaseHTS.address, [], []])
      ).to.revertedWith("Splitter: no vault");

      await expect(
        upgrades.deployProxy(Splitter, [
          mockBaseHTS.address,
          [newZeroAddress],
          [1],
        ])
      ).to.revertedWith("Splitter: account is the zero address");

      await expect(
        upgrades.deployProxy(Splitter, [
          mockBaseHTS.address,
          [vault0.address],
          [0],
        ])
      ).to.revertedWith("Splitter: multiplier are 0");

      await expect(
        upgrades.deployProxy(Splitter, [
          mockBaseHTS.address,
          [vault0.address, vault0.address],
          [1, 2],
        ])
      ).to.revertedWith("Splitter: account already has shares");

      const splitter = await upgrades.deployProxy(Splitter, [
        mockBaseHTS.address,
        [vault0.address, vault1.address],
        [1, 2],
      ]);
      await expect(
        splitter.initialize(
          mockBaseHTS.address,
          [vault0.address, vault0.address],
          [1, 2]
        )
      ).to.revertedWith("Initializable: contract is already initialized");
    });
  });

  async function deployFixture() {
    const mockBaseHTS = await TestHelper.deployMockBaseHTS();

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(
      "tokenName",
      "tokenSymbol",
      100000000000,
      100000000000
    );

    const signers = await ethers.getSigners();
    const signer1 = signers[1];
    const Vault0 = await ethers.getContractFactory("Vault");
    const vault0 = await upgrades.deployProxy(Vault0, [
      tokenCont.address,
      100,
      mockBaseHTS.address,
    ]);
    await vault0.connect(signers[1]).addStake(100000000000);
    const Vault1 = await ethers.getContractFactory("Vault");
    const vault1 = await upgrades.deployProxy(Vault1, [
      tokenCont.address,
      100,
      mockBaseHTS.address,
    ]);
    await vault1.connect(signers[1]).addStake(5000000000);
    const Vault2 = await ethers.getContractFactory("Vault");
    const vault2 = await upgrades.deployProxy(Vault2, [
      tokenCont.address,
      100,
      mockBaseHTS.address,
    ]);
    await vault2.connect(signers[1]).addStake(10000000000);
    const Vault3 = await ethers.getContractFactory("Vault");
    const vault3 = await upgrades.deployProxy(Vault3, [
      tokenCont.address,
      100,
      mockBaseHTS.address,
    ]);
    await vault3.connect(signers[1]).addStake(10000000000);

    const Splitter = await ethers.getContractFactory("Splitter");
    const splitter = await upgrades.deployProxy(Splitter, [
      mockBaseHTS.address,
      [vault0.address, vault1.address, vault2.address],
      [1, 14, 30],
    ]);
    return {
      mockBaseHTS,
      splitter,
      vault0,
      vault1,
      vault2,
      tokenCont,
      vault3,
      signer1,
    };
  }

  describe("Splitter Contract positive Tests", async () => {
    it("Check split token method success", async function () {
      const { splitter, tokenCont } = await loadFixture(deployFixture);
      const value = await splitter.callStatic.splitTokensToVaults(
        tokenCont.address,
        newZeroAddress,
        BigNumber.from(10000000000)
      );
      const expectedVal = BigNumber.from(22);
      expect(value).to.be.equals(expectedVal);
    });
    it("Check split token method transfer amount", async function () {
      const { splitter, tokenCont } = await loadFixture(deployFixture);
      const value = await splitter.splitTokensToVaults(
        tokenCont.address,
        newZeroAddress,
        BigNumber.from(10000000000)
      );
      const record = await value.wait();
      const vault0Amount = record.events[0].args.amount;
      const vault1Amount = record.events[1].args.amount;
      const vault2Amount = record.events[2].args.amount;
      expect(vault0Amount).to.be.equals(2127659500);
      expect(vault1Amount).to.be.equals(1489361700);
      expect(vault2Amount).to.be.equals(6382978700);
    });
    it("Check registerVault", async function () {
      const { splitter, signer1, vault3 } = await loadFixture(deployFixture);
      const value = await splitter.callStatic.registerVault(vault3.address, 16);
      expect(value).to.be.equals(22);

      await expect(
        splitter.connect(signer1).registerVault(vault3.address, 16)
      ).to.revertedWith("Only Owner can call this function");
    });
  });
});
