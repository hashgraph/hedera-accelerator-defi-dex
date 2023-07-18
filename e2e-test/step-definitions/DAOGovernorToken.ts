import { Helper } from "../../utils/Helper";
import {
  AccountId,
  Client,
  ContractId,
  PrivateKey,
  TokenId,
} from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { given, binding, when, then, after } from "cucumber-tsflow/dist";
import dex from "../../deployment/model/dex";
import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";
import FTDAO from "../../e2e-test/business/FTDAO";
import FTDAOFactory from "../../e2e-test/business/factories/FTDAOFactory";
import { expect } from "chai";
import Common from "../business/Common";
import { BigNumber } from "bignumber.js";
import { CommonSteps } from "./CommonSteps";
import FTTokenHolderFactory from "../business/factories/FTTokenHolderFactory";
import TokenTransferGovernor from "../business/TokenTransferGovernor";

const DAO_DESC = "Lorem Ipsum is simply dummy text";
const DAO_WEB_LINKS = ["LINKEDIN", "https://linkedin.com"];
const DEFAULT_LINK = "https://defi-ui.hedera.com/governance";

const csDev = new ContractService();

const ftDaoProxyContractId = csDev.getContractWithProxy(ContractService.FT_DAO)
  .transparentProxyId!;

let ftDao = new FTDAO(ContractId.fromString(ftDaoProxyContractId));

let governorTokenTransfer: Governor;

const godHolderProxyContractId = csDev.getContractWithProxy(
  csDev.godHolderContract
).transparentProxyId!;
let godHolder = new GodHolder(ContractId.fromString(godHolderProxyContractId));

const daoFactoryContract = csDev.getContractWithProxy(
  ContractService.FT_DAO_FACTORY
);
const proxyId = daoFactoryContract.transparentProxyId!;
const daoFactory = new FTDAOFactory(ContractId.fromString(proxyId));

const godTokenHolderFactory = new FTTokenHolderFactory(undefined);
const adminAddress: string = clientsInfo.operatorId.toSolidityAddress();

const toAccount: AccountId = clientsInfo.treasureId;
const fromAccount: AccountId = clientsInfo.operatorId;
const fromAccountPrivateKey: PrivateKey = clientsInfo.operatorKey;
const tokenId: TokenId = TokenId.fromString(dex.TOKEN_LAB49_1);
const daoTokenId: TokenId = TokenId.fromString(dex.GOD_TOKEN_ID);

const proposalCreatorClient: Client = clientsInfo.operatorClient;

let proposalId: string;
let balance: BigNumber;
let tokens: BigNumber;
let errorMsg: string = "";
let daoAddress: any;
let fromAcctBal: BigNumber;
let factoryGODHolderContractId: string;

@binding()
export class DAOGovernorTokenTransfer extends CommonSteps {
  @given(
    /User tries to initialize the DAO governor token contract with name "([^"]*)" and url "([^"]*)"/,
    undefined,
    30000
  )
  public async initializeFail(name: string, url: string) {
    let blankTitleOrURL: boolean = false;
    try {
      if (name === "" || url === "") blankTitleOrURL = true;
      await ftDao.initialize(
        adminAddress,
        name,
        url,
        DAO_DESC,
        DAO_WEB_LINKS,
        godHolder,
        clientsInfo.operatorClient,
        CommonSteps.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
        CommonSteps.DEFAULT_VOTING_DELAY,
        CommonSteps.DEFAULT_VOTING_PERIOD,
        daoTokenId,
        daoTokenId
      );
    } catch (e: any) {
      if (blankTitleOrURL) {
        console.log(
          `DAOGovernorTokenTransfer#initialize() blankTitleOrURL = ${blankTitleOrURL}`
        );
        errorMsg = e.message;
      } else throw e;
    }
  }

  @given(
    /User initialize the DAO governor token contract with name "([^"]*)" and url "([^"]*)"/,
    undefined,
    30000
  )
  public async initializeSafe(name: string, url: string) {
    await Helper.delay(15000); // allowing some delay for propagating initialize event from previous call
    await ftDao.initialize(
      adminAddress,
      name,
      url,
      DAO_DESC,
      DAO_WEB_LINKS,
      godHolder,
      clientsInfo.operatorClient,
      CommonSteps.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
      CommonSteps.DEFAULT_VOTING_DELAY,
      CommonSteps.DEFAULT_VOTING_PERIOD,
      daoTokenId,
      daoTokenId
    );
    await this.updateGovernor(ftDao);
  }

  @given(/User initialize DAO factory contract/, undefined, 60000)
  public async initializeFactory() {
    await godTokenHolderFactory.initialize(clientsInfo.operatorClient);
    const godTokenHolderContractId = await godTokenHolderFactory.getTokenHolder(
      daoTokenId.toSolidityAddress()
    );
    godHolder = new GodHolder(godTokenHolderContractId);
    await daoFactory.initialize(
      clientsInfo.operatorClient,
      godTokenHolderFactory
    );
  }

  @when(
    /User create a DAO with name "([^"]*)" and url "([^"]*)"/,
    undefined,
    30000
  )
  public async createDAO(daoName: string, daoURL: string) {
    let blankNameOrURL: boolean = false;
    if (daoName === "" || daoURL === "") blankNameOrURL = true;
    try {
      daoAddress = await daoFactory.createDAO(
        daoName,
        daoURL,
        DAO_DESC,
        DAO_WEB_LINKS,
        daoTokenId.toSolidityAddress(),
        CommonSteps.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
        CommonSteps.DEFAULT_VOTING_DELAY,
        CommonSteps.DEFAULT_VOTING_PERIOD,
        false,
        adminAddress,
        clientsInfo.operatorClient
      );
    } catch (e: any) {
      if (blankNameOrURL) {
        console.log(
          `DAOGovernorTokenTransfer#createDAO() blankNameOrURL = ${blankNameOrURL}`
        );
        errorMsg = e.message;
      } else throw e;
    }
  }

  @when(
    /User initialize the governor token dao and governor token transfer and god holder contract via dao factory/,
    undefined,
    30000
  )
  public async initializeContractsViaFactory() {
    ftDao = daoFactory.getGovernorTokenDaoInstance(daoAddress);
    await this.updateGovernor(ftDao);
    factoryGODHolderContractId = godHolder.contractId;
  }

  @when(
    /User create a new token transfer proposal with title "([^"]*)" and token amount (-?\d+) with the help of DAO/,
    undefined,
    30000
  )
  public async createTokenTransferProposal(title: string, tokenAmount: number) {
    let negativeAmt: boolean = false;
    if (tokenAmount < 0) negativeAmt = true;
    console.log(
      `value of negativeAmt ${negativeAmt} and tokenAmt is ${tokenAmount}`
    );
    tokens = new BigNumber(tokenAmount * CommonSteps.withPrecision);
    try {
      proposalId = await ftDao.createTokenTransferProposal(
        title,
        fromAccount.toSolidityAddress(),
        toAccount.toSolidityAddress(),
        tokenId.toSolidityAddress(),
        tokenAmount * CommonSteps.withPrecision,
        proposalCreatorClient
      );
    } catch (e: any) {
      if (negativeAmt) {
        errorMsg = e.message;
      } else {
        console.log(e);
        throw e;
      }
    }
  }

  @then(
    /User verify that proposal is not created and user receives error message "([^"]*)"/,
    undefined,
    30000
  )
  public async verifyProposalIsNotCreatedAndErrorMessage(msg: string) {
    expect(errorMsg).contains(msg);
    expect(proposalId).to.be.undefined;
    errorMsg = "";
  }

  @when(
    /User wait for token transfer proposal state to be "([^"]*)" for maximum (\d*) seconds/,
    undefined,
    60000
  )
  public async waitForState(state: string, seconds: number) {
    await this.waitForProposalState(
      governorTokenTransfer,
      state,
      proposalId,
      seconds
    );
  }

  @when(
    /User cancel token transfer proposal with title "([^"]*)"/,
    undefined,
    30000
  )
  public async cancelProposal(title: string) {
    await governorTokenTransfer.cancelProposal(
      title,
      clientsInfo.operatorClient
    );
  }
  @then(
    /User verify token transfer proposal state is "([^"]*)"/,
    undefined,
    30000
  )
  public async verifyProposalState(proposalState: string): Promise<void> {
    const { currentState, proposalStateNumeric } = await this.getProposalState(
      governorTokenTransfer,
      proposalId,
      clientsInfo.operatorClient,
      proposalState
    );
    expect(Number(currentState)).to.eql(proposalStateNumeric);
  }

  @when(/User vote "([^"]*)" token transfer proposal/, undefined, 60000)
  public async voteToProposal(vote: string): Promise<void> {
    await this.vote(
      governorTokenTransfer,
      vote,
      proposalId,
      clientsInfo.operatorClient
    );
  }

  @when(
    /User execute token transfer proposal with title "([^"]*)"/,
    undefined,
    30000
  )
  public async execute(title: string) {
    await this.executeProposal(
      governorTokenTransfer,
      title,
      clientsInfo.operatorKey,
      clientsInfo.operatorClient
    );
  }

  @when(
    /User fetches target token balance of account to which user wants to transfer/,
    undefined,
    30000
  )
  public async getTokenBalance() {
    balance = await Common.getTokenBalance(toAccount, tokenId);
    console.log(
      `DAOGovernorTokenTransfer#getTokenBalance() balance = ${balance}`
    );
  }

  @then(
    /User checks that target token balance in the payer account is more than transfer amount (\d+\.?\d*)/,
    undefined,
    30000
  )
  public async verifyTokenBalanceIsGreaterThanTransferAmt(transferAmt: number) {
    fromAcctBal = await Common.getTokenBalance(fromAccount, tokenId);
    expect(
      Number(fromAcctBal.dividedBy(CommonSteps.withPrecision))
    ).greaterThan(Number(transferAmt));
  }

  @then(
    /User verify target token is transferred to payee account/,
    undefined,
    30000
  )
  public async verifyTokenBalance() {
    const updatedBalance = await Common.getTokenBalance(toAccount, tokenId);
    expect(updatedBalance).to.eql(balance.plus(tokens));
  }

  @when(
    /User create a new token transfer proposal with title "([^"]*)" and token amount higher than current balance/
  )
  public async createTokenTransferProposalWithHigherAmt(title: string) {
    const amt = Number(
      fromAcctBal.plus(new BigNumber(1 * CommonSteps.withPrecision))
    );
    console.log(
      `DAOGovernorTokenTransfer#createTokenTransferProposalWithHigherAmt() transfer amount  = ${amt}`
    );
    proposalId = await ftDao.createTokenTransferProposal(
      title,
      fromAccount.toSolidityAddress(),
      toAccount.toSolidityAddress(),
      tokenId.toSolidityAddress(),
      amt,
      proposalCreatorClient
    );
  }

  @when(
    /User tries to execute token transfer proposal with title "([^"]*)"/,
    undefined,
    30000
  )
  public async executeProposalWithHigherAmt(title: string) {
    try {
      await governorTokenTransfer.executeProposal(
        title,
        clientsInfo.operatorKey,
        clientsInfo.operatorClient
      );
    } catch (e: any) {
      errorMsg = e.message;
    }
  }

  @then(/User verify user receives error message "([^"]*)"/, undefined, 30000)
  public async verifyErrorMessage(msg: string) {
    expect(errorMsg).contains(msg);
    errorMsg = "";
  }

  @when(/User get GOD tokens back from GOD holder/, undefined, 30000)
  public async revertGOD() {
    await this.revertTokens(
      ContractId.fromString(godHolderProxyContractId),
      clientsInfo.operatorId,
      AccountId.fromString(godHolderProxyContractId),
      clientsInfo.operatorKey,
      TokenId.fromString(dex.GOD_TOKEN_ID),
      clientsInfo.operatorClient
    );
  }

  @when(
    /User lock (\d+\.?\d*) GOD token before voting to token transfer proposal/,
    undefined,
    30000
  )
  public async lockGOD(tokenAmt: number) {
    await this.lockTokens(
      godHolder,
      tokenAmt * CommonSteps.withPrecision,
      clientsInfo.operatorId,
      clientsInfo.operatorKey,
      clientsInfo.operatorClient
    );
  }

  @when(
    /User receive GOD tokens back from GOD holder created via DAO factory/,
    undefined,
    30000
  )
  public async getGODTokensBack() {
    await this.revertTokens(
      ContractId.fromString(factoryGODHolderContractId),
      clientsInfo.operatorId,
      AccountId.fromString(factoryGODHolderContractId),
      clientsInfo.operatorKey,
      TokenId.fromString(dex.GOD_TOKEN_ID),
      clientsInfo.operatorClient
    );
  }

  @when(
    /User set (\d+\.?\d*) as allowance amount for token locking for transfer token proposal via DAO/,
    undefined,
    30000
  )
  public async setAllowanceForTokenLocking(allowanceAmt: number) {
    await this.setupAllowanceForTokenLocking(
      godHolder,
      allowanceAmt * CommonSteps.withPrecision,
      clientsInfo.operatorId,
      clientsInfo.operatorKey,
      clientsInfo.operatorClient
    );
  }

  @when(
    /User set default allowance for token transfer proposal creation via DAO/,
    undefined,
    30000
  )
  public async setAllowanceForProposalCreation() {
    console.log(
      `\n governorTokenTransfer contractId ${governorTokenTransfer.contractId} \n`
    );
    await this.setupAllowanceForProposalCreation(
      governorTokenTransfer,
      clientsInfo.operatorClient,
      clientsInfo.operatorId,
      clientsInfo.operatorKey
    );
  }

  @when(
    /User set (\d+\.?\d*) as allowance amount of token which needs to be transferred via DAO/,
    undefined,
    30000
  )
  public async setAllowanceForTransferToken(allowanceAmt: number) {
    await this.setupAllowanceForToken(
      governorTokenTransfer,
      tokenId,
      allowanceAmt * CommonSteps.withPrecision,
      governorTokenTransfer.contractId,
      clientsInfo.operatorId,
      clientsInfo.operatorKey,
      clientsInfo.operatorClient
    );
  }
  private async updateGovernor(dao: FTDAO) {
    const governorAddresses =
      await dao.getGovernorTokenTransferContractAddresses();
    governorTokenTransfer = new TokenTransferGovernor(
      governorAddresses.governorTokenTransferProxyId
    );
  }
}
