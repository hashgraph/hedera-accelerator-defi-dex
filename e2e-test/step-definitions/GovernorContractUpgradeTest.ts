import dex from "../../deployment/model/dex";
import Common from "../business/Common";
import Factory from "../business/Factory";
import GodHolder from "../business/GodHolder";
import ContractUpgradeGovernor from "../business/ContractUpgradeGovernor";

import { expect } from "chai";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { CommonSteps } from "./CommonSteps";
import { clientsInfo } from "../../utils/ClientManagement";
import { given, binding, when, then } from "cucumber-tsflow/dist";
import { ContractId, AccountId, TokenId } from "@hashgraph/sdk";

const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);

let godHolder: GodHolder;
let governor: ContractUpgradeGovernor;

let proposalId: string;
let upgradeResponse: any;

let factory: Factory;
let currentLogicAddressForFactory: string;
let proposedLogicAddressForFactory: string;

@binding()
export class GovernorUpgradeSteps extends CommonSteps {
  @given(
    /User have initialized the governor upgrade contract/,
    undefined,
    30000
  )
  public async initialize() {
    console.log(
      "*******************Starting governor contract upgrade test with following credentials*******************"
    );

    factory = new Factory();
    godHolder = new GodHolder();
    governor = new ContractUpgradeGovernor();

    console.log("TokenID   :", GOD_TOKEN_ID.toString());
    console.log("Factory   :", factory.contractId);
    console.log("GodHolder :", godHolder.contractId);
    console.log("ContractUpgradeGovernor :", governor.contractId);
    console.log("Operator Account ID :", clientsInfo.operatorId.toString());

    await this.initializeGovernorContract(
      governor,
      godHolder,
      clientsInfo.operatorClient,
      GOD_TOKEN_ID,
      GOD_TOKEN_ID
    );
  }

  @when(
    /User create a new contract upgrade proposal with title "([^"]*)"/,
    undefined,
    30000
  )
  public async createContractUpgradeProposal(title: string) {
    const proposalDetails: { proposalId: string; success: boolean } =
      await governor.createContractUpgradeProposal(
        ContractId.fromString(factory.contractId),
        ContractId.fromSolidityAddress(proposedLogicAddressForFactory), // new contract id
        title,
        clientsInfo.operatorClient
      );
    proposalId = proposalDetails.proposalId;
  }

  @when(
    /User wait for upgrade proposal state to be "([^"]*)" for max (\d*) seconds/,
    undefined,
    30000
  )
  public async userWaitForState(state: string, seconds: number) {
    await this.waitForProposalState(governor, state, proposalId, seconds);
  }

  @then(
    /User verify that proposal current state is "([^"]*)"/,
    undefined,
    30000
  )
  public async verifyProposalState(proposalState: string): Promise<void> {
    const { currentState, proposalStateNumeric } = await this.getProposalState(
      governor,
      proposalId,
      clientsInfo.operatorClient,
      proposalState
    );
    expect(Number(currentState)).to.eql(proposalStateNumeric);
  }

  @when(/User vote "([^"]*)" contract upgrade proposal/, undefined, 30000)
  public async voteToProposal(vote: string): Promise<void> {
    await this.vote(governor, vote, proposalId, clientsInfo.operatorClient);
  }

  @when(
    /User execute the upgrade proposal with title "([^"]*)"/,
    undefined,
    30000
  )
  public async execute(title: string) {
    await this.executeProposal(
      governor,
      title,
      clientsInfo.treasureKey,
      clientsInfo.operatorClient
    );
  }

  @when(
    /User get the address of target contract from governor upgrade contract/,
    undefined,
    30000
  )
  public async getContractAddressToUpgrade() {
    upgradeResponse =
      await governor.getContractAddressesFromGovernorUpgradeContract(
        proposalId,
        clientsInfo.operatorClient
      );
  }

  @when(/User upgrade the contract/, undefined, 30000)
  public async upgradeContract() {
    const targetContractId = ContractId.fromSolidityAddress(
      upgradeResponse.proxyAddress
    );
    await new Common(targetContractId).upgradeTo(
      upgradeResponse.proxyAddress,
      upgradeResponse.logicAddress,
      clientsInfo.proxyAdminKey,
      clientsInfo.proxyAdminClient
    );
  }

  @then(
    /User verify logic address of target factory contract is updated/,
    undefined,
    30000
  )
  public async verifyLogicAddressUpdated() {
    console.log("---------verification-------------");
    console.log("--verifyLogicAddressUpdated---");
    const nowLogic = await factory.getCurrentImplementation();
    console.table({ nowLogic, proposedLogic: proposedLogicAddressForFactory });
    expect(nowLogic).eql(proposedLogicAddressForFactory);
  }

  @then(
    /User verify logic address of target contract is not changed/,
    undefined,
    30000
  )
  public async verifyLogicAddressAreSame() {
    console.log("---------verification-------------");
    console.log("--verifyLogicAddressAreSame--");
    const nowLogic = await factory.getCurrentImplementation();
    console.table({ nowLogic, previousLogic: currentLogicAddressForFactory });
    expect(nowLogic).eql(currentLogicAddressForFactory);
  }

  @when(
    /User get the current logic address of factory contract/,
    undefined,
    30000
  )
  public async getAddressOfFactoryContract() {
    currentLogicAddressForFactory = await factory.getCurrentImplementation();
  }

  @when(/User deploy the contract "([^"]*)"/, undefined, 60000)
  public async deployContract(contractName: string) {
    const item = await new Deployment().deploy(contractName);
    proposedLogicAddressForFactory = item.address.substring(2); // excluding '0x' from beginning
  }

  @when(
    /User cancel the contract upgrade proposal with title "([^"]*)"/,
    undefined,
    30000
  )
  public async cancelProposal(title: string) {
    await governor.cancelProposal(title, clientsInfo.operatorClient);
  }

  @when(
    /User lock (\d+\.?\d*) GOD token before voting to contract upgrade proposal/,
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
    /User fetch GOD tokens back from GOD holder for GovernorUpgrade/,
    undefined,
    30000
  )
  public async revertGOD() {
    await this.revertTokens(
      ContractId.fromString(godHolder.contractId),
      clientsInfo.operatorId,
      AccountId.fromString(godHolder.contractId),
      clientsInfo.operatorKey,
      GOD_TOKEN_ID,
      clientsInfo.operatorClient
    );
  }

  @when(
    /User setup (\d+\.?\d*) as allowance amount for token locking for contract upgrade proposal/,
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
    /User setup default allowance for contract upgrade proposal creation/,
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
