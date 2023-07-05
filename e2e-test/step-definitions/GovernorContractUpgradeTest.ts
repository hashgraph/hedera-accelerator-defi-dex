import { ContractId, AccountId, TokenId } from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";
import Governor from "../business/Governor";
import Common from "../business/Common";
import GodHolder from "../business/GodHolder";
import { given, binding, when, then } from "cucumber-tsflow/dist";
import { clientsInfo } from "../../utils/ClientManagement";
import { expect } from "chai";
import Factory from "../business/Factory";
import { main as deployContract } from "../../deployment/scripts/logic";
import { CommonSteps } from "./CommonSteps";
import dex from "../../deployment/model/dex";

const csDev = new ContractService();
const godHolderContract = csDev.getContractWithProxy(csDev.godHolderContract);
const godHolderProxyContractId = csDev.getContractWithProxy(
  csDev.godHolderContract
).transparentProxyId!;
const governorUpgradeContract = csDev.getContractWithProxy(
  csDev.governorUpgradeContract
);

let factoryProxyId = csDev.getContractWithProxy(csDev.factoryContractName)
  .transparentProxyId!; // factoryProxyId contains both logic and proxy id
const governorContractId = governorUpgradeContract.transparentProxyId!;
const godHolderContractId = godHolderContract.transparentProxyId!;
const governor = new Governor(governorContractId);
const godHolder = new GodHolder(godHolderContractId);

let proposalId: string;
let upgradeResponse: any;
let afterUpgradeResponse: any;
let factoryLogicIdOld: string;
let factoryLogicIdNew: string;

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
    console.log("governorContractId :", governorContractId);
    console.log("godHolderContractId :", godHolderContractId);
    console.log("treasureId :", clientsInfo.treasureId.toString());
    console.log("operatorId :", clientsInfo.operatorId.toString());
    await this.initializeGovernorContract(
      governor,
      godHolder,
      clientsInfo.operatorClient,
      TokenId.fromString(dex.GOD_TOKEN_ID),
      TokenId.fromString(dex.GOD_TOKEN_ID)
    );
  }

  @when(
    /User create a new contract upgrade proposal with title "([^"]*)"/,
    undefined,
    30000
  )
  public async createContractUpgradeProposal(title: string) {
    factoryLogicIdNew = csDev.getContract(csDev.factoryContractName).id!;
    const proposalDetails: { proposalId: string; success: boolean } =
      await governor.createContractUpgradeProposal(
        ContractId.fromString(factoryProxyId),
        ContractId.fromString(factoryLogicIdNew), // new contract id
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
    await Common.upgradeTo(
      upgradeResponse.proxyAddress,
      upgradeResponse.logicAddress,
      clientsInfo.proxyAdminKey,
      clientsInfo.proxyAdminClient
    );
  }

  @then(
    /User verify logic address of target factory contract is different before and after upgrade/,
    undefined,
    30000
  )
  public async verifyLogicAddressAreDifferent() {
    const newFactoryProxyId = csDev.getContractWithProxy(
      csDev.factoryContractName
    ).transparentProxyId!;
    const factoryLogicIdNew = await new Factory(
      newFactoryProxyId
    ).getCurrentImplementation();
    expect(factoryLogicIdNew).not.eql(factoryLogicIdOld);
    expect(newFactoryProxyId).eql(factoryProxyId);
  }

  @then(
    /User verify logic address of target contract is not changed/,
    undefined,
    30000
  )
  public async verifyLogicAddressAreSame() {
    const newFactoryProxyId = csDev.getContractWithProxy(
      csDev.factoryContractName
    ).transparentProxyId!;
    const factoryLogicIdNew = await new Factory(
      newFactoryProxyId
    ).getCurrentImplementation();
    expect(factoryLogicIdNew).eql(factoryLogicIdOld);
    expect(newFactoryProxyId).eql(factoryProxyId);
  }

  @when(
    /User get the current logic address of factory contract/,
    undefined,
    30000
  )
  public async getAddressOfFactoryContract() {
    factoryProxyId = csDev.getContractWithProxy(csDev.factoryContractName)
      .transparentProxyId!;
    factoryLogicIdOld = await new Factory(
      factoryProxyId
    ).getCurrentImplementation();
    console.log("factoryProxyId--", factoryProxyId);
    console.log("factoryLogicIdOld--", factoryLogicIdOld);
  }

  @when(/User deploy the contract "([^"]*)"/, undefined, 60000)
  public async deployContract(contractName: string) {
    await deployContract(contractName);
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
      clientsInfo.operatorId,
      clientsInfo.operatorKey,
      clientsInfo.operatorClient
    );
  }

  @when(/User fetch GOD tokens back from GOD holder/, undefined, 30000)
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
