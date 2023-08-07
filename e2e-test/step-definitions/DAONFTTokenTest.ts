import { Helper } from "../../utils/Helper";
import {
  AccountId,
  Client,
  PrivateKey,
  TokenId,
  ContractId,
} from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { expect } from "chai";
import { binding, given, then, when } from "cucumber-tsflow";

import dex from "../../deployment/model/dex";
import Governor from "../../e2e-test/business/Governor";
import NFTHolder from "../../e2e-test/business/NFTHolder";
import FTDAO from "../../e2e-test/business/FTDAO";
import * as GovernorTokenMetaData from "../../e2e-test/business/FTDAO";
import { CommonSteps } from "./CommonSteps";
import Common from "../business/Common";
import { BigNumber } from "bignumber.js";
import TokenTransferGovernor from "../business/TokenTransferGovernor";
import { AddressHelper } from "../../utils/AddressHelper";

const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const adminAddress: string = clientsInfo.operatorId.toSolidityAddress();
const DAO_DESC = "Lorem Ipsum is simply dummy text";
const DAO_WEB_LINKS = ["LINKEDIN", "https://linkedin.com"];
const PROPOSAL_CREATE_SERIAL_ID = 12;

let ftDao: FTDAO;
let governorTT: Governor;
let nftHolder: NFTHolder;
let errorMsg: string;
let proposalId: string;
let balance: BigNumber;
let fromAcctBal: BigNumber;
let tokens: number;

@binding()
export class DAONFTTokenTest extends CommonSteps {
  @given(
    /User initialize the NFT DAO with name "([^"]*)" and url "([^"]*)"/,
    undefined,
    60000
  )
  public async initializeNFTDAOSafe(name: string, url: string) {
    await Helper.delay(15000); // allowing some delay for propagating initialize event from previous call
    await ftDao.initialize(
      adminAddress,
      name,
      url,
      DAO_DESC,
      DAO_WEB_LINKS,
      nftHolder,
      clientsInfo.operatorClient,
      CommonSteps.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
      CommonSteps.DEFAULT_VOTING_DELAY,
      CommonSteps.DEFAULT_VOTING_PERIOD,
      dex.E2E_NFT_TOKEN_ID,
      dex.E2E_NFT_TOKEN_ID
    );
    await this.updateGovernor(ftDao);
  }

  @given(
    /User tries to initialize the NFT DAO with name "([^"]*)" and url "([^"]*)"/,
    undefined,
    30000
  )
  public async initializeNFTDAOFail(name: string, url: string) {
    try {
      await ftDao.initialize(
        adminAddress,
        name,
        url,
        DAO_DESC,
        DAO_WEB_LINKS,
        nftHolder,
        clientsInfo.operatorClient,
        CommonSteps.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
        CommonSteps.DEFAULT_VOTING_DELAY,
        CommonSteps.DEFAULT_VOTING_PERIOD,
        dex.E2E_NFT_TOKEN_ID,
        dex.E2E_NFT_TOKEN_ID
      );
    } catch (e: any) {
      console.log("expected error while initializing NFTDAO");
      errorMsg = e.message;
    }
  }

  @then(/User receive the error message "([^"]*)"/, undefined, 60000)
  public async verifyErrorMessage(msg: string) {
    expect(errorMsg).contains(msg);
    errorMsg = "";
  }

  @when(/User setup allowance for NFT Token/, undefined, 30000)
  public async setupAllowanceNFTHolder() {
    await this.setupAllowanceForNFTToken(
      nftHolder,
      clientsInfo.operatorId,
      clientsInfo.operatorKey,
      clientsInfo.operatorClient
    );
  }

  @when(/User locks NFT token with serial number (\d+\.?\d*)/, undefined, 30000)
  public async grabNFT(serialNumber: number) {
    await this.grabNFTTokensForAllowance(
      nftHolder,
      serialNumber,
      clientsInfo.operatorId,
      clientsInfo.operatorKey,
      clientsInfo.operatorClient
    );
  }

  @when(/User setup allowance for proposal creation/, undefined, 30000)
  public async setupAllowance() {
    await this.setupNFTAllowanceForProposalCreation(
      governorTT,
      clientsInfo.operatorClient,
      clientsInfo.operatorId,
      clientsInfo.operatorKey
    );
  }

  @when(
    /User create token transfer proposal with title "([^"]*)" and token amount as (\d*)/,
    undefined,
    60000
  )
  public async createProposal(title: string, tokenAmt: number) {
    tokens = tokenAmt * CommonSteps.withPrecision;
    proposalId = await ftDao.createTokenTransferProposal(
      title,
      clientsInfo.treasureId.toSolidityAddress(),
      clientsInfo.operatorId.toSolidityAddress(),
      TOKEN_ID.toSolidityAddress(),
      tokens,
      clientsInfo.operatorClient,
      GovernorTokenMetaData.DEFAULT_LINK,
      GovernorTokenMetaData.DEFAULT_DESCRIPTION,
      PROPOSAL_CREATE_SERIAL_ID
    );
  }

  @when(
    /User create token transfer proposal with title "([^"]*)" and token amount greater than current balance in payer account/,
    undefined,
    60000
  )
  public async createProposalWithHigherAmt(title: string) {
    const amt = Number(
      fromAcctBal.plus(new BigNumber(1 * CommonSteps.withPrecision))
    );
    proposalId = await ftDao.createTokenTransferProposal(
      title,
      clientsInfo.treasureId.toSolidityAddress(),
      clientsInfo.operatorId.toSolidityAddress(),
      TOKEN_ID.toSolidityAddress(),
      amt,
      clientsInfo.operatorClient,
      GovernorTokenMetaData.DEFAULT_LINK,
      GovernorTokenMetaData.DEFAULT_DESCRIPTION,
      PROPOSAL_CREATE_SERIAL_ID
    );
  }

  @when(
    /User tries to create token transfer proposal with title "([^"]*)" and token amount as (-?\d+)/
  )
  public async createProposalFail(title: string, tokenAmt: number) {
    try {
      proposalId = await ftDao.createTokenTransferProposal(
        title,
        clientsInfo.treasureId.toSolidityAddress(),
        clientsInfo.operatorId.toSolidityAddress(),
        TOKEN_ID.toSolidityAddress(),
        tokenAmt * CommonSteps.withPrecision,
        clientsInfo.operatorClient,
        GovernorTokenMetaData.DEFAULT_LINK,
        GovernorTokenMetaData.DEFAULT_DESCRIPTION,
        PROPOSAL_CREATE_SERIAL_ID
      );
    } catch (e: any) {
      errorMsg = e.message;
      console.log(errorMsg);
    }
  }

  @when(
    /User wait for "([^"]*)" state of token transfer proposal for maximum (\d*) seconds/,
    undefined,
    60000
  )
  public async waitForExpectedState(state: string, seconds: number) {
    await this.waitForProposalState(governorTT, state, proposalId, seconds);
  }

  @when(/User cast vote "([^"]*)" proposal/, undefined, 60000)
  public async voteToProposal(vote: string): Promise<void> {
    await this.vote(governorTT, vote, proposalId, clientsInfo.operatorClient);
  }

  @then(
    /User checks token transfer proposal state is "([^"]*)"/,
    undefined,
    30000
  )
  public async verifyProposalState(proposalState: string): Promise<void> {
    const { currentState, proposalStateNumeric } = await this.getProposalState(
      governorTT,
      proposalId,
      clientsInfo.operatorClient,
      proposalState
    );
    expect(Number(currentState)).to.eql(proposalStateNumeric);
  }

  @when(/User executes proposal with title "([^"]*)"/, undefined, 30000)
  public async execute(title: string) {
    await this.executeProposal(
      governorTT,
      title,
      clientsInfo.treasureKey,
      clientsInfo.treasureClient
    );
  }

  @when(/User tries to execute proposal with title "([^"]*)"/, undefined, 30000)
  public async executeProposalWithHigherAmt(title: string) {
    try {
      await this.executeProposal(
        governorTT,
        title,
        clientsInfo.treasureKey,
        clientsInfo.treasureClient
      );
    } catch (e: any) {
      errorMsg = e.message;
    }
  }

  @when(/User deploy the following contracts "([^"]*)"/, undefined, 120000)
  public async deployTheContract(contractNames: string) {
    const contracts = contractNames.split(",");
    await this.deployGivenContract(contracts);
  }

  @when(/User gets the instances of deployed contracts/, undefined, 60000)
  public async getInstances() {
    const csDev = new ContractService();

    const tokenTransferDAOProxyContractId = csDev.getContractWithProxy(
      ContractService.FT_DAO
    ).transparentProxyId!;

    ftDao = new FTDAO(ContractId.fromString(tokenTransferDAOProxyContractId));

    const nftHolderProxyContractId = csDev.getContractWithProxy(
      csDev.nftHolderContract
    ).transparentProxyId!;
    nftHolder = new NFTHolder(ContractId.fromString(nftHolderProxyContractId));

    console.log(
      "*******************Starting DAO NFT test with following*******************"
    );
    console.log(
      "tokenTransferDAOProxyContractId : ",
      tokenTransferDAOProxyContractId
    );
    console.log("nftHolderProxyContractId : ", nftHolderProxyContractId);
  }

  @when(/User setup allowance as (\d*) for token transfer/, undefined, 30000)
  public async setupAllowanceForTT(allowance: number) {
    await this.setupAllowanceForToken(
      governorTT,
      TOKEN_ID,
      allowance * CommonSteps.withPrecision,
      governorTT.contractId,
      clientsInfo.treasureId,
      clientsInfo.treasureKey,
      clientsInfo.treasureClient
    );
  }

  @when(
    /User tries to setup allowance as (-?\d+) for token transfer/,
    undefined,
    30000
  )
  public async setupNegativeAllowanceForTT(allowance: number) {
    try {
      await this.setupAllowanceForToken(
        governorTT,
        TOKEN_ID,
        allowance * CommonSteps.withPrecision,
        governorTT.contractId,
        clientsInfo.treasureId,
        clientsInfo.treasureKey,
        clientsInfo.treasureClient
      );
    } catch (e: any) {
      errorMsg = e.message;
    }
  }

  @when(/User claim NFT token with serial number (\d+\.?\d*)/, undefined, 30000)
  public async claimNFTs(tokenSerialNumber: number) {
    const evmAddress = await AddressHelper.idToEvmAddress(nftHolder.contractId);
    await this.revertNFTs(
      evmAddress,
      clientsInfo.operatorKey,
      clientsInfo.operatorId,
      dex.E2E_NFT_TOKEN_ID,
      tokenSerialNumber,
      clientsInfo.operatorClient
    );
  }

  @when(
    /User fetches balance of target token from account to which user wants to transfer/,
    undefined,
    30000
  )
  public async getTokenBalance() {
    balance = await Common.getTokenBalance(clientsInfo.operatorId, TOKEN_ID);
    console.log(`DAONFTTokenTest#getTokenBalance() balance = ${balance}`);
  }

  @then(
    /User verifies target token balance in the payer account is more than transfer amount (\d+\.?\d*)/,
    undefined,
    30000
  )
  public async verifyTokenBalanceIsGreaterThanTransferAmt(transferAmt: number) {
    fromAcctBal = await Common.getTokenBalance(
      clientsInfo.treasureId,
      TOKEN_ID
    );
    expect(
      Number(fromAcctBal.dividedBy(CommonSteps.withPrecision))
    ).greaterThan(Number(transferAmt));
  }

  @then(
    /User confirms target token is transferred to payee account/,
    undefined,
    30000
  )
  public async verifyTokenBalance() {
    const updatedBalance = await Common.getTokenBalance(
      clientsInfo.operatorId,
      TOKEN_ID
    );
    expect(updatedBalance).to.eql(balance.plus(tokens));
  }

  @when(
    /User cancel the token transfer proposal with title "([^"]*)"/,
    undefined,
    30000
  )
  public async cancelProposal(title: string) {
    await governorTT.cancelProposal(title, clientsInfo.operatorClient);
  }

  private async updateGovernor(dao: FTDAO) {
    const governorAddresses =
      await dao.getGovernorTokenTransferContractAddresses();
    governorTT = new TokenTransferGovernor(
      governorAddresses.governorTokenTransferProxyId
    );
  }
}
