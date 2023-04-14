import { expect } from "chai";
import { TestHelper } from "./TestHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("GODHolder tests", function () {
  const TOTAL_AMOUNT = TestHelper.toPrecision(100);

  async function deployFixture() {
    const admin = (await TestHelper.getDexOwner()).address;
    const signers = await TestHelper.getSigners();

    const baseHTS = await TestHelper.deployMockBaseHTS();

    const token = await TestHelper.deployERC20Mock(TOTAL_AMOUNT);
    await token.setUserBalance(signers[0].address, TOTAL_AMOUNT);

    const godHolder = await TestHelper.deployGodHolder(baseHTS, token);

    const godTokenHolderFactory = await TestHelper.deployGodTokenHolderFactory(
      baseHTS,
      godHolder,
      admin
    );

    return {
      token,
      baseHTS,
      signers,
      godHolder,
      godTokenHolderFactory,
      admin,
      voter: signers[0].address,
    };
  }
  describe("GODHolder contract tests", function () {
    it("Verify contract should be reverted for multiple initialization", async function () {
      const { godHolder, baseHTS, token } = await loadFixture(deployFixture);
      await expect(
        godHolder.initialize(baseHTS.address, token.address)
      ).revertedWith("Initializable: contract is already initialized");
    });

    it("Verify contract should be reverted for invalid inputs during token locking", async function () {
      const { godHolder, voter, baseHTS } = await loadFixture(deployFixture);
      await expect(godHolder.grabTokensFromUser(voter, 0)).revertedWith(
        "GODHolder: lock amount must be a positive number"
      );

      await expect(
        godHolder.grabTokensFromUser(voter, TestHelper.toPrecision(1000))
      ).revertedWith(
        "GODHolder: lock amount can't be greater to the balance amount"
      );

      await baseHTS.setPassTransactionCount(0);
      await expect(
        godHolder.grabTokensFromUser(voter, TestHelper.toPrecision(1))
      ).revertedWith("GODHolder: token transfer failed to contract.");
    });

    it("Verify contract call should be succeeded for valid inputs during token locking", async function () {
      const { godHolder, voter, token } = await loadFixture(deployFixture);
      const voterBalanceFromContractBeforeLocking =
        await godHolder.balanceOfVoter(voter);
      const voterBalanceFromTokenBeforeLocking = await token.balanceOf(voter);
      const contractBalanceFromTokenBeforeLocking = await token.balanceOf(
        godHolder.address
      );

      await godHolder.grabTokensFromUser(voter, TOTAL_AMOUNT);

      const voterBalanceFromContractAfterLocking =
        await godHolder.balanceOfVoter(voter);
      const voterBalanceFromTokenAfterLocking = await token.balanceOf(voter);
      const contractBalanceFromTokenAfterLocking = await token.balanceOf(
        godHolder.address
      );

      expect(contractBalanceFromTokenBeforeLocking).equals(0);
      expect(voterBalanceFromContractBeforeLocking).equals(0);
      expect(voterBalanceFromTokenBeforeLocking).equals(TOTAL_AMOUNT);

      expect(contractBalanceFromTokenAfterLocking).equals(TOTAL_AMOUNT);
      expect(voterBalanceFromContractAfterLocking).equals(TOTAL_AMOUNT);
      expect(voterBalanceFromTokenAfterLocking).equals(0);
    });

    it("Verify contract should be reverted for invalid inputs during token unlocking", async function () {
      const { godHolder, token, voter } = await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(voter, TOTAL_AMOUNT);

      await expect(godHolder.revertTokensForVoter(0)).revertedWith(
        "GODHolder: unlock amount must be a positive number"
      );

      await expect(
        godHolder.revertTokensForVoter(TestHelper.toPrecision(1000))
      ).revertedWith(
        "GODHolder: unlock amount can't be greater to the locked amount"
      );

      await token.setTransaferFailed(true);
      await expect(
        godHolder.revertTokensForVoter(TestHelper.toPrecision(10))
      ).revertedWith("GODHolder: token transfer failed from contract.");
      await token.setTransaferFailed(false);

      await godHolder.addProposalForVoter(voter, 1);
      await expect(godHolder.revertTokensForVoter(TOTAL_AMOUNT)).revertedWith(
        "User's Proposals are active"
      );
      await godHolder.removeActiveProposals([voter], 1);
    });

    it("Verify contract call should be succeeded for valid inputs during token unlocking", async function () {
      const { godHolder, token, voter } = await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(voter, TOTAL_AMOUNT);

      const voterBalanceFromContractBeforeUnLocking =
        await godHolder.balanceOfVoter(voter);
      const voterBalanceFromTokenBeforeUnLocking = await token.balanceOf(voter);
      const contractBalanceFromTokenBeforeUnLocking = await token.balanceOf(
        godHolder.address
      );

      await godHolder.revertTokensForVoter(TOTAL_AMOUNT);

      const voterBalanceFromContractAfterUnLocking =
        await godHolder.balanceOfVoter(voter);
      const voterBalanceFromTokenAfterUnLocking = await token.balanceOf(voter);
      const contractBalanceFromTokenAfterUnLocking = await token.balanceOf(
        godHolder.address
      );

      expect(contractBalanceFromTokenBeforeUnLocking).equals(TOTAL_AMOUNT);
      expect(voterBalanceFromContractBeforeUnLocking).equals(TOTAL_AMOUNT);
      expect(voterBalanceFromTokenBeforeUnLocking).equals(0);

      expect(contractBalanceFromTokenAfterUnLocking).equals(0);
      expect(voterBalanceFromContractAfterUnLocking).equals(0);
      expect(voterBalanceFromTokenAfterUnLocking).equals(TOTAL_AMOUNT);
    });

    it("Verify add and remove active proposals", async function () {
      const { godHolder, signers, voter } = await loadFixture(deployFixture);
      expect((await godHolder.getActiveProposalsForUser()).length).equal(0);
      await godHolder.addProposalForVoter(voter, 1);
      await godHolder.addProposalForVoter(voter, 2);
      await godHolder.addProposalForVoter(voter, 3);
      expect((await godHolder.getActiveProposalsForUser()).length).equal(3);
      await godHolder.removeActiveProposals([voter], 3);
      expect((await godHolder.getActiveProposalsForUser()).length).equal(2);
      await godHolder.removeActiveProposals([voter], 2);
      await godHolder.removeActiveProposals([voter], 1);
      expect((await godHolder.getActiveProposalsForUser()).length).equal(0);
    });

    it("Verify claim tokens", async function () {
      const { godHolder, voter } = await loadFixture(deployFixture);
      expect((await godHolder.getActiveProposalsForUser()).length).equal(0);

      await godHolder.grabTokensFromUser(voter, TOTAL_AMOUNT);
      await godHolder.addProposalForVoter(voter, 1);

      expect((await godHolder.getActiveProposalsForUser()).length).equal(1);
      expect(await godHolder.canUserClaimTokens()).equals(false);

      await godHolder.removeActiveProposals([voter], 1);
      expect((await godHolder.getActiveProposalsForUser()).length).equal(0);
      expect(await godHolder.canUserClaimTokens()).equals(true);

      await godHolder.revertTokensForVoter(TOTAL_AMOUNT);
      expect(await godHolder.canUserClaimTokens()).equals(false);
    });
  });

  describe("GODTokenHolderFactory contract tests", function () {
    it("Verify contract should be reverted for multiple initialization", async function () {
      const { godTokenHolderFactory, godHolder, baseHTS, admin } =
        await loadFixture(deployFixture);
      await expect(
        godTokenHolderFactory.initialize(
          baseHTS.address,
          godHolder.address,
          admin
        )
      ).revertedWith("Initializable: contract is already initialized");
    });

    it("Given a GODHolder when factory is asked to create holder then address should be populated", async () => {
      const { godTokenHolderFactory, token } = await loadFixture(deployFixture);

      const tx = await godTokenHolderFactory.getTokenHolder(token.address);
      const { name, args } = await TestHelper.readLastEvent(tx);
      const tokenAddress = args[0];
      const godHolderAddress = args[1];

      expect(name).equals("TokenHolderCreated");
      expect(tokenAddress).equals(token.address);
      expect(godHolderAddress).not.equals(TestHelper.ZERO_ADDRESS);
    });

    it("Given a GODHolder exist in factory when factory is asked to create another one with different token then address should be populated", async () => {
      const { godTokenHolderFactory, token } = await loadFixture(deployFixture);

      const tx = await godTokenHolderFactory.getTokenHolder(token.address);
      const { name, args } = await TestHelper.readLastEvent(tx);
      const tokenAddress = args[0];
      const godHolderAddress = args[1];

      expect(name).equals("TokenHolderCreated");
      expect(tokenAddress).equals(token.address);
      expect(godHolderAddress).not.equals(TestHelper.ZERO_ADDRESS);

      const token1 = await TestHelper.deployERC20Mock(TOTAL_AMOUNT);
      const tx1 = await godTokenHolderFactory.getTokenHolder(token1.address);
      const { name: name1, args: args1 } = await TestHelper.readLastEvent(tx1);
      const tokenAddress1 = args1[0];
      const godHolderAddress1 = args1[1];

      expect(name1).equals("TokenHolderCreated");
      expect(tokenAddress1).equals(token1.address);
      expect(godHolderAddress1).not.equals(TestHelper.ZERO_ADDRESS);
      expect(godHolderAddress1).not.equals(godHolderAddress);
    });

    it("Given a GODHolder exist in factory when factory is asked to create another one with same token then existing address should return", async () => {
      const { godTokenHolderFactory, token } = await loadFixture(deployFixture);

      const tx = await godTokenHolderFactory.getTokenHolder(token.address);
      const { name, args } = await TestHelper.readLastEvent(tx);
      const tokenAddress = args[0];
      const godHolderAddress = args[1];

      expect(name).equals("TokenHolderCreated");
      expect(tokenAddress).equals(token.address);
      expect(godHolderAddress).not.equals(TestHelper.ZERO_ADDRESS);

      // Use callStatic as we are reading the existing state not modifying it.
      const existingHolderAddress =
        await godTokenHolderFactory.callStatic.getTokenHolder(token.address);

      expect(godHolderAddress).equal(existingHolderAddress);
    });
  });
});
