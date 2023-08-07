import dex from "../../deployment/model/dex";
import FTDAO from "../business/FTDAO";
import Common from "../business/Common";
import GodHolder from "../business/GodHolder";
import FTDAOFactory from "../business/factories/FTDAOFactory";
import TokenTransferGovernor from "../business/TokenTransferGovernor";
import FTTokenHolderFactory from "../business/factories/FTTokenHolderFactory";

import { ethers } from "ethers";
import { expect } from "chai";
import { BigNumber } from "bignumber.js";
import { CommonSteps } from "./CommonSteps";
import { clientsInfo } from "../../utils/ClientManagement";
import { given, binding, when, then } from "cucumber-tsflow/dist";
import { AccountId, ContractId, TokenId } from "@hashgraph/sdk";

const TAG = "FTDao";
const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
const TRANSFER_TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);

const DAO_DESC = "Lorem Ipsum is simply dummy text";
const DAO_WEB_LINKS = ["https://linkedin.com"];
const DAO_ADMIN_CLIENT = clientsInfo.operatorClient;
const DAO_ADMIN_ADDRESS = clientsInfo.operatorId.toSolidityAddress();

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

let proposalId: string;
let contractBalanceBeforeTransfer: BigNumber;
let tokenTransferAmount: BigNumber;
let errorMessage: string = "";
let daoAddress: any;
let tokenLockedAmount: number;

let ftDao: FTDAO;
let ftHolder: GodHolder;
let governor: TokenTransferGovernor;
let ftDaoFactory: FTDAOFactory;
let ftTokenHolderFactory: FTTokenHolderFactory;

@binding()
export class FTDaoFactoryTest extends CommonSteps {
  @given(/User deploy the contracts "([^"]*)"/, TAG, 60000)
  public async deployContracts(contracts: string): Promise<void> {
    await this.deploy(contracts);
  }

  @given(/User have to initialized the contracts/, TAG, 60000)
  public async initialize(): Promise<void> {
    ftTokenHolderFactory = new FTTokenHolderFactory();
    await ftTokenHolderFactory.initialize();

    ftDaoFactory = new FTDAOFactory();
    await ftDaoFactory.initialize(
      clientsInfo.operatorClient,
      ftTokenHolderFactory
    );

    console.log(
      "*******************Starting dao governor transfer token test with following credentials*******************"
    );
    console.log("FTDAOFactory contract-id:", ftDaoFactory.contractId);
    console.log(
      "FTHolderFactory contract-id:",
      ftTokenHolderFactory.contractId
    );
    console.log("Sender Id :", senderAccountId.toString());
    console.log("Receiver Id :", receiverAccountId.toString());
    console.log("DAO Token Id :", GOD_TOKEN_ID.toString());
    console.log("");
  }

  @when(/User create a DAO with name "([^"]*)" and url "([^"]*)"/, TAG, 70000)
  public async createDAO(daoName: string, daoURL: string) {
    const isDaoNameBlank = daoName.trim().length === 0;
    try {
      daoAddress = await ftDaoFactory.createDAO(
        daoName,
        daoURL,
        DAO_DESC,
        DAO_WEB_LINKS,
        GOD_TOKEN_ID.toSolidityAddress(),
        CommonSteps.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
        CommonSteps.DEFAULT_VOTING_DELAY,
        CommonSteps.DEFAULT_VOTING_PERIOD,
        false,
        DAO_ADMIN_ADDRESS,
        DAO_ADMIN_CLIENT
      );
      await this.initDAOContext();
    } catch (e: any) {
      console.log(
        `FTDao#createDAO(): dao-name = ${daoName}, isNameBlank = ${isDaoNameBlank}`
      );
      if (isDaoNameBlank) errorMessage = e.message;
      else throw e;
    }
  }

  @then(/User verify that created dao address is available/, TAG, 30000)
  public async verifyDAOAddressIsAvailable() {
    expect(ethers.utils.isAddress(daoAddress)).equals(true);
  }

  @when(
    /User create token association proposal with title "([^"]*)", description "([^"]*)", link "([^"]*)"/,
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

  @when(
    /User create token transfer proposal with title "([^"]*)" description "([^"]*)" link "([^"]*)" and token amount (\d*)/,
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

  @then(/User verify the proposal state is "([^"]*)"/, TAG, 30000)
  public async verifyProposalState(proposalState: string): Promise<void> {
    const { currentState, proposalStateNumeric } = await this.getProposalState(
      governor,
      proposalId,
      voterClient,
      proposalState
    );
    expect(Number(currentState)).to.eql(proposalStateNumeric);
  }

  @then(/User gets the message "([^"]*)"/, TAG, 30000)
  public async verifyErrorMsg(message: string): Promise<void> {
    expect(errorMessage).contains(message);
  }

  @when(/User execute proposal with title "([^"]*)"/, TAG, 30000)
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

  @when(/User voted "([^"]*)" proposal/, TAG, 30000)
  public async voteToProposal(vote: string): Promise<void> {
    await this.vote(governor, vote, proposalId, voterClient);
  }

  @when(/User setup the default allowance for GTT proposals/, TAG, 30000)
  public async setAllowanceForProposalCreation() {
    await this.setupAllowanceForProposalCreation(
      governor,
      proposalCreatorClient,
      proposalCreatorAccountId,
      proposalCreatorAccountPK
    );
  }

  @when(/User reset the default allowance for GTT proposals/, TAG, 30000)
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

  @when(/User fetch token balance from GTT contract/, TAG, 30000)
  public async getTokenBalanceFromContract() {
    contractBalanceBeforeTransfer = await Common.getTokenBalance(
      ContractId.fromString(governor.contractId),
      TRANSFER_TOKEN_ID
    );
  }

  @then(/User verify token is transferred from GTT contract/, TAG, 30000)
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

  @when(/User get the assets back from GTT/, TAG, 30000)
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

  @when(/User transfer amount to GTT contract/, TAG, 30000)
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
    /User wait for the proposal state to be "([^"]*)" for max (\d*) seconds/,
    TAG,
    60000
  )
  public async waitForState(state: string, seconds: number) {
    await this.waitForProposalState(governor, state, proposalId, seconds);
  }

  @when(/User Associate transfer token to receiver account/, TAG, 60000)
  public async associateTokenToReceiver() {
    await Common.associateTokensToAccount(
      receiverAccountId,
      [TRANSFER_TOKEN_ID],
      feePayerClient,
      receiverAccountPK
    );
  }

  @when(/User setup (\d+\.?\d*) as the allowance for voting/, TAG, 30000)
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

  @when(/User lock (\d+\.?\d*) GOD tokens for the voting/, TAG, 30000)
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

  @then(/User verify locked tokens amount in holder/, TAG, 30000)
  public async verifyLockedTokensAmountInHolderContract() {
    const voterBalance = await ftHolder.balanceOfVoter(
      voterAccountId,
      voterClient
    );
    expect(voterBalance).equals(tokenLockedAmount);
  }

  @when(/User get the locked tokens back from holder for GTT/, TAG, 30000)
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

  private async initDAOContext() {
    ftDao = await ftDaoFactory.getGovernorTokenDaoInstance(daoAddress);
    const items = await ftDao.getGovernorTokenTransferContractAddresses();
    governor = new TokenTransferGovernor(items.governorTokenTransferProxyId);
    ftHolder = await ftDaoFactory.getTokenHolderInstance(GOD_TOKEN_ID);
  }
}
