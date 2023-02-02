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
let votingDelay: number = 12;
let votingPeriod: number = 12;
let proposalID: BigNumber;
let msg: string;
let balance: Long;
let tokens: BigNumber;

const transferTokenId = TokenId.fromString(dex.TOKEN_LAB49_1);
const godTokenID = TokenId.fromString(dex.GOD_TOKEN_ID);

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
    /user create a new proposal with title "([^"]*)" description "([^"]*)" link "([^"]*)" and token amount (\d*)/,
    undefined,
    30000
  )
  public async createProposal(
    title: string,
    description: string,
    link: string,
    tokenAmount: number
  ): Promise<void> {
    let tokenQty = tokenAmount * 100000000;
    tokens = new BigNumber(tokenQty);
    try {
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
    } catch (e: any) {
      msg = e.message;
    }
  }

  @then(/user verify that proposal state is (\d*)/, undefined, 30000)
  public async verifyProposaState(proposalState: string): Promise<void> {
    const currentState = await governor.state(proposalID, contractId, client);
    expect(Number(currentState)).to.eql(Number(proposalState));
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

  @when(/user vote (\d*) to proposal/, undefined, 30000)
  public async voteToProposal(vote: number): Promise<void> {
    await governor.vote(proposalID, vote, contractId, client);
  }

  @when(/user waits for (\d*) seconds/, undefined, 30000)
  public async wait(ms: number): Promise<void> {
    await Helper.delay(ms * 1000);
  }

  @when(/user execute the proposal with title "([^"]*)"/, undefined, 30000)
  public async executeProposal(title: string) {
    await governor.execute(title, contractId, client, treasureKey);
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
    console.log("god token balance --", balance);
  }

  @when(/user revert the god tokens/, undefined, 30000)
  public async revertGODToken() {
    await governor.revertGod(client, godHolder.transparentProxyId!);
  }
}
