import dex from "../../deployment/model/dex";
import Common from "../business/Common";
import GodHolder from "../business/GodHolder";
import FTTokenHolderFactory from "../business/factories/FTTokenHolderFactory";
import TokenTransferGovernor from "../business/TokenTransferGovernor";

import { expect } from "chai";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import { CommonSteps } from "./CommonSteps";
import { binding, given, then, when } from "cucumber-tsflow";
import { TokenId, ContractId, AccountId } from "@hashgraph/sdk";

const TAG = "GovernorTokenTransfer";
const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
const TRANSFER_TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);

const noGodTokenUserAccountId = clientsInfo.operatorIdNoGODToken;

const senderAccountId = clientsInfo.treasureId;
const senderAccountPK = clientsInfo.treasureKey;

const voterAccountId = clientsInfo.treasureId;
const voterAccountPK = clientsInfo.treasureKey;
const voterClient = clientsInfo.treasureClient;

const proposalCreatorAccountId = clientsInfo.operatorId;
const proposalCreatorAccountPK = clientsInfo.operatorKey;
const proposalCreatorClient = clientsInfo.operatorClient;

const receiverAccountId = clientsInfo.uiUserId;
const receiverAccountPK = clientsInfo.uiUserKey;

const feePayerClient = clientsInfo.operatorClient;

let ftHolder: GodHolder;
let governor: TokenTransferGovernor;
let ftTokenHolderFactory: FTTokenHolderFactory;

let proposalId: string;
let errorMessage: string;
let contractBalanceBeforeTransfer: BigNumber;
let tokenTransferAmount: BigNumber;
let tokenLockedAmount: number;

@binding()
export class GovernorTokenTransfer extends CommonSteps {
  @given(/User deploy contracts "([^"]*)"/, TAG, 60000)
  public async deployContracts(contracts: string): Promise<void> {
    await this.deploy(contracts);
  }

  @given(/User have initialized the contracts/, TAG, 60000)
  public async initialize(): Promise<void> {
    ftTokenHolderFactory = new FTTokenHolderFactory();
    await ftTokenHolderFactory.initialize();

    const cId = await ftTokenHolderFactory.getTokenHolder(
      GOD_TOKEN_ID.toSolidityAddress(),
      feePayerClient
    );
    ftHolder = new GodHolder(cId);
    governor = new TokenTransferGovernor();
    console.log(
      "*******************Starting governor transfer token test with following credentials*******************"
    );
    console.log("GTT contract-id:", governor.contractId);
    console.log("FTHolder contract-id:", ftHolder.contractId);
    console.log(
      "FTHolderFactory contract-id:",
      ftTokenHolderFactory.contractId
    );
    console.log("Sender Id :", senderAccountId.toString());
    console.log("Receiver Id :", receiverAccountId.toString());
    console.log("GodToken Id :", GOD_TOKEN_ID.toString());
    console.log("");
    await this.initializeGovernorContract(
      governor,
      ftHolder,
      clientsInfo.operatorClient,
      GOD_TOKEN_ID,
      GOD_TOKEN_ID
    );
  }

  @when(
    /User create a token transfer proposal with title "([^"]*)" description "([^"]*)" link "([^"]*)" and token amount (\d*)/,
    TAG,
    30000
  )
  public async createProposal(
    title: string,
    description: string,
    link: string,
    tokenAmount: number
  ): Promise<void> {
    try {
      tokenTransferAmount = new BigNumber(
        tokenAmount * CommonSteps.withPrecision
      );
      proposalId = await governor.createTokenTransferProposal(
        title,
        receiverAccountId.toSolidityAddress(),
        TRANSFER_TOKEN_ID.toSolidityAddress(),
        tokenTransferAmount,
        feePayerClient,
        governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
        description,
        link,
        proposalCreatorAccountId.toSolidityAddress()
      );
    } catch (e: any) {
      errorMessage = e.message;
    }
  }

  @when(
    /User with no GOD token create a new proposal with title "([^"]*)" description "([^"]*)" link "([^"]*)" and token amount (\d*)/
  )
  public async createProposalWithNoGODToken(
    title: string,
    description: string,
    link: string,
    tokenAmount: number
  ): Promise<void> {
    const tokenQty = tokenAmount * CommonSteps.withPrecision;
    try {
      await governor.createTokenTransferProposal(
        title,
        receiverAccountId.toSolidityAddress(),
        TRANSFER_TOKEN_ID.toSolidityAddress(),
        tokenQty,
        feePayerClient,
        governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
        description,
        link,
        noGodTokenUserAccountId.toSolidityAddress()
      );
    } catch (e: any) {
      errorMessage = e.message;
    }
  }

  @when(
    /User create a token association proposal with title "([^"]*)", description "([^"]*)", link "([^"]*)"/,
    TAG,
    30000
  )
  public async createTokenAssociateProposal(
    title: string,
    description: string,
    link: string
  ): Promise<void> {
    proposalId = await governor.createTokenAssociateProposal(
      title,
      TRANSFER_TOKEN_ID.toSolidityAddress(),
      feePayerClient,
      description,
      link,
      governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
      proposalCreatorAccountId.toSolidityAddress()
    );
  }

  @then(/User verify that proposal state is "([^"]*)"/, TAG, 30000)
  public async verifyProposalState(proposalState: string): Promise<void> {
    const { currentState, proposalStateNumeric } = await this.getProposalState(
      governor,
      proposalId,
      voterClient,
      proposalState
    );
    expect(Number(currentState)).to.eql(proposalStateNumeric);
  }

  @then(/User gets message "([^"]*)"/, TAG, 30000)
  public async verifyErrorMsg(message: string): Promise<void> {
    expect(errorMessage).contains(message);
  }

  @when(/User execute the proposal with title "([^"]*)"/, TAG, 30000)
  public async execute(title: string) {
    try {
      await this.executeProposal(
        governor,
        title,
        clientsInfo.treasureKey, // TODO: not needed
        feePayerClient
      );
    } catch (e: any) {
      errorMessage = e.message;
    }
  }

  @when(/User vote "([^"]*)" proposal/, TAG, 30000)
  public async voteToProposal(vote: string): Promise<void> {
    await this.vote(governor, vote, proposalId, voterClient);
  }

  @when(/User setup default allowance for GTT proposals/, TAG, 30000)
  public async setAllowanceForProposalCreation() {
    await this.setupAllowanceForProposalCreation(
      governor,
      proposalCreatorClient,
      proposalCreatorAccountId,
      proposalCreatorAccountPK
    );
  }

  @when(/User reset default allowance for GTT proposals/, TAG, 30000)
  public async resetAllowanceForProposalCreation() {
    await this.setupAllowanceForToken(
      governor,
      GOD_TOKEN_ID,
      0,
      governor.contractId,
      proposalCreatorAccountId,
      proposalCreatorAccountPK,
      proposalCreatorClient
    );
  }

  @when(/User fetches token balance from GTT contract/, TAG, 30000)
  public async getTokenBalanceFromContract() {
    contractBalanceBeforeTransfer = await Common.getTokenBalance(
      ContractId.fromString(governor.contractId),
      TRANSFER_TOKEN_ID
    );
  }

  @then(/User verify that token is transferred from GTT contract/, TAG, 30000)
  public async verifyTokenBalance() {
    const contractBalanceAfterTransfer = await Common.getTokenBalance(
      ContractId.fromString(governor.contractId),
      TRANSFER_TOKEN_ID
    );
    expect(
      contractBalanceAfterTransfer
        .plus(tokenTransferAmount)
        .isEqualTo(contractBalanceBeforeTransfer)
    ).equals(true);
  }

  @when(/User get assets back from GTT/, TAG, 30000)
  public async getLockedTokensFromGTT() {
    const transferTokenInGTT = await Common.getTokenBalance(
      ContractId.fromString(governor.contractId),
      TRANSFER_TOKEN_ID
    );
    if (transferTokenInGTT.isGreaterThan(0)) {
      await Common.transferTokens(
        senderAccountId,
        AccountId.fromString(governor.contractId),
        clientsInfo.operatorKey,
        TRANSFER_TOKEN_ID,
        transferTokenInGTT.toNumber(),
        feePayerClient
      );
    }
  }

  @when(/User treasury transfer amount to GTT contract/, TAG, 30000)
  public async sendTokenToGTTContract() {
    await Common.transferTokens(
      AccountId.fromString(governor.contractId),
      senderAccountId,
      senderAccountPK,
      TRANSFER_TOKEN_ID,
      tokenTransferAmount.toNumber(),
      feePayerClient
    );
  }

  @when(
    /User wait for proposal state to be "([^"]*)" for max (\d*) seconds/,
    TAG,
    60000
  )
  public async waitForState(state: string, seconds: number) {
    await this.waitForProposalState(governor, state, proposalId, seconds);
  }

  @when(/User Associate the transfer token to receiver account/, TAG, 60000)
  public async associateTokenToReceiver() {
    await Common.associateTokensToAccount(
      receiverAccountId,
      [TRANSFER_TOKEN_ID],
      feePayerClient,
      receiverAccountPK
    );
  }

  @when(/User setup (\d+\.?\d*) as allowance for voting/, TAG, 30000)
  public async setAllowanceForTokenLocking(amount: number) {
    tokenLockedAmount = amount * CommonSteps.withPrecision;
    await this.setupAllowanceForTokenLocking(
      ftHolder,
      amount * CommonSteps.withPrecision,
      voterAccountId,
      voterAccountPK,
      voterClient
    );
  }

  @when(/User lock (\d+\.?\d*) GOD tokens for voting/, TAG, 30000)
  public async lockGOD(amount: number) {
    tokenLockedAmount = amount * CommonSteps.withPrecision;
    await this.lockTokens(
      ftHolder,
      tokenLockedAmount,
      voterAccountId,
      voterAccountPK,
      voterClient
    );
  }

  @then(/User verify the locked tokens amount in holder/, TAG, 30000)
  public async verifyLockedTokensAmountInHolderContract() {
    const voterBalance = await ftHolder.balanceOfVoter(
      voterAccountId,
      voterClient
    );
    expect(voterBalance).equals(tokenLockedAmount);
  }

  @when(/User get locked tokens back from holder for GTT/, TAG, 30000)
  public async revertGOD() {
    await this.revertTokens(
      ContractId.fromString(ftHolder.contractId),
      voterAccountId,
      AccountId.fromString(ftHolder.contractId),
      clientsInfo.operatorKey,
      GOD_TOKEN_ID,
      feePayerClient
    );
  }

  @when(/User cancel the proposal with title "([^"]*)"/, TAG, 30000)
  public async cancelProposal(title: string) {
    await governor.cancelProposal(title, proposalCreatorClient);
  }
}
