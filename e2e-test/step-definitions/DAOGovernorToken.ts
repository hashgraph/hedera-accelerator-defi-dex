import { Helper } from "../../utils/Helper";
import { AccountId, Client, PrivateKey, TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { given, binding, when, then } from "cucumber-tsflow/dist";
import dex from "../../deployment/model/dex";
import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";
import GovernorTokenDao from "../../e2e-test/business/GovernorTokenDao";
import GovernanceDAOFactory from "../../e2e-test/business/GovernanceDAOFactory";
import { expect } from "chai";
import Common from "../business/Common";
import { BigNumber } from "bignumber.js";
import { CommonSteps } from "./CommonSteps";

const csDev = new ContractService();

const governorTokenDaoProxyContractId = csDev.getContractWithProxy(
  csDev.governorTokenDao
).transparentProxyId!;

let governorTokenDao = new GovernorTokenDao(governorTokenDaoProxyContractId);

const governorTokenTransferProxyContractId = csDev.getContractWithProxy(
  csDev.governorTTContractName
).transparentProxyId!;
let governorTokenTransfer = new Governor(governorTokenTransferProxyContractId);

const godHolderProxyContractId = csDev.getContractWithProxy(
  csDev.godHolderContract
).transparentProxyId!;
let godHolder = new GodHolder(godHolderProxyContractId);

const daoFactoryContract = csDev.getContractWithProxy(
  csDev.governanceDaoFactory
);
const proxyId = daoFactoryContract.transparentProxyId!;
const daoFactory = new GovernanceDAOFactory(proxyId);
const daoFactoryContractName = daoFactoryContract.name;

const adminAddress: string = clientsInfo.operatorId.toSolidityAddress();

const toAccount: AccountId = clientsInfo.treasureId;
const fromAccount: AccountId = clientsInfo.operatorId;
const fromAccountPrivateKey: PrivateKey = clientsInfo.operatorKey;
const tokenId: TokenId = TokenId.fromString(dex.TOKEN_LAB49_1);
const daoTokenId: TokenId = dex.GOVERNANCE_DAO_ONE_TOKEN_ID;

const proposalCreatorClient: Client = clientsInfo.operatorClient;
const withPrecision = 1e8;
const DEFAULT_QUORUM_THRESHOLD_IN_BSP = 1;
const DEFAULT_VOTING_DELAY = 2;
const DEFAULT_VOTING_PERIOD = 4;

let proposalId: string;
let balance: BigNumber;
let tokens: BigNumber;
let errorMsg: string = "";
let daoAddress: any;

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
      await governorTokenDao.initialize(
        adminAddress,
        name,
        url,
        governorTokenTransfer,
        godHolder,
        clientsInfo.operatorClient,
        DEFAULT_QUORUM_THRESHOLD_IN_BSP,
        DEFAULT_VOTING_DELAY,
        DEFAULT_VOTING_PERIOD
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
    await governorTokenDao.initialize(
      adminAddress,
      name,
      url,
      governorTokenTransfer,
      godHolder,
      clientsInfo.operatorClient,
      DEFAULT_QUORUM_THRESHOLD_IN_BSP,
      DEFAULT_VOTING_DELAY,
      DEFAULT_VOTING_PERIOD
    );
  }

  @given(/User initialize DAO factory contract/, undefined, 60000)
  public async initializeDAOFactory() {
    await daoFactory.initialize(
      daoFactoryContractName,
      clientsInfo.operatorClient
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
        daoTokenId.toSolidityAddress(),
        DEFAULT_QUORUM_THRESHOLD_IN_BSP,
        DEFAULT_VOTING_DELAY,
        DEFAULT_VOTING_PERIOD,
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
    governorTokenDao = daoFactory.getGovernorTokenDaoInstance(daoAddress);
    governorTokenTransfer = await daoFactory.getGovernorTokenTransferInstance(
      governorTokenDao
    );
    godHolder = await daoFactory.getGodHolderInstance(governorTokenTransfer);
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
    tokens = new BigNumber(tokenAmount * withPrecision);
    try {
      proposalId = await governorTokenDao.createTokenTransferProposal(
        title,
        fromAccount.toSolidityAddress(),
        toAccount.toSolidityAddress(),
        tokenId.toSolidityAddress(),
        tokenAmount * withPrecision,
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
  public async waitForProposalState(state: string, seconds: number) {
    let revertRequired: boolean = false;
    if (state === "Executed") {
      revertRequired = true;
    }
    const requiredState = await governorTokenTransfer.getProposalNumericState(
      state
    );
    try {
      await governorTokenTransfer.getStateWithTimeout(
        proposalId,
        requiredState,
        seconds * 1000,
        1000
      );

      if (revertRequired) {
        console.log(
          `State of proposal is - ${state} revert of god token required is- ${revertRequired}`
        );
        await godHolder.revertTokensForVoter(clientsInfo.operatorClient);
      }
    } catch (e: any) {
      console.log("Something went wrong while getting the state with timeout ");
      console.log(e);
      await this.cancelProposalInternally(
        governorTokenTransfer,
        proposalId,
        clientsInfo.operatorClient,
        godHolder
      );
      throw e;
    }
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
    try {
      const currentState = await governorTokenTransfer.state(
        proposalId,
        clientsInfo.operatorClient
      );
      const proposalStateNumeric =
        await governorTokenTransfer.getProposalNumericState(proposalState);
      expect(Number(currentState)).to.eql(proposalStateNumeric);
    } catch (e: any) {
      console.log("Something went wrong while verifying the state of proposal");
      console.log(e);
      await this.cancelProposalInternally(
        governorTokenTransfer,
        proposalId,
        clientsInfo.operatorClient,
        godHolder
      );
      throw e;
    }
  }

  @when(/User vote "([^"]*)" token transfer proposal/, undefined, 60000)
  public async voteToProposal(vote: string): Promise<void> {
    try {
      const voteVal = await governorTokenTransfer.getProposalVoteNumeric(vote);
      await governorTokenTransfer.vote(
        proposalId,
        voteVal,
        clientsInfo.operatorClient
      );
    } catch (e: any) {
      console.log(
        "Something went wrong while voting to proposal now cancelling the proposal"
      );
      console.log(e);
      await this.cancelProposalInternally(
        governorTokenTransfer,
        proposalId,
        clientsInfo.operatorClient,
        godHolder
      );
      throw e;
    }
  }

  @when(
    /User execute token transfer proposal with title "([^"]*)"/,
    undefined,
    30000
  )
  public async executeProposal(title: string) {
    try {
      await governorTokenTransfer.executeProposal(
        title,
        clientsInfo.operatorKey,
        clientsInfo.operatorClient
      );
    } catch (e: any) {
      console.log(
        "Something went wrong while executing proposal cancelling the proposal"
      );
      console.log(e);
      await this.cancelProposalInternally(
        governorTokenTransfer,
        proposalId,
        clientsInfo.operatorClient,
        godHolder
      );
      throw e;
    }
  }

  @when(
    /User fetches balance of token which user wants to transfer/,
    undefined,
    30000
  )
  public async getTokenBalance() {
    balance = await Common.fetchTokenBalanceFromMirrorNode(
      toAccount.toString(),
      tokenId.toString()
    );
    console.log(
      `DAOGovernorTokenTransfer#getTokenBalance() balance = ${balance}`
    );
  }

  @then(
    /User verify target token is transferred to payee account/,
    undefined,
    30000
  )
  public async verifyTokenBalance() {
    await Helper.delay(6000);
    const updatedBalance = await Common.fetchTokenBalanceFromMirrorNode(
      toAccount.toString(),
      tokenId.toString()
    );
    expect(updatedBalance).to.eql(balance.plus(tokens));
  }

  @when(
    /User create a new token transfer proposal with title "([^"]*)" and token amount higher than current balance/
  )
  public async createTokenTransferProposalWithHigherAmt(title: string) {
    const amt = Number(balance.plus(new BigNumber(1 * withPrecision)));
    console.log(
      `DAOGovernorTokenTransfer#createTokenTransferProposalWithHigherAmt() transfer amount  = ${amt}`
    );
    try {
      proposalId = await governorTokenDao.createTokenTransferProposal(
        title,
        fromAccount.toSolidityAddress(),
        toAccount.toSolidityAddress(),
        tokenId.toSolidityAddress(),
        amt,
        proposalCreatorClient
      );
    } catch (e: any) {
      console.log(e);
      throw e;
    }
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
      await this.cancelProposalInternally(
        governorTokenTransfer,
        proposalId,
        clientsInfo.operatorClient,
        godHolder
      );
    }
  }

  @then(/User verify user receives error message "([^"]*)"/, undefined, 30000)
  public async verifyErrorMessage(msg: string) {
    expect(errorMsg).contains(msg);
    errorMsg = "";
  }

  @when(/User revert the god tokens/, undefined, 30000)
  public async revertGODToken() {
    try {
      await godHolder.revertTokensForVoter(clientsInfo.operatorClient);
    } catch (e: any) {
      console.log(
        "Something went wrong while reverting the god token cancelling the proposal"
      );
      console.log(e);
    }
  }
}
