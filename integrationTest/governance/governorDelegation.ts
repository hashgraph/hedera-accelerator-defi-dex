import { BigNumber } from "bignumber.js";
import {
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  TokenId,
} from "@hashgraph/sdk";

import GovernorMethods from "./GovernorMethods";
import ClientManagement from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";

const clientManagement = new ClientManagement();
const contractService = new ContractService();

const governor = new GovernorMethods();
const { id } = clientManagement.getOperator();
const transferTokenId = TokenId.fromString("0.0.48504379");

const client = clientManagement.createOperatorClient();
const treasurerClient = clientManagement.createClient();
const { treasureId, treasureKey } = clientManagement.getTreasure();
const contractId = contractService.getContractWithProxy(
  contractService.governorTTContractName
).transparentProxyId!;

async function propose(description: string, contractId: string | ContractId) {
  console.log(`\nCreating proposal `);
  const contractFunctionParameters = new ContractFunctionParameters()
    .addString(description)
    .addAddress(id.toSolidityAddress()) // from
    .addAddress(treasureId.toSolidityAddress()) // to
    .addAddress(transferTokenId.toSolidityAddress()) // tokenToTransfer
    .addInt256(new BigNumber(100000000)); // amountToTransfer

  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("createProposal", contractFunctionParameters)
    .setGas(9000000)
    .freezeWith(client)
    .sign(treasureKey);

  const executedTx = await tx.execute(client);

  const record = await executedTx.getRecord(client);
  const receipt = await executedTx.getReceipt(client);

  const status = receipt.status;
  const proposalId = record.contractFunctionResult?.getUint256(0)!;
  console.log(`Proposal tx status ${status} with proposal id ${proposalId}`);

  return proposalId;
}

const delegateTo = async (
  delegatee: string,
  contractId: string | ContractId,
  client: Client
) => {
  console.log(`\ndelegateTo `);

  const contractFunctionParameters =
    new ContractFunctionParameters().addAddress(delegatee);

  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("delegateTo", contractFunctionParameters)
    .setGas(500000)
    .execute(client);

  const receipt = await tx.getReceipt(client);

  console.log(`delegateTo tx status ${receipt.status}`);
};

const vote = async (
  proposalId: BigNumber,
  voteId: number,
  contractId: string | ContractId,
  clientArg: Client
) => {
  console.log(`\nVote for proposal id ${proposalId} `);
  const contractFunctionParameters = new ContractFunctionParameters()
    .addUint256(proposalId)
    .addUint8(voteId);

  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("castVote", contractFunctionParameters)
    .setGas(900000)
    .freezeWith(clientArg);

  const executedTx = await tx.execute(clientArg);

  const response = await executedTx.getRecord(clientArg);
  const receipt = await executedTx.getReceipt(clientArg);

  const status = receipt.status;

  console.log(
    `Vote tx status ${status} for proposal id ${response.contractFunctionResult?.getUint256(
      0
    )}`
  );
};

async function main() {
  console.log(`\nUsing governor proxy contract id ${contractId}`);
  // await governor.initialize(contractId);

  const description = "Create token  transfer proposal with delegation 5";

  const proposalId = await propose(description, contractId); // Operator must be user that has tokens

  const userThatHasTokens = treasurerClient;
  await vote(proposalId, 1, contractId, userThatHasTokens); // 1 is for vote.
  const userThatHasNoTokens = clientManagement.getDexOwner();

  await delegateTo(
    userThatHasNoTokens.id.toSolidityAddress(),
    contractId,
    userThatHasTokens
  );

  const clientThatHasNoTokens = clientManagement.dexOwnerClient();
  await vote(proposalId, 1, contractId, clientThatHasNoTokens); // 1 is against vote.
  await governor.quorumReached(proposalId, contractId);
  await governor.voteSucceeded(proposalId, contractId);
  await governor.proposalVotes(proposalId, contractId);
  await governor.state(proposalId, contractId);
  console.log(`\nWaiting for voting period to get over.`);
  await new Promise((f) => setTimeout(f, 15 * 1000)); // Wait till waiting period is over. It's current deadline as per Governance.
  await governor.state(proposalId, contractId); // 4 means succeeded

  await governor.execute(description, contractId);

  console.log(`\nDone`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
