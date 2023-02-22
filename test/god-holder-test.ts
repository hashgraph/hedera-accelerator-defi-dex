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

  describe("GODTokenHolderFactory Upgradeable", function () {
    it("Verify if the GODTokenFactory contract is upgradeable safe ", async function () {
      const Governor = await ethers.getContractFactory("GODTokenHolderFactory");
      const instance = await upgrades.deployProxy(Governor);
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

    const GODTokenHolderFactory = await ethers.getContractFactory(
      "GODTokenHolderFactory"
    );
    const godTokenHolderFactory = await upgrades.deployProxy(
      GODTokenHolderFactory
    );

    return {
      tokenCont,
      mockBaseHTS,
      signers,
      godHolder,
      godTokenHolderFactory,
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

  it("Given a GODHolder when factory is asked to create holder then address should be populated", async () => {
    const { godHolder, godTokenHolderFactory, tokenCont } = await loadFixture(
      deployFixture
    );
    await godTokenHolderFactory.createGODHolder(godHolder.address);
    const holder = await godTokenHolderFactory.getGODTokenHolder(
      tokenCont.address
    );
    expect(holder).to.be.equal(godHolder.address);
  });

  it("Given a GODHolder exist in factory when factory is asked to create another one with different token then address should be populated", async () => {
    const { godHolder, godTokenHolderFactory, tokenCont, mockBaseHTS } =
      await loadFixture(deployFixture);

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const newToken = await TokenCont.deploy(
      "tokenName1",
      "tokenSymbol1",
      total,
      0
    );

    const GODHolder = await ethers.getContractFactory("GODHolder");
    const newGodHolder = await upgrades.deployProxy(GODHolder, [
      mockBaseHTS.address,
      newToken.address,
    ]);

    await godTokenHolderFactory.createGODHolder(godHolder.address);
    await godTokenHolderFactory.createGODHolder(newGodHolder.address);

    const holder = await godTokenHolderFactory.getGODTokenHolder(
      tokenCont.address
    );
    const newHolder = await godTokenHolderFactory.getGODTokenHolder(
      newToken.address
    );

    expect(holder).to.be.equal(godHolder.address);
    expect(newHolder).to.be.equal(newGodHolder.address);
  });

  it("Given a GODHolder exist in factory when factory is asked to create another one with same token then it should fail", async () => {
    const {
      godHolder,
      godTokenHolderFactory,
      tokenCont: sameToken,
      mockBaseHTS,
    } = await loadFixture(deployFixture);

    await godTokenHolderFactory.createGODHolder(godHolder.address);
    const holder = await godTokenHolderFactory.getGODTokenHolder(
      sameToken.address
    );
    expect(holder).to.be.equal(godHolder.address);

    const GODHolder = await ethers.getContractFactory("GODHolder");
    const newGodHolder = await upgrades.deployProxy(GODHolder, [
      mockBaseHTS.address,
      sameToken.address,
    ]);

    await expect(godTokenHolderFactory.createGODHolder(newGodHolder.address))
      .to.be.revertedWithCustomError(
        godTokenHolderFactory,
        "GODHolderAlreadyExist"
      )
      .withArgs(
        sameToken.address,
        godHolder.address,
        "GODHolder already exist for this token."
      );
  });
});
