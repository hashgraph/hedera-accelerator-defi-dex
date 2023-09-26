import Common from "../business/Common";
import NFTToken from "../business/NFTToken";
import GodHolder from "../business/GodHolder";
import NFTHolder from "../business/NFTHolder";
import AssetsHolder from "../business/AssetsHolder";
import HederaGovernor, { ProposalInfo } from "../business/HederaGovernor";

import { expect } from "chai";
import { Helper } from "../../utils/Helper";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import { AddressHelper } from "../../utils/AddressHelper";
import { CommonSteps, TokenInfo } from "./CommonSteps";
import { binding, given, then, when } from "cucumber-tsflow";
import { Hbar, TokenId, HbarUnit, AccountId, ContractId } from "@hashgraph/sdk";

interface Proposal {
  proposalInfo: ProposalInfo;
  assetHolder: {
    contractId: string;
    contractEvmAddress: string;
  };
}

// To's account shouldn't be used in any transaction, we kept this for transfer verification only
// ----------------
const toAccountId = clientsInfo.uiUserId;
const toAccountPK = clientsInfo.uiUserKey;
const toClient = clientsInfo.uiUserClient;
// ----------------

const voterAccountId = clientsInfo.treasureId;
const voterAccountPK = clientsInfo.treasureKey;
const voterClient = clientsInfo.treasureClient;

const creatorId = clientsInfo.treasureId;
const creatorPK = clientsInfo.treasureKey;
const creatorClient = clientsInfo.treasureClient;

let governor: HederaGovernor;
let tokenHolder: GodHolder | NFTHolder;

let proposal: Proposal;
let errorMessage: string;
let godTokenInfo: TokenInfo;
let receiverBalance: BigNumber;
let lastCreatedToken: TokenId;
let proposalCreationId: number;

@binding()
export class HederaGovernorTest extends CommonSteps {
  @given(/User creates the Governor for token-id "([^"]*)"/, undefined, 600000)
  public async setup(godTokenId: string) {
    console.log("---:Running HederaGovernorTest:---");
    console.log("----------------------------------", "\n");
    godTokenInfo = await Common.getTokenInfo(godTokenId);
    console.table(godTokenInfo);
    await this.deployRequiredContracts();
  }

  @when(/User initialized the contracts/, undefined, 500000)
  public async initContracts() {
    await this._initContracts();
  }

  @then(/User verify the initialization/, undefined, 30000)
  public async verifyInitialization() {
    const tokenId = (await governor.getGODTokenAddress()).toString();
    expect(tokenId).equals(godTokenInfo.id);
  }

  @when(/User setup "([^"]*)" tokens allowance for Locking/, undefined, 30000)
  public async setupAllowanceForLocking(amountOrId: string) {
    await CommonSteps.setupAllowanceForLocking(
      tokenHolder,
      this.normalizeAmountOrId(amountOrId),
      voterAccountId,
      voterAccountPK,
      voterClient,
    );
  }

  @when(
    /User lock "([^"]*)" tokens in token holder for voting/,
    undefined,
    30000,
  )
  public async lockTokensForVoting(amountOrId: string) {
    await CommonSteps.lockTokensForVoting(
      tokenHolder,
      this.normalizeAmountOrId(amountOrId),
      voterAccountId,
      voterClient,
    );
  }

  @then(/User verify the locked tokens in token holder/, undefined, 30000)
  public async verifyLockedTokensCount() {
    expect(
      await tokenHolder.balanceOfVoter(voterAccountId, voterClient),
    ).greaterThan(0);
  }

  @given(
    /User setup allowance for proposal creation with amount\/id "([^"]*)"/,
    undefined,
    30000,
  )
  public async setupProposalCreationAllowance(amountOrId: string) {
    this.initProposalCreationId(amountOrId);
    await CommonSteps.setupProposalCreationAllowance(
      godTokenInfo.isNFT,
      governor,
      creatorId,
      creatorPK,
      creatorClient,
    );
  }

  @when(
    /User create a text proposal where title is "([^"]*)"/,
    undefined,
    30000,
  )
  public async createTextProposal(title: string) {
    try {
      proposal = await governor.createTextProposal(
        Helper.createProposalTitle(title),
        creatorClient,
        governor.DEFAULT_DESCRIPTION,
        governor.DEFAULT_LINK,
        governor.DEFAULT_META_DATA,
        proposalCreationId,
      );
    } catch (error: any) {
      console.error(" - createTextProposal:-", error.message);
      errorMessage = error.message;
    }
  }

  @when(
    /User create a token association proposal for token "([^"]*)"/,
    undefined,
    60000,
  )
  public async createTokenAssociationProposal(tokenIdString: string) {
    try {
      proposal = await governor.createTokenAssociationProposal(
        TokenId.fromString(tokenIdString),
        Helper.createProposalTitle("E2E-Token-Association"),
        creatorClient,
        governor.DEFAULT_DESCRIPTION,
        governor.DEFAULT_LINK,
        governor.DEFAULT_META_DATA,
        proposalCreationId,
      );
    } catch (error: any) {
      console.error(" - createTokenAssociationProposal:-", error.message);
      errorMessage = error.message;
    }
  }

  @when(
    /User create a assets transfer proposal for token "([^"]*)" & amount\/id "([^"]*)"/,
    undefined,
    60000,
  )
  public async createAssetTransferProposal(
    tokenIdString: string,
    amountOrId: string,
  ) {
    try {
      proposal = await governor.createAssetTransferProposal(
        toAccountId.toSolidityAddress(),
        TokenId.fromString(tokenIdString).toSolidityAddress(),
        BigNumber(amountOrId).toNumber(),
        Helper.createProposalTitle("E2E-Assets-Transfer"),
        creatorClient,
        governor.DEFAULT_DESCRIPTION,
        governor.DEFAULT_LINK,
        governor.DEFAULT_META_DATA,
        proposalCreationId,
      );
    } catch (error: any) {
      console.error("createAssetTransferProposal:-", error.message);
      errorMessage = error.message;
    }
  }

  @when(
    /User create a token-create proposal with name & symbol "([^"]*)" and initial value "([^"]*)" where fee "([^"]*)"/,
    undefined,
    60000,
  )
  public async createTokenProposal(
    nameAndSymbol: string,
    initialSupply: string,
    createTokenFee: string,
  ) {
    try {
      proposal = await governor.createTokenProposal(
        nameAndSymbol,
        nameAndSymbol,
        this.normalizeAmountOrId(initialSupply),
        this.normalizeAmountOrId(createTokenFee),
        Helper.createProposalTitle("E2E-Token-Create"),
        creatorClient,
        governor.DEFAULT_DESCRIPTION,
        governor.DEFAULT_LINK,
        governor.DEFAULT_META_DATA,
        proposalCreationId,
      );
    } catch (error: any) {
      console.error("createTokenProposal:-", error.message);
      errorMessage = error.message;
    }
  }

  @when(
    /User create a token-mint proposal with value "([^"]*)"/,
    undefined,
    60000,
  )
  public async createMintTokenProposal(mintAmount: string) {
    try {
      proposal = await governor.createMintTokenProposal(
        lastCreatedToken.toSolidityAddress(),
        this.normalizeAmountOrId(mintAmount),
        Helper.createProposalTitle("E2E-Token-Mint"),
        creatorClient,
        governor.DEFAULT_DESCRIPTION,
        governor.DEFAULT_LINK,
        governor.DEFAULT_META_DATA,
        proposalCreationId,
      );
    } catch (error: any) {
      console.error("createMintTokenProposal:-", error.message);
      errorMessage = error.message;
    }
  }

  @when(
    /User create a token-burn proposal with value "([^"]*)"/,
    undefined,
    60000,
  )
  public async createBurnTokenProposal(mintAmount: string) {
    try {
      proposal = await governor.createBurnTokenProposal(
        lastCreatedToken.toSolidityAddress(),
        this.normalizeAmountOrId(mintAmount),
        Helper.createProposalTitle("E2E-Token-Burn"),
        creatorClient,
        governor.DEFAULT_DESCRIPTION,
        governor.DEFAULT_LINK,
        governor.DEFAULT_META_DATA,
        proposalCreationId,
      );
    } catch (error: any) {
      console.error("createBurnTokenProposal:-", error.message);
      errorMessage = error.message;
    }
  }

  @when(
    /User create a contract-logic upgrade proposal proxy is "([^"]*)" and logic is "([^"]*)"/,
    undefined,
    80000,
  )
  public async createLogicUpgradeProposal(proxyId: string, logicId: string) {
    try {
      const proxyAddress = await AddressHelper.idToEvmAddress(proxyId);
      const logicAddress = await AddressHelper.idToEvmAddress(logicId);
      proposal = await governor.createUpgradeProposal(
        proxyAddress,
        logicAddress,
        clientsInfo.proxyAdminId.toSolidityAddress(),
        Helper.createProposalTitle("E2E-Logic-Upgrade"),
        creatorClient,
        governor.DEFAULT_DESCRIPTION,
        governor.DEFAULT_LINK,
        governor.DEFAULT_META_DATA,
        proposalCreationId,
      );
    } catch (error: any) {
      console.error("createLogicUpgradeProposal:-", error.message);
      errorMessage = error.message;
    }
  }

  @when(
    /User transfer assets to assets-holder before execution for token "([^"]*)" & amount\/id "([^"]*)"/,
    undefined,
    30000,
  )
  public async sendingAmountToAssetHolderBeforeExecution(
    tokenIdString: string,
    amountOrId: string,
  ) {
    await Common.transferAssets(
      tokenIdString,
      this.normalizeAmountOrId(amountOrId),
      proposal.assetHolder.contractId,
      voterAccountId,
      voterAccountPK,
      voterClient,
    );
  }

  @when(/User transfer ownership of proxy to assets-holder/, undefined, 30000)
  public async transferProxyOwnershipToAssetHolder() {
    const pInfo = proposal.proposalInfo;
    const decodedInfo = await governor.decodeProxyUpgradeProposalData(pInfo);
    if (decodedInfo) {
      console.log(" - transferProxyOwnershipToAssetHolder:", decodedInfo);
      const proxy = decodedInfo._proxy;
      const proxyContractId = await AddressHelper.addressToIdObject(proxy);
      const common = new Common(proxyContractId);
      await common.changeAdmin(proposal.assetHolder.contractEvmAddress);
    }
  }

  @when(
    /User associate the receiving token to their account "([^"]*)"/,
    undefined,
    30000,
  )
  public async associateTokenToEOAAccountBeforeExecution(
    tokenIdString: string,
  ) {
    await Common.associateTokensToAccount(
      toAccountId,
      [tokenIdString],
      toClient,
      toAccountPK,
    );
  }

  @when(
    /User waits for proposal state to be "([^"]*)" for max (\d*) seconds/,
    undefined,
    60000,
  )
  public async waitForRequiredState(state: string, seconds: number) {
    await CommonSteps.waitForRequiredState(
      state,
      seconds,
      governor,
      proposal.proposalInfo.proposalId,
    );
  }

  @when(/User votes "([^"]*)" proposal/, undefined, 30000)
  public async voteToProposal(vote: string): Promise<void> {
    try {
      await CommonSteps.vote(
        vote,
        governor,
        proposal.proposalInfo.proposalId,
        voterClient,
      );
    } catch (error: any) {
      console.error("voteToProposal:-", error.message);
      errorMessage = error.message;
    }
  }

  @then(/User execute the proposal with fee "([^"]*)"/, undefined, 30000)
  public async execute(executionFee: string): Promise<void> {
    try {
      const normalizeAmountOrId = this.normalizeAmountOrId(executionFee);
      const fee = new Hbar(normalizeAmountOrId, HbarUnit.Tinybar)
        .to(HbarUnit.Hbar)
        .toNumber();
      await governor.executeProposal(proposal.proposalInfo, creatorClient, fee);
    } catch (error: any) {
      console.error("execute:-", error.message);
      errorMessage = error.message;
    }
  }

  @when(/User try to cancel the proposal by creator account/, undefined, 30000)
  public async cancelByCreatorAccount(): Promise<void> {
    try {
      await governor.cancelProposal(proposal.proposalInfo, creatorClient);
    } catch (error: any) {
      console.error("cancel:-", error.message);
      errorMessage = error.message;
    }
  }

  @when(
    /User try to cancel the proposal by non-creator account/,
    undefined,
    30000,
  )
  public async cancelByNonCreatorAccount(): Promise<void> {
    try {
      await governor.cancelProposal(
        proposal.proposalInfo,
        clientsInfo.operatorClient,
      );
    } catch (error: any) {
      console.error("cancel:-", error.message);
      errorMessage = error.message;
    }
  }

  @when(/User fetch last created token/, undefined, 30000)
  public async fetchLastCreatedToken(): Promise<void> {
    lastCreatedToken = (await this.getAllCreatedToken()).at(-1)!;
  }

  @when(/User run cleanup task/, undefined, 400000)
  public async cleanup() {
    try {
      await governor.cancelAllProposals(creatorClient);
      await tokenHolder.checkAndClaimGodTokens(voterClient, voterAccountId);
    } catch (error: any) {
      console.error("cleanup:-", error.message);
    }
  }

  @when(
    /User fetch current receiver balance for token "([^"]*)"/,
    undefined,
    30000,
  )
  public async fetchReceiverCurrentBalance(tokenId: string) {
    receiverBalance = await this.getAccountBalance(tokenId, toAccountId);
  }

  @then(/User verify transfer successfully/, undefined, 60000)
  public async verifyTransferOperation() {
    if (proposal) {
      const pInfo = proposal.proposalInfo;
      const decodedInfo = await governor.decodeTransferProposalData(pInfo);
      if (decodedInfo) {
        const to = decodedInfo.to;
        const token = TokenId.fromSolidityAddress(decodedInfo.token);
        const amount = decodedInfo.amount.toNumber();
        this._verifyTransferOperation(to, token, amount);
      }
    }
  }

  @then(/User verify token supply amount "([^"]*)"/, undefined, 6000)
  public async verifyTokenSupply(expectedSupply: string) {
    const expectedTotalSupply = this.normalizeAmountOrId(expectedSupply);
    const { totalSupply } = await Common.getTokenInfo(lastCreatedToken);
    expect(expectedTotalSupply.toString()).equals(totalSupply.toString());
  }

  @then(/User verify proxy logic address/, undefined, 60000)
  public async verifyProxyLogicAddressChanges() {
    if (proposal) {
      const pInfo = proposal.proposalInfo;
      const decodedInfo = await governor.decodeProxyUpgradeProposalData(pInfo);
      if (decodedInfo) {
        console.log(" - verifyProxyLogicAddressChanges:", decodedInfo);
        const proxy: string = decodedInfo._proxy;
        const proxyLogic: string = decodedInfo._proxyLogic;
        const proxyContractId = await AddressHelper.addressToIdObject(proxy);
        const common = new Common(proxyContractId);
        const proxyCurrentLogic = await common.getCurrentImplementation();
        expect(Helper.areAddressesSame(proxyLogic, proxyCurrentLogic)).equals(
          true,
        );
      }
    }
  }

  @then(/User received the error message "([^"]*)"/, undefined, 30000)
  public async verifyErrorMessage(msg: string) {
    expect(errorMessage.toLowerCase()).includes(msg.toLowerCase());
    errorMessage = "";
  }

  private async deployRequiredContracts() {
    const _contracts = [
      "HederaGovernor",
      godTokenInfo.isNFT ? "NFTHolder" : "GodHolder",
    ];
    await this.deploy(_contracts.toString());
    return _contracts;
  }

  private async _initContracts() {
    tokenHolder = godTokenInfo.isNFT ? new NFTHolder() : new GodHolder();
    await tokenHolder.initialize(voterClient, godTokenInfo.address);

    governor = new HederaGovernor();
    await governor.initialize(
      tokenHolder,
      voterClient,
      CommonSteps.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
      CommonSteps.DEFAULT_VOTING_DELAY,
      CommonSteps.DEFAULT_VOTING_PERIOD,
      TokenId.fromString(godTokenInfo.id),
    );
  }

  private normalizeAmountOrId(amountOrId: string) {
    return BigNumber(amountOrId).toNumber();
  }

  private initProposalCreationId(amountOrId: string) {
    proposalCreationId = godTokenInfo.isNFT
      ? this.normalizeAmountOrId(amountOrId)
      : 0;
  }

  private async getAllCreatedToken(delayRequired: boolean = true) {
    const contractId = ContractId.fromString(proposal.assetHolder.contractId);
    return await new AssetsHolder(contractId).getCreatedTokens(delayRequired);
  }

  private async _verifyTransferOperation(
    to: string,
    token: TokenId,
    amountOrId: number,
  ) {
    if (
      Common.isHBAR(token.toString()) ||
      !(await Common.getTokenInfo(token)).isNFT
    ) {
      const toBalance = await this.getAccountBalance(
        token.toString(),
        toAccountId,
      );
      const isSameBalance = receiverBalance
        .plus(amountOrId)
        .isEqualTo(toBalance);
      expect(isSameBalance).equals(true);
    } else {
      const contractId = ContractId.fromString(token.toString());
      const ownerAddress = await new NFTToken(contractId).ownerOf(amountOrId);
      const receiverAddress = toAccountId.toSolidityAddress();
      expect(receiverAddress).includes(ownerAddress);
    }
    // verify 'to' and 'toAccountId' must be same
    expect(to).includes(toAccountId.toSolidityAddress());
    // sending token / amount back to sender account so can be used further
    await Common.transferAssets(
      token,
      amountOrId,
      voterAccountId,
      toAccountId,
      toAccountPK,
      toClient,
    );
  }

  private async getAccountBalance(tokenId: string, toAccountId: AccountId) {
    if (Common.isHBAR(tokenId)) {
      return await Common.getAccountBalance(
        toAccountId,
        undefined,
        voterClient,
      );
    }
    return await Common.getTokenBalance(toAccountId, tokenId);
  }
}
