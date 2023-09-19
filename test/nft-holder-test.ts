import { expect } from "chai";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { TestHelper } from "./TestHelper";

describe("NFTHolder Tests", function () {
  const zeroAddress = "0x1111111000000000000000000000000000000000";
  let admin;
  const precision = 100000000;
  const total = 100 * precision;
  const userTotalToken = 10;
  const tokenSerial = 1;
  const tokenCount = 1;

  async function deployFixture() {
    const MockHederaService =
      await ethers.getContractFactory("MockHederaService");
    const mockHederaService = await TestHelper.deployMockHederaService();
    return basicDeployments(mockHederaService);
  }

  async function verifyTokenHolderCreatedEvent(txn: any, tokenAddress: string) {
    const { name, args } = await TestHelper.readLastEvent(txn);
    expect(name).equals("TokenHolderCreated");
    expect(args.length).equals(2);
    expect(args.token).equals(tokenAddress);
    expect(ethers.utils.isAddress(args.tokenHolder)).equals(true);
    return { token: args.token, tokenHolder: args.tokenHolder };
  }

  async function basicDeployments(mockHederaService: any) {
    const signers = await ethers.getSigners();
    const voterAccount = signers[0];
    admin = signers[1].address;
    const nftToken = await TestHelper.deployERC721Mock(voterAccount);

    const NFTHolder = await ethers.getContractFactory("NFTHolder");
    const nftHolder = await upgrades.deployProxy(
      NFTHolder,
      [mockHederaService.address, nftToken.address],
      { unsafeAllow: ["delegatecall"] },
    );

    const MockNFTHolder = await ethers.getContractFactory("NFTHolder");
    const mockNFTHolder = await MockNFTHolder.deploy();

    const NFTTokenHolderFactory = await ethers.getContractFactory(
      "NFTTokenHolderFactory",
    );
    const nftTokenHolderFactory = await NFTTokenHolderFactory.deploy();

    await nftTokenHolderFactory.initialize(
      mockHederaService.address,
      mockNFTHolder.address,
      admin,
    );

    const tokenHolderCallerMock = await TestHelper.deployLogic(
      "TokenHolderCallerMock",
      nftHolder.address,
    );
    await nftToken.setUserBalance(tokenHolderCallerMock.address, 40);

    return {
      nftToken,
      mockHederaService,
      signers,
      nftHolder,
      admin,
      mockNFTHolder,
      nftTokenHolderFactory,
      voterAccount,
      tokenHolderCallerMock,
    };
  }

  it("Verify NFTHolder initialize should be failed for initialize called after instance created", async function () {
    const { nftHolder } = await loadFixture(deployFixture);
    await expect(
      nftHolder.initialize(zeroAddress, zeroAddress),
    ).to.revertedWith("Initializable: contract is already initialized");
  });

  it("Verify NFTHolder balanceOfVoter", async function () {
    const { nftHolder, voterAccount } = await loadFixture(deployFixture);
    expect(await nftHolder.balanceOfVoter(voterAccount.address)).equals(0);
    await nftHolder.grabTokensFromUser(TestHelper.NFT_FOR_VOTING);
    expect(await nftHolder.balanceOfVoter(voterAccount.address)).equals(1);
  });

  it("Verify NFTHolder grabTokens pass", async function () {
    const { nftHolder, nftToken, voterAccount } =
      await loadFixture(deployFixture);

    expect(await nftToken.balanceOf(voterAccount.address)).equal(
      TestHelper.NFT_IDS.length,
    );

    await nftHolder
      .connect(voterAccount)
      .grabTokensFromUser(TestHelper.NFT_FOR_VOTING);

    const nftHolderBalance = await nftToken.balanceOf(nftHolder.address);
    expect(nftHolderBalance).equal(1);

    expect(await nftToken.balanceOf(voterAccount.address)).equal(
      TestHelper.NFT_IDS.length - 1,
    );

    const votingTokenOwner = await nftToken.ownerOf(TestHelper.NFT_FOR_VOTING);
    expect(votingTokenOwner).equal(nftHolder.address);
  });

  it("Verify add and remove active proposals", async function () {
    const { nftToken, nftHolder, voterAccount, tokenHolderCallerMock } =
      await loadFixture(deployFixture);

    expect(await nftToken.balanceOf(tokenHolderCallerMock.address)).equals(1);

    await tokenHolderCallerMock.connect(voterAccount).addProposal(1);
    expect(
      (await nftHolder.connect(voterAccount).getActiveProposalsForUser())
        .length,
    ).equal(1);

    await tokenHolderCallerMock.connect(voterAccount).addProposal(2);
    expect(
      (await nftHolder.connect(voterAccount).getActiveProposalsForUser())
        .length,
    ).equal(2);

    await tokenHolderCallerMock.connect(voterAccount).removeProposals(1);
    expect(
      (await nftHolder.connect(voterAccount).getActiveProposalsForUser())
        .length,
    ).equal(1);

    await tokenHolderCallerMock.connect(voterAccount).removeProposals(2);

    expect(
      (await nftHolder.connect(voterAccount).getActiveProposalsForUser())
        .length,
    ).equal(0);
  });

  it("Verify NFTHolder revertTokensForVoter revert", async function () {
    const { nftHolder, tokenHolderCallerMock, voterAccount } =
      await loadFixture(deployFixture);
    await expect(nftHolder.revertTokensForVoter(0)).to.revertedWith(
      "NFTHolder: No amount for the Voter.",
    );
    await tokenHolderCallerMock.connect(voterAccount).addProposal(1);
    await expect(nftHolder.revertTokensForVoter(0)).to.revertedWith(
      "User's Proposals are active",
    );
  });

  it("Verify NFTHolder revertTokensForVoter pass", async function () {
    const { nftHolder, nftToken, voterAccount } =
      await loadFixture(deployFixture);

    await nftHolder
      .connect(voterAccount)
      .grabTokensFromUser(TestHelper.NFT_FOR_VOTING);

    expect(await nftToken.balanceOf(nftHolder.address)).equal(1);
    expect(await nftToken.balanceOf(voterAccount.address)).equal(
      TestHelper.NFT_IDS.length - 1,
    );

    await nftHolder.connect(voterAccount).revertTokensForVoter(0);

    expect(await nftToken.balanceOf(nftHolder.address)).equal(0);
    expect(await nftToken.balanceOf(voterAccount.address)).equal(
      TestHelper.NFT_IDS.length,
    );
  });

  it("Given a NFTHolder when factory is asked to create holder then address should be populated", async () => {
    const { nftTokenHolderFactory, nftToken } =
      await loadFixture(deployFixture);

    const holder = await nftTokenHolderFactory.callStatic.getTokenHolder(
      nftToken.address,
    );

    expect(holder).not.to.be.equal("0x0");
  });

  it("Given a NFTHolder exist in factory when factory is asked to create another one with different token then address should be populated", async () => {
    const { nftTokenHolderFactory, nftToken: token } =
      await loadFixture(deployFixture);

    const tx = await nftTokenHolderFactory.getTokenHolder(token.address);
    const info = await verifyTokenHolderCreatedEvent(tx, token.address);

    const token1 = await TestHelper.deployERC20Mock();
    const tx1 = await nftTokenHolderFactory.getTokenHolder(token1.address);
    const info1 = await verifyTokenHolderCreatedEvent(tx1, token1.address);

    expect(info.token).not.equals(info1.token);
    expect(info.tokenHolder).not.equals(info1.tokenHolder);
  });

  it("Given a NFTHolder exist in factory when factory is asked to create another one with same token then existing address should return", async () => {
    const { nftTokenHolderFactory, nftToken: token } =
      await loadFixture(deployFixture);

    const tx = await nftTokenHolderFactory.getTokenHolder(token.address);
    const info = await verifyTokenHolderCreatedEvent(tx, token.address);

    // Use callStatic as we are reading the existing state not modifying it.
    const existingHolderAddress =
      await nftTokenHolderFactory.callStatic.getTokenHolder(token.address);

    expect(info.tokenHolder).equal(existingHolderAddress);
  });

  it("Verify upgrade Hedera service should pass when owner try to upgrade it ", async () => {
    const { nftTokenHolderFactory, nftToken, signers, mockHederaService } =
      await loadFixture(deployFixture);

    const tx = await nftTokenHolderFactory.getTokenHolder(nftToken.address);
    const { name, args } = await TestHelper.readLastEvent(tx);
    const tokenAddress = args[0];
    const nftHolderAddress = args[1];

    expect(name).equals("TokenHolderCreated");
    expect(tokenAddress).equals(nftToken.address);
    expect(nftHolderAddress).not.equals(TestHelper.ZERO_ADDRESS);

    const nftHolderContract = await TestHelper.getContract(
      "NFTHolder",
      nftHolderAddress,
    );
    expect(await nftTokenHolderFactory.getHederaServiceVersion()).equals(
      mockHederaService.address,
    );

    let updatedAddress = await nftHolderContract.getHederaServiceVersion();
    expect(updatedAddress).equals(mockHederaService.address);

    const owner = signers[0];
    const newHederaServiceAddress = signers[3].address;
    await nftTokenHolderFactory
      .connect(owner)
      .upgradeHederaService(newHederaServiceAddress);
    expect(await nftTokenHolderFactory.getHederaServiceVersion()).equals(
      newHederaServiceAddress,
    );

    updatedAddress = await nftHolderContract.getHederaServiceVersion();
    expect(updatedAddress).equals(newHederaServiceAddress);
  });

  it("Verify upgrade Hedera service should fail when owner try to upgrade it ", async () => {
    const { nftTokenHolderFactory, nftToken, signers } =
      await loadFixture(deployFixture);

    const tx = await nftTokenHolderFactory.getTokenHolder(nftToken.address);
    const { name, args } = await TestHelper.readLastEvent(tx);
    const tokenAddress = args[0];
    const godHolderAddress = args[1];

    expect(name).equals("TokenHolderCreated");
    expect(tokenAddress).equals(nftToken.address);
    expect(godHolderAddress).not.equals(TestHelper.ZERO_ADDRESS);
    const nonOwner = signers[1];

    await expect(
      nftTokenHolderFactory
        .connect(nonOwner)
        .upgradeHederaService(signers[3].address),
    ).revertedWith("Ownable: caller is not the owner");
  });
});
