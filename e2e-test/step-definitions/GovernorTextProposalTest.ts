import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";
import { ContractService } from "../../deployment/service/ContractService";
import { given, binding, when, then } from "cucumber-tsflow/dist";
import { clientsInfo } from "../../utils/ClientManagement";
import { expect } from "chai";
import Common from "../business/Common";
import dex from "../../deployment/model/dex";
import { TokenId, ContractId, AccountId } from "@hashgraph/sdk";
import { BigNumber } from "bignumber.js";
import { Helper } from "../../utils/Helper";
import { CommonSteps } from "./CommonSteps";
import TextGovernor from "../business/TextGovernor";

const csDev = new ContractService();
const godHolderContract = csDev.getContractWithProxy(csDev.godHolderContract);
const governorTextContract = csDev.getContractWithProxy(
  csDev.governorTextContractName
);
const governorContractId = governorTextContract.transparentProxyId!;
const godHolderContractId = godHolderContract.transparentProxyId!;
const governor = new TextGovernor(ContractId.fromString(governorContractId));
const godHolder = new GodHolder(ContractId.fromString(godHolderContractId));
const tokenGOD = dex.GOD_TOKEN_ID;

let errorMsg: string = "";
let proposalId: string;
let godToken: BigNumber;

@binding()
export class GovernorTextProposal extends CommonSteps {
  @given(
    /User have initialized the governor text proposal contract/,
    undefined,
    30000
  )
  public async initialize() {
    console.log(
      "*******************Starting governor contract text proposal test with following credentials*******************"
    );
    console.log("governorContractId :", governorContractId);
    console.log("godHolderContractId :", godHolderContractId);
    console.log("operatorId :", clientsInfo.operatorId.toString());
    await this.initializeGovernorContract(
      governor,
      godHolder,
      clientsInfo.operatorClient,
      TokenId.fromString(dex.GOD_TOKEN_ID),
      TokenId.fromString(dex.GOD_TOKEN_ID)
    );
  }

  @when(/User create a text proposal with title "([^"]*)"/, undefined, 30000)
  public async createTextProposal(title: string) {
    proposalId = await governor.createTextProposal(
      title,
      clientsInfo.operatorId
    );
  }

  @when(/User create a text proposal with blank title/, undefined, 30000)
  public async createTextProposalWithBlankTitle() {
    try {
      await governor.createTextProposal("", clientsInfo.operatorId);
    } catch (e: any) {
      errorMsg = e.message;
    }
  }

  @when(
    /User wait for text proposal state to be "([^"]*)" for max (\d*) seconds/,
    undefined,
    30000
  )
  public async waitForState(state: string, seconds: number) {
    await this.waitForProposalState(governor, state, proposalId, seconds);
  }

  @when(/User cancel the text proposal with title "([^"]*)"/, undefined, 30000)
  public async cancelProposal(title: string) {
    await governor.cancelProposal(title, clientsInfo.operatorClient);
  }

  @then(/User verify text proposal state is "([^"]*)"/, undefined, 30000)
  public async verifyProposalState(proposalState: string): Promise<void> {
    const { currentState, proposalStateNumeric } = await this.getProposalState(
      governor,
      proposalId,
      clientsInfo.operatorClient,
      proposalState
    );
    expect(Number(currentState)).to.eql(proposalStateNumeric);
  }

  @when(/User vote "([^"]*)" to text proposal/, undefined, 30000)
  public async voteToProposal(vote: string): Promise<void> {
    await this.vote(governor, vote, proposalId, clientsInfo.operatorClient);
  }

  @when(/User execute the text proposal with title "([^"]*)"/, undefined, 30000)
  public async execute(title: string) {
    await this.executeProposal(
      governor,
      title,
      clientsInfo.treasureKey,
      clientsInfo.operatorClient
    );
  }

  @then(/User receives "([^"]*)" error message/, undefined, 30000)
  public async verifyErrorMessage(msg: string) {
    expect(errorMsg).contains(msg);
    errorMsg = "";
  }

  @when(/User fetches GOD token balance/, undefined, 30000)
  public async fetchGODTokenBalance() {
    godToken = await Common.getTokenBalance(clientsInfo.operatorId, tokenGOD);
  }

  @then(/User verify GOD tokens are returned to user/, undefined, 30000)
  public async verifyGODTokensAreReturned() {
    await Helper.delay(10000);
    const updatedGODToken = await Common.getTokenBalance(
      clientsInfo.operatorId,
      tokenGOD
    );
    console.log(
      `GovernorTextProposal#verifyGODTokensAreReturned: Actual = ${Number(
        updatedGODToken
      )}, Expected = ${Number(godToken)}`
    );
    expect(Number(updatedGODToken)).to.be.greaterThan(Number(godToken));
  }

  @when(
    /User lock (\d+\.?\d*) GOD token before voting to text proposal/,
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

  @when(/User fetch GOD token back from GOD holder/, undefined, 30000)
  public async revertGOD() {
    await this.revertTokens(
      ContractId.fromString(godHolderContractId),
      clientsInfo.operatorId,
      AccountId.fromString(godHolderContractId),
      clientsInfo.operatorKey,
      TokenId.fromString(dex.GOD_TOKEN_ID),
      clientsInfo.operatorClient
    );
  }

  @when(
    /User setup (\d+\.?\d*) as allowance amount for token locking for text proposal/,
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
    /User setup default allowance for text proposal creation/,
    undefined,
    30000
  )
  public async setAllowanceForProposalCreation() {
    await this.setupAllowanceForProposalCreation(
      governor,
      clientsInfo.operatorClient,
      clientsInfo.operatorId,
      clientsInfo.operatorKey
    );
  }
}
