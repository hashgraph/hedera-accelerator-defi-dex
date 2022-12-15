import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { ERC20Mock } from "../typechain";

describe("Vault Tests", function () {
  const tokenAAddress = "0x0000000000000000000000000000000000020002";
  const precision = 100000000;
  const total = 100 * precision;

  async function deployFixture() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(true, false);
    mockBaseHTS.setFailType(0);

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(total, 0);

    const signers = await ethers.getSigners();

    // await tokenCont.setUserBalance(signers[0].address);

    const VaultContract = await ethers.getContractFactory("Vault");
    const vaultContract = await VaultContract.deploy();

    return { mockBaseHTS, vaultContract, tokenCont };
  }

  it("Check initialize method", async function () {
    const { mockBaseHTS, vaultContract } = await loadFixture(deployFixture);
    await vaultContract.initialize(tokenAAddress, 1, mockBaseHTS.address);
  });
});
