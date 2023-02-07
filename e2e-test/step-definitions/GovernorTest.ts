import { binding, given, then, when } from "cucumber-tsflow";
import { expect } from "chai";
import { ContractService } from "../../deployment/service/ContractService";
import ClientManagement from "../../utils/ClientManagement";
import { TokenId } from "@hashgraph/sdk";
import dex from "../../deployment/model/dex";
import Governor from "../business/Governor";
import { BigNumber } from "bignumber.js";
import { Helper } from "../../utils/Helper";
import Factory from "../business/Factory";

const governor = new Governor();
const factory = new Factory();

const clientManagement = new ClientManagement();
const contractService = new ContractService();

const client = clientManagement.createOperatorClient();
const clientWithNoGODToken = clientManagement.createOperatorClientNoGODToken();
const { idNoGODToken, keyNoGODToken } = clientManagement.getOperatorNoToken();
const { id } = clientManagement.getOperator();
const { treasureId, treasureKey } = clientManagement.getTreasure();

const contractId = contractService.getContractWithProxy(
  contractService.governorTTContractName
).transparentProxyId!;

const adminClient = clientManagement.createClientAsAdmin();
const { adminKey } = clientManagement.getAdmin();
const htsServiceAddress = contractService.getContract(
  contractService.baseContractName
).address;
const godHolder = contractService.getContract(
  contractService.godHolderContract
);

let defaultQuorumThresholdValue: number = 1;
let votingDelay: number = 2;
let votingPeriod: number = 4;
let proposalID: BigNumber;
let msg: string;
let balance: Long;
let tokens: BigNumber;

const transferTokenId = TokenId.fromString(dex.TOKEN_LAB49_1);
const godTokenID = TokenId.fromString(dex.GOD_TOKEN_ID);
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
    console.log("contractId : ", contractId);
    console.log("TOKEN_USER_ID : ", id);
    console.log("treasureId :", treasureId);
    await governor.initialize(
      contractId,
      htsServiceAddress,
      godHolder.transparentProxyAddress!,
      defaultQuorumThresholdValue,
      client,
      votingDelay,
      votingPeriod
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
  ): Promise<BigNumber> {
    let tokenQty = tokenAmount * 100000000;
    tokens = new BigNumber(tokenQty);
    proposalID = await governor.propose(
      contractId,
      title,
      description,
      link,
      id.toSolidityAddress(),
      treasureId.toSolidityAddress(),
      transferTokenId.toSolidityAddress(),
      client,
      treasureKey,
      tokens
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
      proposalID = await this.createProposalInternal(
        title,
        description,
        link,
        tokenAmount
      );
    } catch (e: any) {
      msg = e.message;
    }
  }

  @then(/user verify that proposal state is "([^"]*)"/, undefined, 30000)
  public async verifyProposalState(proposalState: string): Promise<void> {
    try {
      const currentState = await governor.state(proposalID, contractId, client);
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
    let tokenQty = tokenAmount * 100000000;
    let tokens = new BigNumber(tokenQty);
    try {
      await governor.propose(
        contractId,
        title,
        description,
        link,
        idNoGODToken.toSolidityAddress(),
        treasureId.toSolidityAddress(),
        transferTokenId.toSolidityAddress(),
        clientWithNoGODToken,
        treasureKey,
        tokens
      );
    } catch (e: any) {
      msg = e.message;
    }
  }

  @when(/user vote "([^"]*)" proposal/, undefined, 30000)
  public async voteToProposal(vote: string): Promise<void> {
    try {
      const voteVal = Number(Object.values(VoteType).indexOf(vote));
      await governor.vote(proposalID, voteVal, contractId, client);
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
    await Helper.delay(ms * 1000);
  }

  @when(/user execute the proposal with title "([^"]*)"/, undefined, 30000)
  public async executeProposal(title: string) {
    try {
      await governor.execute(title, contractId, client, treasureKey);
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
    balance = await factory.getTokenBalance(
      transferTokenId,
      treasureId,
      client
    );
  }

  @then(
    /user verify that token is transferred to payee account/,
    undefined,
    30000
  )
  public async verifyTokenBalance() {
    let updatedBalance = await factory.getTokenBalance(
      transferTokenId,
      treasureId,
      client
    );
    expect(Number(updatedBalance)).to.eql(Number(balance) + Number(tokens));
  }

  @when(/user cancel the proposal with title "([^"]*)"/, undefined, 30000)
  public async cancelProposal(title: string) {
    await governor.cancelProposal(title, contractId, client, treasureKey);
  }

  @when(/user fetches the GOD token balance/, undefined, 30000)
  public async getGODTokenBalance() {
    balance = await factory.getTokenBalance(godTokenID, id, client);
  }

  @when(/user revert the god tokens/, undefined, 30000)
  public async revertGODToken() {
    try {
      await governor.revertGod(client, godHolder.transparentProxyId!);
    } catch (e: any) {
      console.log(
        "Something went wrong while reverting the god token cancelling the proposal"
      );
      console.log(e);
    }
  }

  @when(/user initialize the god holder contract/)
  public async initializeGODHolder() {
    await governor.initializeGodHolder(
      htsServiceAddress,
      godHolder.transparentProxyId!,
      client
    );
  }

  private async cancelProposalInternally() {
    try {
      const title = await governor.getProposalDetails(
        proposalID,
        contractId,
        client
      );
      await governor.cancelProposal(title, contractId, client, treasureKey);
      await this.revertGODToken();
    } catch (e: any) {
      console.log("Failed while cleaning up ");
    }
  }
}
