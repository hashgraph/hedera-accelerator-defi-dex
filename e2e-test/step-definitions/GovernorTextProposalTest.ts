import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";
import { ContractService } from "../../deployment/service/ContractService";
import { given, binding, when, then } from "cucumber-tsflow/dist";
import { clientsInfo } from "../../utils/ClientManagement";
import { expect } from "chai";
import Common from "../business/Common";
import dex from "../../deployment/model/dex";
import { TokenId } from "@hashgraph/sdk";
import { BigNumber } from "bignumber.js";

const csDev = new ContractService();
const godHolderContract = csDev.getContractWithProxy(csDev.godHolderContract);
const governorTextContract = csDev.getContractWithProxy(
  csDev.governorTextContractName
);
const governorContractId = governorTextContract.transparentProxyId!;
const godHolderContractId = godHolderContract.transparentProxyId!;
const governor = new Governor(governorContractId);
const godHolder = new GodHolder(godHolderContractId);
const tokenGOD = dex.GOD_TOKEN_ID;

const DEFAULT_QUORUM_THRESHOLD_IN_BSP = 1;
const DEFAULT_VOTING_DELAY = 2;
const DEFAULT_VOTING_PERIOD = 5;
let errorMsg: string;
let proposalId: string;
let godToken: BigNumber;

@binding()
export class GovernorTextProposal {
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
    await governor.initialize(
      godHolder,
      clientsInfo.operatorClient,
      DEFAULT_QUORUM_THRESHOLD_IN_BSP,
      DEFAULT_VOTING_DELAY,
      DEFAULT_VOTING_PERIOD
    );
  }

  @when(/User create a text proposal with title "([^"]*)"/, undefined, 30000)
  public async createTextProposal(title: string) {
    try {
      proposalId = await governor.createTextProposal(title);
    } catch (e: any) {
      errorMsg = e.message;
      console.log(e);
    }
  }

  @when(
    /User wait for text proposal state to be "([^"]*)" for max (\d*) seconds/,
    undefined,
    30000
  )
  public async waitForProposalState(state: string, seconds: number) {
    let revertRequired: boolean = false;
    if (state === "Executed") {
      revertRequired = true;
    }
    const requiredState = await governor.getProposalNumericState(state);
    try {
      await governor.getStateWithTimeout(
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
      await this.cancelProposalInternally();
      throw e;
    }
  }

  @when(/User cancel the text proposal with title "([^"]*)"/, undefined, 30000)
  public async cancelProposal(title: string) {
    await governor.cancelProposal(title, clientsInfo.operatorClient);
  }

  private async cancelProposalInternally() {
    try {
      const details = await governor.getProposalDetails(
        proposalId,
        clientsInfo.operatorClient
      );
      await governor.cancelProposal(details.title, clientsInfo.operatorClient);
      await godHolder.revertTokensForVoter(clientsInfo.operatorClient);
    } catch (e: any) {
      console.log("Failed while cleaning up");
      console.log(e);
    }
  }

  @then(/User verify text proposal state is "([^"]*)"/, undefined, 30000)
  public async verifyProposalState(proposalState: string): Promise<void> {
    try {
      const currentState = await governor.state(
        proposalId,
        clientsInfo.operatorClient
      );
      const proposalStateNumeric = await governor.getProposalNumericState(
        proposalState
      );
      expect(Number(currentState)).to.eql(proposalStateNumeric);
    } catch (e: any) {
      console.log("Something went wrong while verifying the state of proposal");
      console.log(e);
      await this.cancelProposalInternally();
      throw e;
    }
  }

  @when(/User vote "([^"]*)" to text proposal/, undefined, 30000)
  public async voteToProposal(vote: string): Promise<void> {
    try {
      const voteVal = await governor.getProposalVoteNumeric(vote);
      await governor.vote(proposalId, voteVal, clientsInfo.operatorClient);
    } catch (e: any) {
      errorMsg = e.message;
      console.log(
        "Something went wrong while voting to proposal now cancelling the proposal"
      );
      console.log(e);
      await this.cancelProposalInternally();
    }
  }

  @when(/User execute the text proposal with title "([^"]*)"/, undefined, 30000)
  public async executeProposal(title: string) {
    try {
      const currentState = await governor.state(
        proposalId,
        clientsInfo.operatorClient
      );
      console.log("Porposal state before executing", currentState.toString());
      await governor.executeProposal(
        title,
        clientsInfo.operatorKey,
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

  @then(/User receives "([^"]*)" error message/, undefined, 30000)
  public async verifyErrorMessage(msg: string) {
    expect(errorMsg).contains(msg);
  }

  @when(/User fetches GOD token balance/, undefined, 30000)
  public async fetchGODTokenBalance() {
    godToken = await Common.fetchTokenBalanceFromMirrorNode(
      clientsInfo.operatorId.toString(),
      tokenGOD
    );
  }

  @then(/User verify GOD tokens are returned to user/, undefined, 30000)
  public async verifyGODTokensAreReturned() {
    const updatedGODToken = await Common.fetchTokenBalanceFromMirrorNode(
      clientsInfo.operatorId.toString(),
      tokenGOD
    );
    expect(Number(updatedGODToken)).to.be.greaterThan(Number(godToken));
  }
}
