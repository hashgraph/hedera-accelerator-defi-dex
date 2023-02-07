import dex from "../../deployment/model/dex";
import Long from "long";
import Common from "../business/Common";
import Governor from "../business/Governor";
import GodHolder from "../business/GodHolder";
import ClientManagement from "../../utils/ClientManagement";

import { expect } from "chai";
import { binding, given, then, when } from "cucumber-tsflow";
import { TokenId } from "@hashgraph/sdk";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";

const clientManagement = new ClientManagement();
const csDev = new ContractService();

const clientWithNoGODToken = clientManagement.createOperatorClientNoGODToken();
const { idNoGODToken } = clientManagement.getOperatorNoToken();

const tokenTransferProxyId = csDev.getContractWithProxy(
  csDev.governorTTContractName
).transparentProxyId!;

const godHolderProxyId = csDev.getContract(csDev.godHolderContract)
  .transparentProxyId!;

const governor = new Governor(tokenTransferProxyId);
const godHolder = new GodHolder(godHolderProxyId);

const DEFAULT_QUORUM_THRESHOLD_IN_BSP = 1;
const DEFAULT_VOTING_DELAY = 2;
const DEFAULT_VOTING_PERIOD = 4;

let proposalID: string;
let msg: string;
let balance: Long;
let tokens: BigNumber;

const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
const TRANSFER_TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
enum ProposalState {
  Pending,
  Active,
  Canceled,
  Defeated,
  Succeeded,
  Queued,
  Expired,
  Executed,
}

enum VoteType {
  Against,
  For,
  Abstain,
}

@binding()
export class GovernorSteps {
  @given(
    /user have initialized the governor transfer token contract/,
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

    await governor.initialize(
      godHolder,
      clientsInfo.operatorClient,
      DEFAULT_QUORUM_THRESHOLD_IN_BSP,
      DEFAULT_VOTING_DELAY,
      DEFAULT_VOTING_PERIOD
    );
  }

  @when(
    /user create a new proposal with unique title "([^"]*)" description "([^"]*)" link "([^"]*)" and token amount (\d*)/,
    undefined,
    30000
  )
  public async createProposal(
    title: string,
    description: string,
    link: string,
    tokenAmount: number
  ): Promise<void> {
    proposalID = await this.createProposalInternal(
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
    const tokenQty = tokenAmount * 100000000;
    tokens = new BigNumber(tokenQty);
    proposalID = await governor.createTokenTransferProposal(
      title,
      clientsInfo.operatorId.toSolidityAddress(),
      clientsInfo.treasureId.toSolidityAddress(),
      TRANSFER_TOKEN_ID.toSolidityAddress(),
      tokenQty,
      clientsInfo.operatorClient,
      description,
      link
    );

    return proposalID;
  }

  @when(
    /user create a new proposal with duplicate title "([^"]*)" description "([^"]*)" link "([^"]*)" and token amount (\d*)/,
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
      const tokenQty = tokenAmount * 100000000;
      proposalID = await governor.createTokenTransferProposal(
        title,
        clientsInfo.operatorId.toSolidityAddress(),
        clientsInfo.treasureId.toSolidityAddress(),
        TRANSFER_TOKEN_ID.toSolidityAddress(),
        tokenQty,
        clientsInfo.operatorClient,
        description,
        link
      );
    } catch (e: any) {
      msg = e.message;
    }
  }

  @then(/user verify that proposal state is "([^"]*)"/, undefined, 30000)
  public async verifyProposalState(proposalState: string): Promise<void> {
    try {
      const currentState = await governor.state(
        proposalID,
        clientsInfo.operatorClient
      );
      expect(Number(currentState)).to.eql(
        Number(Object.values(ProposalState).indexOf(proposalState))
      );
    } catch (e: any) {
      console.log("Something went wrong while verifying the state of proposal");
      console.log(e);
      await this.cancelProposalInternally();
      throw e;
    }
  }

  @then(/user gets message "([^"]*)" on creating proposal/, undefined, 30000)
  public async verifyErrorMsg(message: string): Promise<void> {
    expect(msg).contains(message);
  }

  @when(
    /user with no GOD token create a new proposal with title "([^"]*)" description "([^"]*)" link "([^"]*)" and token amount (\d*)/
  )
  public async createProposalWithNoGODToken(
    title: string,
    description: string,
    link: string,
    tokenAmount: number
  ): Promise<void> {
    const tokenQty = tokenAmount * 100000000;
    try {
      await governor.createTokenTransferProposal(
        title,
        idNoGODToken.toSolidityAddress(),
        clientsInfo.treasureId.toSolidityAddress(),
        TRANSFER_TOKEN_ID.toSolidityAddress(),
        tokenQty,
        clientWithNoGODToken,
        description,
        link
      );
    } catch (e: any) {
      msg = e.message;
    }
  }

  @when(/user vote "([^"]*)" proposal/, undefined, 30000)
  public async voteToProposal(vote: string): Promise<void> {
    try {
      const voteVal = Number(Object.values(VoteType).indexOf(vote));
      await governor.vote(proposalID, voteVal, clientsInfo.operatorClient);
    } catch (e: any) {
      console.log(
        "Something went wrong while voting to proposal now cancelling the proposal"
      );
      console.log(e);
      await this.cancelProposalInternally();
      throw e;
    }
  }

  @when(/user waits for (\d*) seconds/, undefined, 30000)
  public async wait(ms: number): Promise<void> {
    await governor.delay(ms);
  }

  @when(/user execute the proposal with title "([^"]*)"/, undefined, 30000)
  public async executeProposal(title: string) {
    try {
      await governor.executeProposal(
        title,
        clientsInfo.treasureKey,
        clientsInfo.operatorClient
      );
    } catch (e: any) {
      console.log(
        "Something went wrong while executing proposal cancelling the proposal"
      );
      console.log(e);
      await this.cancelProposalInternally();
      throw e;
    }
  }

  @when(/user fetches token balance of the payee account/, undefined, 30000)
  public async getTokenBalance() {
    balance = await Common.getTokenBalance(
      clientsInfo.treasureId,
      TRANSFER_TOKEN_ID,
      clientsInfo.operatorClient
    );
  }

  @then(
    /user verify that token is transferred to payee account/,
    undefined,
    30000
  )
  public async verifyTokenBalance() {
    const updatedBalance = await Common.getTokenBalance(
      clientsInfo.treasureId,
      TRANSFER_TOKEN_ID,
      clientsInfo.operatorClient
    );
    expect(Number(updatedBalance)).to.eql(Number(balance) + Number(tokens));
  }

  @when(/user cancel the proposal with title "([^"]*)"/, undefined, 30000)
  public async cancelProposal(title: string) {
    await governor.cancelProposal(title, clientsInfo.operatorClient);
  }

  @when(/user fetches the GOD token balance/, undefined, 30000)
  public async getGODTokenBalance() {
    balance = await Common.getTokenBalance(
      clientsInfo.operatorId,
      GOD_TOKEN_ID,
      clientsInfo.operatorClient
    );
    console.log("god token balance --", balance);
  }

  @when(/user revert the god tokens/, undefined, 30000)
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

  private async cancelProposalInternally() {
    try {
      const details = await governor.getProposalDetails(
        proposalID,
        clientsInfo.operatorClient
      );
      await governor.cancelProposal(details.title, clientsInfo.operatorClient);
      await this.revertGODToken();
    } catch (e: any) {
      console.log("Failed while cleaning up");
    }
  }
}
