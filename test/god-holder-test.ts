import { expect } from "chai";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";

describe("GODHolder Tests", function () {
  const zeroAddress = "0x1111111000000000000000000000000000000000";
  let admin;
  const precision = 100000000;
  const total = 100 * precision;

  describe("GODHolder Upgradeable", function () {
    it("Verify if the GODHolder contract is upgradeable safe ", async function () {
      const Governor = await ethers.getContractFactory("GODHolder");
      const args = [zeroAddress, zeroAddress];
      const instance = await upgrades.deployProxy(Governor, args, {
        unsafeAllow: ["delegatecall"],
      });
      await instance.deployed();
    });
  });

  describe("GODTokenHolderFactory Upgradeable", function () {
    it("Verify if the GODTokenFactory contract is upgradeable safe ", async function () {
      const Governor = await ethers.getContractFactory("GODTokenHolderFactory");
      const args = [zeroAddress, zeroAddress, zeroAddress];
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
    admin = signers[1].address;
    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(
      "tokenName",
      "tokenSymbol",
      total,
      0
    );
    tokenCont.setUserBalance(signers[0].address, total);

    const GODHolder = await ethers.getContractFactory("GODHolder");
    const godHolder = await upgrades.deployProxy(
      GODHolder,
      [mockBaseHTS.address, tokenCont.address],
      { unsafeAllow: ["delegatecall"] }
    );

    const GODTokenHolderFactory = await ethers.getContractFactory(
      "GODTokenHolderFactory"
    );
    const godTokenHolderFactory = await GODTokenHolderFactory.deploy();

    const MockGODHolder = await ethers.getContractFactory("GODHolderMock");
    const mockGODHolder = await MockGODHolder.deploy();

    await godTokenHolderFactory.initialize(
      mockBaseHTS.address,
      mockGODHolder.address,
      admin
    );

    return {
      tokenCont,
      mockBaseHTS,
      signers,
      godHolder,
      godTokenHolderFactory,
      admin,
      mockGODHolder,
    };
  }

  it("Verify GODHolder initialize should be failed for initialize called after instance created", async function () {
    const { godHolder } = await loadFixture(deployFixture);
    await expect(
      godHolder.initialize(zeroAddress, zeroAddress)
    ).to.revertedWith("Initializable: contract is already initialized");
  });

  it("Verify GODHolder grabtoken pass", async function () {
    const { godHolder, signers, tokenCont } = await loadFixture(deployFixture);
    const userTokens = await tokenCont.balanceOf(signers[0].address);
    await godHolder.grabTokensFromUser(signers[0].address, 0);
    const contractTokens = await tokenCont.balanceOf(godHolder.address);
    const userTokens1 = await tokenCont.balanceOf(signers[0].address);
    expect(userTokens1).to.be.equal(0);
    expect(userTokens).to.be.equal(contractTokens);
  });

  it("Verify Add and remove active proposals", async function () {
    const { godHolder, signers } = await loadFixture(deployFixture);
    await godHolder.addProposalForVoter(signers[0].address, 1);
    await godHolder.addProposalForVoter(signers[1].address, 1);
    const activeProposals = await godHolder.getActiveProposalsForUser();
    expect(activeProposals.length).to.be.equal(1);
    const canClaimGod = await godHolder.canUserClaimTokens();
    expect(canClaimGod).to.be.equal(false);

    await godHolder.removeActiveProposals([signers[0].address], 1);
    const activeProposals1 = await godHolder.getActiveProposalsForUser();
    expect(activeProposals1.length).to.be.equal(0);
    const canClaimGod1 = await godHolder.canUserClaimTokens();
    expect(canClaimGod1).to.be.equal(true);
  });

  it("Verify GODHolder grabtoken revert", async function () {
    const { godHolder, signers, mockBaseHTS } = await loadFixture(
      deployFixture
    );
    await mockBaseHTS.setPassTransactionCount(1);
    await expect(
      godHolder.grabTokensFromUser(signers[0].address, 0)
    ).to.revertedWith("GODHolder: token transfer failed to contract.");
  });

  it("Verify GODHolder revertTokensForVoter revert", async function () {
    const { godHolder, signers, tokenCont } = await loadFixture(deployFixture);
    await expect(godHolder.revertTokensForVoter()).to.revertedWith(
      "GODHolder: No amount for the Voter."
    );
    godHolder.grabTokensFromUser(signers[0].address, 0);
    await tokenCont.setTransaferFailed(true);
    await expect(godHolder.revertTokensForVoter()).to.revertedWith(
      "GODHolder: token transfer failed from contract."
    );
  });

  it("Given a GODHolder when factory is asked to create holder then address should be populated", async () => {
    const { godTokenHolderFactory, tokenCont } = await loadFixture(
      deployFixture
    );

    const holder = await godTokenHolderFactory.callStatic.getTokenHolder(
      tokenCont.address
    );

    expect(holder).not.to.be.equal("0x0");
  });

  it("Given a GODHolder exist in factory when factory is asked to create another one with different token then address should be populated", async () => {
    const { godTokenHolderFactory, tokenCont } = await loadFixture(
      deployFixture
    );

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const newToken = await TokenCont.deploy(
      "tokenName1",
      "tokenSymbol1",
      total,
      0
    );

    const tx1 = await godTokenHolderFactory.getTokenHolder(tokenCont.address);

    const tx2 = await godTokenHolderFactory.getTokenHolder(newToken.address);

    const holder1Record = await tx1.wait();
    const holder2Record = await tx2.wait();

    const tokenGodHolder = holder1Record.events[2].args.tokenHolder;
    const newTokenGodHolder = holder2Record.events[2].args.tokenHolder;

    expect(holder1Record.events[2].args.token).to.be.equal(tokenCont.address);
    expect(holder2Record.events[2].args.token).to.be.equal(newToken.address);
    expect(tokenGodHolder).not.to.be.equal(newTokenGodHolder);
    expect(tokenGodHolder).not.to.be.equal("0x0");
    expect(newTokenGodHolder).not.to.be.equal("0x0");
  });

  it("Given a GODHolder exist in factory when factory is asked to create another one with same token then existing address should return", async () => {
    const { godTokenHolderFactory, tokenCont } = await loadFixture(
      deployFixture
    );

    const tx1 = await godTokenHolderFactory.getTokenHolder(tokenCont.address);

    //Use callStatic as we are reading the existing state not modifying it.
    const newTokenGodHolder =
      await godTokenHolderFactory.callStatic.getTokenHolder(tokenCont.address);

    const holder1Record = await tx1.wait();
    //Below emits event as it add new GOD Holder
    const tokenGodHolder = holder1Record.events[2].args.tokenHolder;

    expect(tokenGodHolder).to.be.equal(newTokenGodHolder);
    expect(tokenGodHolder).not.to.be.equal("0x0");
    expect(newTokenGodHolder).not.to.be.equal("0x0");
  });
});
