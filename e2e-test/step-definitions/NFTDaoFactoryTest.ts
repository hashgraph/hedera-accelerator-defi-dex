import dex from "../../deployment/model/dex";
import FTDAO from "../business/FTDAO";
import Common from "../business/Common";
import NFTHolder from "../business/NFTHolder";
import NFTDAOFactory from "../business/factories/NFTDAOFactory";
import NFTTokenHolderFactory from "../business/factories/NFTTokenHolderFactory";
import TokenTransferGovernor from "../business/TokenTransferGovernor";

import { expect } from "chai";
import { ethers } from "ethers";
import { BigNumber } from "bignumber.js";
import { CommonSteps } from "./CommonSteps";
import { clientsInfo } from "../../utils/ClientManagement";
import { AddressHelper } from "../../utils/AddressHelper";
import { binding, given, then, when } from "cucumber-tsflow";
import { TokenId, ContractId, AccountId } from "@hashgraph/sdk";

const NFT_TOKEN_ID = dex.E2E_NFT_TOKEN_ID;
const TRANSFER_TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);

const DAO_DESC = "Lorem Ipsum is simply dummy text";
const DAO_WEB_LINKS = ["LINKEDIN", "https://linkedin.com"];
const DAO_ADMIN_CLIENT = clientsInfo.operatorClient;
const DAO_ADMIN_ADDRESS: string = clientsInfo.operatorId.toSolidityAddress();

const senderAccountId = clientsInfo.operatorId;
const senderAccountPK = clientsInfo.operatorKey;

const voterAccountId = clientsInfo.operatorId;
const voterAccountPK = clientsInfo.operatorKey;
const voterClient = clientsInfo.operatorClient;

const proposalCreatorAccountId = clientsInfo.operatorId;
const proposalCreatorAccountPK = clientsInfo.operatorKey;
const proposalCreatorClient = clientsInfo.operatorClient;

const receiverAccountId = clientsInfo.uiUserId;
const receiverAccountPK = clientsInfo.uiUserKey;

const feePayerClient = clientsInfo.operatorClient;

let proposalId: string;
let contractBalanceBeforeTransfer: BigNumber;
let tokenTransferAmount: BigNumber;
let errorMessage: string;
let daoAddress: string;
let tokenLockedAmount: number;

let ftDao: FTDAO;
let nftHolder: NFTHolder;
let governor: TokenTransferGovernor;
let nftDaoFactory: NFTDAOFactory;
let nftTokenHolderFactory: NFTTokenHolderFactory;

@binding()
export class NFTDaoFactoryTest extends CommonSteps {
  @when(/User deploy the following contracts "([^"]*)"/, undefined, 60000)
  public async deployTheContract(contracts: string) {
    await this.deploy(contracts);
  }

  @given(/User gets the instances of deployed contracts/, undefined, 60000)
  public async initialize(): Promise<void> {
    nftTokenHolderFactory = new NFTTokenHolderFactory();
    await nftTokenHolderFactory.initialize();

    nftDaoFactory = new NFTDAOFactory();
    await nftDaoFactory.initialize(
      clientsInfo.operatorClient,
      nftTokenHolderFactory
    );

    console.log(
      "*******************Starting nft dao governor test with following credentials*******************"
    );
    console.log("NFTDAOFactory contract-id:", nftDaoFactory.contractId);
    console.log(
      "NFTHolderFactory contract-id:",
      nftTokenHolderFactory.contractId
    );
    console.log("Sender Id :", senderAccountId.toString());
    console.log("Receiver Id :", receiverAccountId.toString());
    console.log("DAO Token Id :", NFT_TOKEN_ID.toString());
    console.log("");
  }

  @when(
    /User create a NFT DAO with name "([^"]*)" and url "([^"]*)"/,
    undefined,
    70000
  )
  public async createDAO(daoName: string, daoURL: string) {
    const isDaoNameBlank = daoName.trim().length === 0;
    try {
      daoAddress = await nftDaoFactory.createDAO(
        daoName,
        daoURL,
        DAO_DESC,
        DAO_WEB_LINKS,
        NFT_TOKEN_ID.toSolidityAddress(),
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
        `NFTDao#createDAO(): dao-name = ${daoName}, isNameBlank = ${isDaoNameBlank}`
      );
      if (isDaoNameBlank) errorMessage = e.message;
      else throw e;
    }
  }

  @then(
    /User verify that created NFT DAO address is available/,
    undefined,
    30000
  )
  public async verifyDAOAddressIsAvailable() {
    expect(ethers.utils.isAddress(daoAddress)).equals(true);
  }

  @when(
    /User creates the token association proposal with title "([^"]*)"/,
    undefined,
    30000
  )
  public async createTokenAssociateProposal(title: string): Promise<void> {
    proposalId = await governor.createTokenAssociateProposal(
      title,
      TRANSFER_TOKEN_ID.toSolidityAddress(),
      feePayerClient,
      governor.DEFAULT_DESCRIPTION,
      governor.DEFAULT_LINK,
      governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
      proposalCreatorAccountId.toSolidityAddress()
    );
  }

  @when(
    /User creates token transfer proposal with title "([^"]*)" description "([^"]*)" link "([^"]*)" and token amount (\d*)/,
    undefined,
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

  @then(/User verify nft proposal state is "([^"]*)"/, undefined, 30000)
  public async verifyProposalState(proposalState: string): Promise<void> {
    const { currentState, proposalStateNumeric } = await this.getProposalState(
      governor,
      proposalId,
      voterClient,
      proposalState
    );
    expect(Number(currentState)).to.eql(proposalStateNumeric);
  }

  @then(/User receive the error message "([^"]*)"/, undefined, 30000)
  public async verifyErrorMsg(message: string): Promise<void> {
    expect(errorMessage).contains(message);
  }

  @when(/User executes proposal with title "([^"]*)"/, undefined, 30000)
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

  @when(/User given vote "([^"]*)" proposal/, undefined, 30000)
  public async voteToProposal(vote: string): Promise<void> {
    await this.vote(governor, vote, proposalId, voterClient);
  }

  @when(/User set nft allowance for GTT proposals/, undefined, 30000)
  public async setAllowanceForProposalCreation() {
    await this.setupNFTAllowanceForProposalCreation(
      governor,
      proposalCreatorClient,
      proposalCreatorAccountId,
      proposalCreatorAccountPK
    );
  }

  @when(/User reset the default allowance for GTT proposals/, undefined, 30000)
  public async resetAllowanceForProposalCreation() {}

  @when(/User get the token balance from GTT contract/, undefined, 30000)
  public async getTokenBalanceFromContract() {
    contractBalanceBeforeTransfer = await Common.getTokenBalance(
      ContractId.fromString(governor.contractId),
      TRANSFER_TOKEN_ID
    );
  }

  @then(
    /User verify proposed token amount is transferred from GTT contract/,
    undefined,
    30000
  )
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

  @when(/User transfer proposed amount to GTT contract/, undefined, 30000)
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
    /User waits for the proposal state to be "([^"]*)" for max (\d*) seconds/,
    undefined,
    60000
  )
  public async waitForState(state: string, seconds: number) {
    await this.waitForProposalState(governor, state, proposalId, seconds);
  }

  @when(/User setup nft-token allowance for voting/, undefined, 30000)
  public async setAllowanceForTokenLocking() {
    await this.setupAllowanceForNFTToken(
      nftHolder,
      voterAccountId,
      voterAccountPK,
      voterClient
    );
  }

  @when(
    /User lock nft-token serial no (\d+\.?\d*) for the voting/,
    undefined,
    30000
  )
  public async lockNFTTokenForVoting(serialNo: number) {
    tokenLockedAmount = serialNo;
    await this.grabNFTTokensForAllowance(
      nftHolder,
      serialNo,
      voterAccountId,
      voterAccountPK,
      voterClient
    );
  }

  @then(/User verify locked nft-token count in holder/, undefined, 30000)
  public async verifyLockedTokensAmountInHolderContract() {
    const voterBalance = await nftHolder.balanceOfVoter(
      voterAccountId,
      voterClient
    );
    expect(voterBalance).equals(1);
  }

  @when(/User associate token to receiver account/, undefined, 60000)
  public async associateTokenToReceiver() {
    await Common.associateTokensToAccount(
      receiverAccountId,
      [TRANSFER_TOKEN_ID],
      feePayerClient,
      receiverAccountPK
    );
  }

  @when(
    /User get the locked nft-token serial no back from holder/,
    undefined,
    30000
  )
  public async revertGOD() {
    const evmAddress = await AddressHelper.idToEvmAddress(nftHolder.contractId);
    await this.revertNFTs(
      evmAddress,
      clientsInfo.operatorKey,
      senderAccountId,
      NFT_TOKEN_ID,
      tokenLockedAmount,
      feePayerClient
    );
  }

  @when(/User reset nft allowance from contracts/, undefined, 30000)
  public async userResetNftAllowance() {
    // 1 - reset for governance
    await Common.deleteTokenNftAllowanceAllSerials(
      NFT_TOKEN_ID,
      governor.contractId,
      clientsInfo.operatorId,
      clientsInfo.operatorKey,
      feePayerClient
    );

    // 2 - reset for token-holder
    await Common.deleteTokenNftAllowanceAllSerials(
      NFT_TOKEN_ID,
      nftHolder.contractId,
      clientsInfo.operatorId,
      clientsInfo.operatorKey,
      feePayerClient
    );
  }

  @when(/User get the locked assets back from GTT/, undefined, 30000)
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

  private async initDAOContext() {
    ftDao = await nftDaoFactory.getGovernorTokenDaoInstance(daoAddress);
    const items = await ftDao.getGovernorTokenTransferContractAddresses();
    governor = new TokenTransferGovernor(items.governorTokenTransferProxyId);
    nftHolder = await nftDaoFactory.getTokenHolderInstance(NFT_TOKEN_ID);
  }
}
