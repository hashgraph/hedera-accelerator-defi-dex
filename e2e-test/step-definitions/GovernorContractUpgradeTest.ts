import { ContractId } from "@hashgraph/sdk";
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

const csDev = new ContractService();
const godHolderContract = csDev.getContractWithProxy(csDev.godHolderContract);
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
const DEFAULT_QUORUM_THRESHOLD_IN_BSP = 1;
const DEFAULT_VOTING_DELAY = 2;
const DEFAULT_VOTING_PERIOD = 4;
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
    await governor.initialize(
      godHolder,
      clientsInfo.operatorClient,
      DEFAULT_QUORUM_THRESHOLD_IN_BSP,
      DEFAULT_VOTING_DELAY,
      DEFAULT_VOTING_PERIOD
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
      await this.cancelProposalInternally(
        governor,
        proposalId,
        clientsInfo.operatorClient,
        godHolder
      );
      throw e;
    }
  }

  @then(
    /User verify that proposal current state is "([^"]*)"/,
    undefined,
    30000
  )
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
      await this.cancelProposalInternally(
        governor,
        proposalId,
        clientsInfo.operatorClient,
        godHolder
      );
      throw e;
    }
  }

  @when(/User vote "([^"]*)" contract upgrade proposal/, undefined, 30000)
  public async voteToProposal(vote: string): Promise<void> {
    try {
      const voteVal = await governor.getProposalVoteNumeric(vote);
      await governor.vote(proposalId, voteVal, clientsInfo.operatorClient);
    } catch (e: any) {
      console.log(
        "Something went wrong while voting to proposal now cancelling the proposal"
      );
      console.log(e);
      await this.cancelProposalInternally(
        governor,
        proposalId,
        clientsInfo.operatorClient,
        godHolder
      );
      throw e;
    }
  }

  @when(
    /User execute the upgrade proposal with title "([^"]*)"/,
    undefined,
    30000
  )
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
      await this.cancelProposalInternally(
        governor,
        proposalId,
        clientsInfo.operatorClient,
        godHolder
      );
      throw e;
    }
  }

  @when(
    /User get the address of target contract from governor upgrade contract/,
    undefined,
    30000
  )
  public async getContractAddressToUpgrade() {
    try {
      upgradeResponse =
        await governor.getContractAddressesFromGovernorUpgradeContract(
          proposalId,
          clientsInfo.operatorClient
        );
    } catch (e: any) {
      console.log(
        "Something went wrong while getting the address of target contract from governor upgrade contract"
      );
      console.log(e);
      await this.cancelProposalInternally(
        governor,
        proposalId,
        clientsInfo.operatorClient,
        godHolder
      );
      throw e;
    }
  }

  @when(/User upgrade the contract/, undefined, 30000)
  public async upgradeContract() {
    await Common.upgradeTo(
      upgradeResponse.proxyAddress,
      upgradeResponse.logicAddress,
      clientsInfo.adminKey,
      clientsInfo.adminClient
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

  @when(/User revert the god tokens for contract upgrade/, undefined, 30000)
  public async revertGODToken() {
    await this.revertGODTokensFromGodHolder(
      godHolder,
      clientsInfo.operatorClient
    );
  }
}
