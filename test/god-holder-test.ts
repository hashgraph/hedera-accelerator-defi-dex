import { expect } from "chai";
import * as fs from "fs";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";

describe("GODHolder Tests", function () {
  const zeroAddress = "0x1111111000000000000000000000000000000000";
  const precision = 100000000;
  const total = 100 * precision;

  describe("GODHolder Upgradeable", function () {
    it("Verify if the GODHolder contract is upgradeable safe ", async function () {
      const Governor = await ethers.getContractFactory("GODHolder");
      const args = [zeroAddress, zeroAddress];
      const instance = await upgrades.deployProxy(Governor, args);
      await instance.deployed();
    });
  });

  async function deployFixture() {
    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(true, zeroAddress);
    return basicDeployments(mockBaseHTS);
  }

  async function basicDeployments(mockBaseHTS: any) {
    const signers = await ethers.getSigners();
    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(
      "tokenName",
      "tokenSymbol",
      total,
      0
    );
    tokenCont.setUserBalance(signers[0].address, total);

    const GODHolder = await ethers.getContractFactory("GODHolder");
    const godHolder = await upgrades.deployProxy(GODHolder, [
      mockBaseHTS.address,
      tokenCont.address,
    ]);

    return {
      tokenCont,
      mockBaseHTS,
      signers,
      godHolder,
    };
  }

  it("Verify GODHolder initialize should be failed for initialize called after instance created", async function () {
    const { godHolder } = await loadFixture(deployFixture);
    await expect(
      godHolder.initialize(zeroAddress, zeroAddress)
    ).to.revertedWith("Initializable: contract is already initialized");
  });

  it("Verify GODHolder grabtoken pass", async function () {
    const { godHolder, signers, mockBaseHTS, tokenCont } = await loadFixture(
      deployFixture
    );
    const userTokens = await tokenCont.balanceOf(signers[0].address);
    await godHolder.grabTokensFromUser(signers[0].address);
    const contractTokens = await tokenCont.balanceOf(godHolder.address);
    const userTokens1 = await tokenCont.balanceOf(signers[0].address);
    expect(userTokens1).to.be.equal(0);
    expect(userTokens).to.be.equal(contractTokens);
  });

  it("Verify Add and remove active proposals", async function () {
    const { godHolder, signers, tokenCont } = await loadFixture(deployFixture);
    await godHolder.addProposalForVoter(signers[0].address, 1);
    await godHolder.addProposalForVoter(signers[1].address, 1);
    const activeProposals = await godHolder.getActiveProposalsForUser();
    expect(activeProposals.length).to.be.equal(1);
    const canClaimGod = await godHolder.canUserClaimGodTokens();
    expect(canClaimGod).to.be.equal(false);

    await godHolder.removeActiveProposals([signers[0].address], 1);
    const activeProposals1 = await godHolder.getActiveProposalsForUser();
    expect(activeProposals1.length).to.be.equal(0);
    const canClaimGod1 = await godHolder.canUserClaimGodTokens();
    expect(canClaimGod1).to.be.equal(true);
  });

  it("Verify GODHolder grabtoken revert", async function () {
    const { godHolder, signers, mockBaseHTS } = await loadFixture(
      deployFixture
    );
    await mockBaseHTS.setPassTransactionCount(1);
    await expect(
      godHolder.grabTokensFromUser(signers[0].address)
    ).to.revertedWith("GODHolder: token transfer failed to contract.");
  });

  it("Verify GODHolder revertTokensForVoter revert", async function () {
    const { godHolder, signers, tokenCont } = await loadFixture(deployFixture);
    await expect(godHolder.revertTokensForVoter()).to.revertedWith(
      "GODHolder: No amount for the Voter."
    );
    godHolder.grabTokensFromUser(signers[0].address);
    await tokenCont.setTransaferFailed(true);
    await expect(godHolder.revertTokensForVoter()).to.revertedWith(
      "GODHolder: token transfer failed from contract."
    );
  });
});
