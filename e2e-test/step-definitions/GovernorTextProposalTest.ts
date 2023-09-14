import dex from "../../deployment/model/dex";
import GodHolder from "../../e2e-test/business/GodHolder";
import TextGovernor from "../business/TextGovernor";

import { expect } from "chai";
import { clientsInfo } from "../../utils/ClientManagement";
import { CommonSteps } from "./CommonSteps";
import { given, binding, when, then } from "cucumber-tsflow/dist";
import { TokenId, ContractId, AccountId } from "@hashgraph/sdk";

const TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);

let godHolder: GodHolder;
let governor: TextGovernor;

let errorMsg: string = "";
let proposalId: string;

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
    godHolder = new GodHolder();
    governor = new TextGovernor();
    console.log("TextGovernor ID:", governor.contractId);
    console.log("GodHolder ID :", godHolder.contractId);
    console.log("Token ID :", TOKEN_ID.toSolidityAddress());
    console.log("Operator Account ID :", clientsInfo.operatorId.toString());
    await this.initializeGovernorContract(
      governor,
      godHolder,
      clientsInfo.operatorClient,
      TOKEN_ID,
      TOKEN_ID
    );
  }

  @when(/User create a text proposal with title "([^"]*)"/, undefined, 30000)
  public async createTextProposal(title: string) {
    proposalId = await governor.createTextProposal(title);
  }

  @when(/User create a text proposal with blank title/, undefined, 30000)
  public async createTextProposalWithBlankTitle() {
    try {
      await governor.createTextProposal("");
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

  @when(
    /User lock (\d+\.?\d*) GOD token before voting to text proposal/,
    undefined,
    30000
  )
  public async lockGOD(tokenAmt: number) {
    await this.lockTokens(
      godHolder,
      tokenAmt * CommonSteps.withPrecision,
      clientsInfo.operatorClient
    );
  }

  @when(
    /User fetch GOD tokens back from GOD holder for GovernorText/,
    undefined,
    30000
  )
  public async revertGOD() {
    await this.revertTokens(
      ContractId.fromString(godHolder.contractId),
      clientsInfo.operatorId,
      AccountId.fromString(godHolder.contractId),
      clientsInfo.operatorKey,
      TOKEN_ID,
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
