import dex from "../../deployment/model/dex";
import Long from "long";
import Common from "../business/Common";
import Governor from "../business/Governor";
import GodHolder from "../business/GodHolder";

import { expect } from "chai";
import { binding, given, then, when } from "cucumber-tsflow";
import { TokenId, ContractId, AccountId } from "@hashgraph/sdk";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { CommonSteps } from "./CommonSteps";
import { Helper } from "../../utils/Helper";

const csDev = new ContractService();

const {
  operatorIdNoGODToken: idNoGODToken,
  operatorIdNoGODTokenClient: clientWithNoGODToken,
} = clientsInfo;

const tokenTransferProxyId = csDev.getContractWithProxy(
  csDev.governorTTContractName
).transparentProxyId!;

const godHolderProxyId = csDev.getContract(csDev.godHolderContract)
  .transparentProxyId!;

const governor = new Governor(tokenTransferProxyId);
const godHolder = new GodHolder(godHolderProxyId);

let proposalId: string;
let msg: string;
let balance: Long;
let tokens: BigNumber;

const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
const TRANSFER_TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);

@binding()
export class GovernorSteps extends CommonSteps {
  @given(
    /User have initialized the governor transfer token contract/,
    undefined,
    30000
  )
  public async initialize(): Promise<void> {
    console.log(
      "*******************Starting governor transfer token test with following credentials*******************"
    );
    console.log("contractId :", tokenTransferProxyId);
    console.log("operatorId :", clientsInfo.operatorId.toString());
    console.log("treasureId :", clientsInfo.treasureId.toString());
    await this.initializeGovernorContract(
      governor,
      godHolder,
      clientsInfo.operatorClient,
      TokenId.fromString(dex.GOD_TOKEN_ID),
      TokenId.fromString(dex.GOD_TOKEN_ID)
    );
  }

  @when(
    /User create a new proposal with unique title "([^"]*)" description "([^"]*)" link "([^"]*)" and token amount (\d*)/,
    undefined,
    30000
  )
  public async createProposal(
    title: string,
    description: string,
    link: string,
    tokenAmount: number
  ): Promise<void> {
    proposalId = await this.createProposalInternal(
      title,
      description,
      link,
      tokenAmount
    );
  }

  private async createProposalInternal(
    title: string,
    description: string,
    link: string,
    tokenAmount: number
  ): Promise<string> {
    const tokenQty = tokenAmount * CommonSteps.withPrecision;
    tokens = new BigNumber(tokenQty);
    proposalId = await governor.createTokenTransferProposal(
      title,
      clientsInfo.operatorId.toSolidityAddress(),
      clientsInfo.treasureId.toSolidityAddress(),
      TRANSFER_TOKEN_ID.toSolidityAddress(),
      tokenQty,
      clientsInfo.operatorClient,
      description,
      link,
      clientsInfo.operatorId.toSolidityAddress()
    );

    return proposalId;
  }

  @when(
    /User create a new proposal with duplicate title "([^"]*)" description "([^"]*)" link "([^"]*)" and token amount (\d*)/,
    undefined,
    30000
  )
  public async createProposalWithDuplicateTitle(
    title: string,
    description: string,
    link: string,
    tokenAmount: number
  ): Promise<void> {
    try {
      const tokenQty = tokenAmount * CommonSteps.withPrecision;
      proposalId = await governor.createTokenTransferProposal(
        title,
        clientsInfo.operatorId.toSolidityAddress(),
        clientsInfo.treasureId.toSolidityAddress(),
        TRANSFER_TOKEN_ID.toSolidityAddress(),
        tokenQty,
        clientsInfo.operatorClient,
        description,
        link,
        clientsInfo.operatorId.toSolidityAddress()
      );
    } catch (e: any) {
      msg = e.message;
    }
  }

  @then(/User verify that proposal state is "([^"]*)"/, undefined, 30000)
  public async verifyProposalState(proposalState: string): Promise<void> {
    const { currentState, proposalStateNumeric } = await this.getProposalState(
      governor,
      proposalId,
      clientsInfo.operatorClient,
      proposalState
    );
    expect(Number(currentState)).to.eql(proposalStateNumeric);
  }

  @then(/User gets message "([^"]*)" on creating proposal/, undefined, 30000)
  public async verifyErrorMsg(message: string): Promise<void> {
    expect(msg).contains(message);
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
        idNoGODToken.toSolidityAddress(),
        clientsInfo.treasureId.toSolidityAddress(),
        TRANSFER_TOKEN_ID.toSolidityAddress(),
        tokenQty,
        clientWithNoGODToken,
        description,
        link,
        clientsInfo.operatorId.toSolidityAddress()
      );
    } catch (e: any) {
      msg = e.message;
    }
  }

  @when(/User vote "([^"]*)" proposal/, undefined, 30000)
  public async voteToProposal(vote: string): Promise<void> {
    await this.vote(governor, vote, proposalId, clientsInfo.operatorClient);
  }

  @when(/User execute the proposal with title "([^"]*)"/, undefined, 30000)
  public async execute(title: string) {
    await this.executeProposal(
      governor,
      title,
      clientsInfo.treasureKey,
      clientsInfo.operatorClient
    );
  }

  @when(/User fetches token balance of the payee account/, undefined, 30000)
  public async getTokenBalance() {
    balance = await Common.getTokenBalance(
      clientsInfo.treasureId,
      TRANSFER_TOKEN_ID,
      clientsInfo.operatorClient
    );
  }

  @then(
    /User verify that token is transferred to payee account/,
    undefined,
    30000
  )
  public async verifyTokenBalance() {
    await Helper.delay(15000);
    const updatedBalance = await Common.getTokenBalance(
      clientsInfo.treasureId,
      TRANSFER_TOKEN_ID,
      clientsInfo.operatorClient
    );
    expect(Number(updatedBalance)).to.eql(Number(balance) + Number(tokens));
  }

  @when(/User cancel the proposal with title "([^"]*)"/, undefined, 30000)
  public async cancelProposal(title: string) {
    await governor.cancelProposal(title, clientsInfo.operatorClient);
  }

  @when(/User fetches the GOD token balance/, undefined, 30000)
  public async getGODTokenBalance() {
    balance = await Common.getTokenBalance(
      clientsInfo.operatorId,
      GOD_TOKEN_ID,
      clientsInfo.operatorClient
    );
    console.log("god token balance --", balance);
  }

  @when(
    /User wait for proposal state to be "([^"]*)" for max (\d*) seconds/,
    undefined,
    60000
  )
  public async waitForState(state: string, seconds: number) {
    await this.waitForProposalState(governor, state, proposalId, seconds);
  }

  @when(
    /User lock (\d+\.?\d*) GOD token before voting to transfer token proposal/,
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

  @when(/User fetches GOD token back from GOD holder/, undefined, 30000)
  public async revertGOD() {
    await this.revertTokens(
      ContractId.fromString(godHolderProxyId),
      clientsInfo.operatorId,
      AccountId.fromString(godHolderProxyId),
      clientsInfo.operatorKey,
      TokenId.fromString(dex.GOD_TOKEN_ID),
      clientsInfo.operatorClient
    );
  }

  @when(
    /User setup (\d+\.?\d*) as allowance amount for token locking for transfer token proposal/,
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
    /User setup default allowance for token transfer proposal creation/,
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

  @when(
    /User setup (\d+\.?\d*) as allowance amount of token which needs to be transferred/,
    undefined,
    30000
  )
  public async setAllowanceForTransferToken(allowanceAmt: number) {
    await this.setupAllowanceForToken(
      governor,
      TRANSFER_TOKEN_ID,
      allowanceAmt * CommonSteps.withPrecision,
      governor.contractId,
      clientsInfo.operatorId,
      clientsInfo.operatorKey,
      clientsInfo.operatorClient
    );
  }
}
