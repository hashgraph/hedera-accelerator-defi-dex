import { binding, given, then, when } from "cucumber-tsflow";
import { expect } from "chai";
import { ContractService } from "../../deployment/service/ContractService";
import ClientManagement from "../../utils/ClientManagement";
import { TokenId } from "@hashgraph/sdk";
import dex from "../../deployment/model/dex";
import Governor from "../business/Governor";
import { BigNumber } from "bignumber.js";

const governor = new Governor();

const clientManagement = new ClientManagement();
const contractService = new ContractService();

const client = clientManagement.createOperatorClient();
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

let defaultQuorumThresholdValue: number = 5;
let votingDelay: number = 0;
let votingPeriod: number = 100;
let proposalID: BigNumber;

const transferTokenId = TokenId.fromString(dex.TOKEN_LAB49_1);

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
    let tokens = new BigNumber(tokenQty);
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
  }

  @then(/user verify that proposal state is (\d*)/, undefined, 30000)
  public async verifyProposaState(proposalState: string): Promise<void> {
    console.log(`ProposalId: ${proposalID}`);
    const currentState = await governor.state(proposalID, contractId, client);
    expect(Number(currentState)).to.eql(Number(proposalState));
  }
}
