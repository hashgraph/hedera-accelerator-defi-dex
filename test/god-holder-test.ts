import { ethers } from "ethers";
import { Helper } from "../utils/Helper";
import { expect } from "chai";
import { TestHelper } from "./TestHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("GODHolder tests", function () {
  const TOTAL_AMOUNT = TestHelper.toPrecision(100);

  async function deployFixture() {
    const admin = (await TestHelper.getDexOwner()).address;
    const signers = await TestHelper.getSigners();
    const voter = signers[0].address;
    const voterAccount = signers[0];

    const hederaService = await TestHelper.deployMockHederaService();

    const token = await TestHelper.deployERC20Mock(TOTAL_AMOUNT);
    await token.setUserBalance(voter, TOTAL_AMOUNT);

    const godHolder = await TestHelper.deployGodHolder(hederaService, token);

    const tokenHolderCallerMock = await TestHelper.deployLogic(
      "TokenHolderCallerMock",
      godHolder.address
    );
    // addProposalForVoter / removeActiveProposals methods from TokenHolder having balance verification check during call
    // so adding 1e8 token in advance
    await token.setUserBalance(
      tokenHolderCallerMock.address,
      TestHelper.toPrecision(1)
    );

    const godHolderFactory = await TestHelper.deployGodTokenHolderFactory(
      hederaService,
      godHolder,
      admin
    );

    return {
      admin,
      voter,
      voterAccount,
      token,
      signers,
      godHolder,
      tokenHolderCallerMock,
      hederaService,
      godHolderFactory,
    };
  }

  async function verifyCanClaimAmountEvent(
    info: any,
    user: string,
    canClaim: boolean,
    operation: number
  ) {
    const { name, args } = info;
    expect(name).equals("CanClaimAmount");
    expect(args.length).equals(3);
    expect(args.user).equals(user);
    expect(args.canClaim).equals(canClaim);
    expect(args.operation).equals(operation);
  }

  async function verifyTokenHolderCreatedEvent(txn: any, tokenAddress: string) {
    const { name, args } = await TestHelper.readLastEvent(txn);
    expect(name).equals("TokenHolderCreated");
    expect(args.length).equals(2);
    expect(args.token).equals(tokenAddress);
    expect(ethers.utils.isAddress(args.tokenHolder)).equals(true);
    return { token: args.token, tokenHolder: args.tokenHolder };
  }

  async function verifyProposalCreatedEvent(txn: any) {
    const { name, args } = await TestHelper.readLastEvent(txn);
    expect(name).equals("ProposalCreated");
    expect(args.length).equals(1);
    expect(args.pId).greaterThan(0);
    return { proposalId: args.pId };
  }

  describe("GODHolder contract tests", function () {
    it("Verify contract should be reverted for multiple initialization", async function () {
      const { godHolder, hederaService, token } = await loadFixture(
        deployFixture
      );
      await expect(
        godHolder.initialize(hederaService.address, token.address)
      ).revertedWith("Initializable: contract is already initialized");
    });

    it("Verify contract should be reverted for invalid inputs during token locking", async function () {
      const { godHolder, voter, token } = await loadFixture(deployFixture);
      await expect(godHolder.grabTokensFromUser(voter, 0)).revertedWith(
        "GODHolder: lock amount must be a positive number"
      );

      await expect(
        godHolder.grabTokensFromUser(voter, TestHelper.toPrecision(1000))
      ).revertedWith(
        "GODHolder: lock amount can't be greater to the balance amount"
      );

      await token.setUserBalance(voter, 0);
      await expect(
        godHolder.grabTokensFromUser(voter, TestHelper.toPrecision(10))
      ).revertedWith("GODHolder: balance amount must be a positive number");

      await token.setUserBalance(voter, TOTAL_AMOUNT);
      await token.setTransaferFailed(true);
      await expect(
        godHolder.grabTokensFromUser(voter, TestHelper.toPrecision(1))
      ).revertedWith("GODHolder: token transfer failed to contract.");
    });

    it("Verify contract calls for fully token locking", async function () {
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

    it("Verify contract calls for partial token locking", async function () {
      const { godHolder, voter, token } = await loadFixture(deployFixture);
      const voterBalanceFromContractBeforeLocking =
        await godHolder.balanceOfVoter(voter);
      const voterBalanceFromTokenBeforeLocking = await token.balanceOf(voter);
      const contractBalanceFromTokenBeforeLocking = await token.balanceOf(
        godHolder.address
      );

      const LOCKED_AMOUNT = TOTAL_AMOUNT - TestHelper.toPrecision(5);
      const BALANCE_AMOUNT = TOTAL_AMOUNT - LOCKED_AMOUNT;
      await godHolder.grabTokensFromUser(voter, LOCKED_AMOUNT);

      const voterBalanceFromContractAfterLocking =
        await godHolder.balanceOfVoter(voter);
      const voterBalanceFromTokenAfterLocking = await token.balanceOf(voter);
      const contractBalanceFromTokenAfterLocking = await token.balanceOf(
        godHolder.address
      );

      expect(contractBalanceFromTokenBeforeLocking).equals(0);
      expect(voterBalanceFromContractBeforeLocking).equals(0);
      expect(voterBalanceFromTokenBeforeLocking).equals(TOTAL_AMOUNT);

      expect(contractBalanceFromTokenAfterLocking).equals(LOCKED_AMOUNT);
      expect(voterBalanceFromContractAfterLocking).equals(LOCKED_AMOUNT);
      expect(voterBalanceFromTokenAfterLocking).equals(BALANCE_AMOUNT);
    });

    it("Verify contract should be reverted for invalid inputs during token unlocking", async function () {
      const { godHolder, token, voterAccount, tokenHolderCallerMock } =
        await loadFixture(deployFixture);

      await godHolder
        .connect(voterAccount)
        .grabTokensFromUser(voterAccount.address, TOTAL_AMOUNT);

      await expect(
        godHolder.connect(voterAccount).revertTokensForVoter(0)
      ).revertedWith("GODHolder: unlock amount must be a positive number");

      await tokenHolderCallerMock.connect(voterAccount).addProposal(1);
      await expect(godHolder.revertTokensForVoter(TOTAL_AMOUNT)).revertedWith(
        "User's Proposals are active"
      );

      await tokenHolderCallerMock
        .connect(voterAccount)
        .removeProposals(1, [voterAccount.address]);

      await expect(
        godHolder.revertTokensForVoter(TestHelper.toPrecision(1000))
      ).revertedWith(
        "GODHolder: unlock amount can't be greater to the locked amount"
      );

      await token.setTransaferFailed(true);
      await expect(godHolder.revertTokensForVoter(TOTAL_AMOUNT)).revertedWith(
        "GODHolder: token transfer failed from contract."
      );
      await token.setTransaferFailed(false);
    });

    it("Verify contract calls for fully token unlocking", async function () {
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

    it("Verify contract calls for partial token unlocking", async function () {
      const { godHolder, token, voter } = await loadFixture(deployFixture);
      await godHolder.grabTokensFromUser(voter, TOTAL_AMOUNT);

      const voterBalanceFromContractBeforeUnLocking =
        await godHolder.balanceOfVoter(voter);
      const voterBalanceFromTokenBeforeUnLocking = await token.balanceOf(voter);
      const contractBalanceFromTokenBeforeUnLocking = await token.balanceOf(
        godHolder.address
      );

      const UNLOCK_AMOUNT = TOTAL_AMOUNT - TestHelper.toPrecision(1);
      const BALANCE_AMOUNT = TOTAL_AMOUNT - UNLOCK_AMOUNT;
      await godHolder.revertTokensForVoter(UNLOCK_AMOUNT);

      const voterBalanceFromContractAfterUnLocking =
        await godHolder.balanceOfVoter(voter);
      const voterBalanceFromTokenAfterUnLocking = await token.balanceOf(voter);
      const contractBalanceFromTokenAfterUnLocking = await token.balanceOf(
        godHolder.address
      );

      expect(contractBalanceFromTokenBeforeUnLocking).equals(TOTAL_AMOUNT);
      expect(voterBalanceFromContractBeforeUnLocking).equals(TOTAL_AMOUNT);
      expect(voterBalanceFromTokenBeforeUnLocking).equals(0);

      expect(contractBalanceFromTokenAfterUnLocking).equals(BALANCE_AMOUNT);
      expect(voterBalanceFromContractAfterUnLocking).equals(BALANCE_AMOUNT);
      expect(voterBalanceFromTokenAfterUnLocking).equals(UNLOCK_AMOUNT);
    });

    it("Verify add and remove active proposals should be reverted if called from outside contract", async function () {
      const { godHolder } = await loadFixture(deployFixture);
      await expect(godHolder.addProposalForVoter(1)).revertedWith(
        "TokenHolder: caller must be contract"
      );
      await expect(godHolder.removeActiveProposals([], 1)).revertedWith(
        "TokenHolder: caller must be contract"
      );
    });

    it("Verify remove active proposals should be reverted if wrong voters passed", async function () {
      const { signers, voterAccount, tokenHolderCallerMock } =
        await loadFixture(deployFixture);

      await tokenHolderCallerMock.connect(voterAccount).addProposal(1);
      await expect(
        tokenHolderCallerMock.removeProposals(1, [signers[9].address])
      ).revertedWith("TokenHolder: voter info not available");
    });

    it("Verify add and remove active proposals should be reverted if caller contract having zero god tokens", async function () {
      const { token, voterAccount, tokenHolderCallerMock } = await loadFixture(
        deployFixture
      );

      // reset balance of caller contract before proposal creation
      await token.setUserBalance(tokenHolderCallerMock.address, 0);
      expect(await token.balanceOf(tokenHolderCallerMock.address)).equals(0);

      await expect(
        tokenHolderCallerMock.connect(voterAccount).addProposal(1)
      ).revertedWith("TokenHolder: insufficient balance");

      await expect(
        tokenHolderCallerMock
          .connect(voterAccount)
          .removeProposals(1, [voterAccount.address])
      ).revertedWith("TokenHolder: insufficient balance");
    });

    it("Verify add and remove active proposals", async function () {
      const { token, godHolder, voterAccount, tokenHolderCallerMock } =
        await loadFixture(deployFixture);

      // balance of governor before proposal creation
      expect(await token.balanceOf(tokenHolderCallerMock.address)).greaterThan(
        0
      );

      await tokenHolderCallerMock.connect(voterAccount).addProposal(1);
      expect((await godHolder.getActiveProposalsForUser()).length).equal(1);

      await tokenHolderCallerMock.connect(voterAccount).addProposal(2);
      expect((await godHolder.getActiveProposalsForUser()).length).equal(2);

      await tokenHolderCallerMock
        .connect(voterAccount)
        .removeProposals(1, [voterAccount.address]);
      expect((await godHolder.getActiveProposalsForUser()).length).equal(1);

      await tokenHolderCallerMock
        .connect(voterAccount)
        .removeProposals(2, [voterAccount.address]);
      expect((await godHolder.getActiveProposalsForUser()).length).equal(0);
    });

    it("Verify claim tokens", async function () {
      const { godHolder, voter, voterAccount, tokenHolderCallerMock } =
        await loadFixture(deployFixture);
      expect((await godHolder.getActiveProposalsForUser()).length).equal(0);

      await tokenHolderCallerMock.connect(voterAccount).addProposal(1);

      const events: any = [];
      godHolder.on(
        "CanClaimAmount",
        (user: string, canClaim: boolean, operation: number) => {
          events.push({
            name: "CanClaimAmount",
            args: { user, canClaim, operation, length: 3 },
          });
        }
      );

      await godHolder
        .connect(voterAccount)
        .grabTokensFromUser(voterAccount.address, TOTAL_AMOUNT);

      expect((await godHolder.getActiveProposalsForUser()).length).equal(1);
      expect(await godHolder.canUserClaimTokens(voter)).equals(false);

      await tokenHolderCallerMock
        .connect(voterAccount)
        .removeProposals(1, [voterAccount.address]);

      expect((await godHolder.getActiveProposalsForUser()).length).equal(0);
      expect(await godHolder.canUserClaimTokens(voter)).equals(true);

      await godHolder.revertTokensForVoter(TOTAL_AMOUNT);
      expect(await godHolder.canUserClaimTokens(voter)).equals(false);

      await Helper.delay(5000);
      await verifyCanClaimAmountEvent(events[0], voter, false, 1);
      await verifyCanClaimAmountEvent(events[1], voter, true, 2);
    });
  });

  describe("GODTokenHolderFactory contract tests", function () {
    it("Verify contract should be reverted for multiple initialization", async function () {
      const { godHolderFactory, godHolder, hederaService, admin } =
        await loadFixture(deployFixture);
      await expect(
        godHolderFactory.initialize(
          hederaService.address,
          godHolder.address,
          admin
        )
      ).revertedWith("Initializable: contract is already initialized");
    });

    it("Given a GODHolder when factory is asked to create holder then address should be populated", async () => {
      const { godHolderFactory, token } = await loadFixture(deployFixture);
      const tx = await godHolderFactory.getTokenHolder(token.address);
      await verifyTokenHolderCreatedEvent(tx, token.address);
    });

    it("Given a GODHolder exist in factory when factory is asked to create another one with different token then address should be populated", async () => {
      const { godHolderFactory, token } = await loadFixture(deployFixture);

      const tx = await godHolderFactory.getTokenHolder(token.address);
      const info = await verifyTokenHolderCreatedEvent(tx, token.address);

      const token1 = await TestHelper.deployERC20Mock(TOTAL_AMOUNT);
      const tx1 = await godHolderFactory.getTokenHolder(token1.address);
      const info1 = await verifyTokenHolderCreatedEvent(tx1, token1.address);

      expect(info.token).not.equals(info1.token);
      expect(info.tokenHolder).not.equals(info1.tokenHolder);
    });

    it("Given a GODHolder exist in factory when factory is asked to create another one with same token then existing address should return", async () => {
      const { godHolderFactory, token } = await loadFixture(deployFixture);

      const tx = await godHolderFactory.getTokenHolder(token.address);
      const info = await verifyTokenHolderCreatedEvent(tx, token.address);

      // Use callStatic as we are reading the existing state not modifying it.
      const existingHolderAddress =
        await godHolderFactory.callStatic.getTokenHolder(token.address);

      expect(info.tokenHolder).equal(existingHolderAddress);
    });

    it("Verify upgrade Hedera service should pass when owner try to upgrade it ", async () => {
      const { godHolderFactory, token, signers, hederaService } =
        await loadFixture(deployFixture);

      const tx = await godHolderFactory.getTokenHolder(token.address);
      const info = await verifyTokenHolderCreatedEvent(tx, token.address);

      const godHolderContract = await TestHelper.getContract(
        "GODHolder",
        info.tokenHolder
      );
      expect(await godHolderFactory.getHederaServiceVersion()).equals(
        hederaService.address
      );

      let updatedAddress = await godHolderContract.getHederaServiceVersion();
      expect(updatedAddress).equals(hederaService.address);

      const owner = signers[0];
      const newHederaServiceAddress = signers[3].address;
      await godHolderFactory
        .connect(owner)
        .upgradeHederaService(newHederaServiceAddress);
      expect(await godHolderFactory.getHederaServiceVersion()).equals(
        newHederaServiceAddress
      );

      updatedAddress = await godHolderContract.getHederaServiceVersion();
      expect(updatedAddress).equals(newHederaServiceAddress);
    });

    it("Verify upgrade Hedera service should fail when non-owner try to upgrade it ", async () => {
      const { godHolderFactory, signers } = await loadFixture(deployFixture);
      const nonOwner = signers[1];
      await expect(
        godHolderFactory
          .connect(nonOwner)
          .upgradeHederaService(signers[3].address)
      ).revertedWith("Ownable: caller is not the owner");
    });
  });
});
