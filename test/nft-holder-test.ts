import { expect } from "chai";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";

describe("NFTHolder Tests", function () {
  const zeroAddress = "0x1111111000000000000000000000000000000000";
  let admin;
  const precision = 100000000;
  const total = 100 * precision;

  describe("NFTHolder Upgradeable", function () {
    it("Verify if the NFTHolder contract is upgradeable safe ", async function () {
      const Governor = await ethers.getContractFactory("NFTHolder");
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
    admin = signers[1].address;
    const TokenCont = await ethers.getContractFactory("ERC721Mock");
    const tokenCont = await TokenCont.deploy();

    const NFTHolder = await ethers.getContractFactory("NFTHolder");
    const nftHolder = await upgrades.deployProxy(NFTHolder, [
      mockBaseHTS.address,
      tokenCont.address,
    ]);

    const MockNFTHolder = await ethers.getContractFactory("NFTHolderMock");
    const mockNFTHolder = await MockNFTHolder.deploy();

    return {
      tokenCont,
      mockBaseHTS,
      signers,
      nftHolder,
      admin,
      mockNFTHolder,
    };
  }

  it("Verify NFTHolder initialize should be failed for initialize called after instance created", async function () {
    const { nftHolder } = await loadFixture(deployFixture);
    await expect(
      nftHolder.initialize(zeroAddress, zeroAddress)
    ).to.revertedWith("Initializable: contract is already initialized");
  });

  it("Verify NFTHolder balanceOfVoter", async function () {
    const { nftHolder, signers, tokenCont } = await loadFixture(deployFixture);
    const tokenId = await nftHolder.balanceOfVoter(signers[0].address);
    expect(tokenId).to.be.equal(0);
    await nftHolder.grabTokensFromUser(signers[0].address, 1);
    const tokenIdAfterGrab = await nftHolder.balanceOfVoter(signers[0].address);
    expect(tokenIdAfterGrab).to.be.equal(1);
  });

  it("Verify NFTHolder grabtoken pass", async function () {
    const { nftHolder, signers, tokenCont } = await loadFixture(deployFixture);
    const userTokens = await tokenCont.balanceOf(signers[0].address);
    await nftHolder.grabTokensFromUser(signers[0].address, 1);
    const contractTokens = await tokenCont.balanceOf(nftHolder.address);
    const userTokens1 = await tokenCont.balanceOf(signers[0].address);
    expect(userTokens1).to.be.equal(0);
    expect(userTokens).to.be.equal(contractTokens);
  });

  it("Verify Add and remove active proposals", async function () {
    const { nftHolder, signers } = await loadFixture(deployFixture);
    await nftHolder.addProposalForVoter(signers[0].address, 1);
    await nftHolder.addProposalForVoter(signers[1].address, 1);
    const activeProposals = await nftHolder.getActiveProposalsForUser();
    expect(activeProposals.length).to.be.equal(1);
    const canClaimGod = await nftHolder.canUserClaimTokens();
    expect(canClaimGod).to.be.equal(false);

    await nftHolder.removeActiveProposals([signers[0].address], 1);
    const activeProposals1 = await nftHolder.getActiveProposalsForUser();
    expect(activeProposals1.length).to.be.equal(0);
    const canClaimGod1 = await nftHolder.canUserClaimTokens();
    expect(canClaimGod1).to.be.equal(true);
  });

  it("Verify NFTHolder grabtoken revert", async function () {
    const { nftHolder, signers, mockBaseHTS } = await loadFixture(
      deployFixture
    );
    await mockBaseHTS.setPassTransactionCount(1);
    await expect(
      nftHolder.grabTokensFromUser(signers[0].address, 0)
    ).to.revertedWith("NFTHolder: token transfer failed to contract.");
  });

  it("Verify NFTHolder revertTokensForVoter revert", async function () {
    const { nftHolder, signers, tokenCont } = await loadFixture(deployFixture);
    await expect(nftHolder.revertTokensForVoter()).to.revertedWith(
      "NFTHolder: No amount for the Voter."
    );
    await nftHolder.addProposalForVoter(signers[0].address, 1);
    await expect(nftHolder.revertTokensForVoter()).to.revertedWith(
      "User's Proposals are active"
    );
  });

  it("Verify NFTHolder revertTokensForVoter pass", async function () {
    const { nftHolder, signers, tokenCont } = await loadFixture(deployFixture);
    nftHolder.grabTokensFromUser(signers[0].address, 2);
    const response = await nftHolder.callStatic.revertTokensForVoter();
    expect(response).to.be.equal(22);
  });
});
