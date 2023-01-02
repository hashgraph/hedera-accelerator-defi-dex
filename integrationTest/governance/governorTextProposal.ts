import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
} from "@hashgraph/sdk";

import GovernorMethods from "./GovernorMethods";
import ClientManagement from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { Helper } from "../../utils/Helper";

const governor = new GovernorMethods();
const clientManagement = new ClientManagement();
const contractService = new ContractService();

const { treasureKey } = clientManagement.getTreasure();

const client = clientManagement.createOperatorClient();

const contractId = contractService.getContractWithProxy(
  contractService.governorTextContractName
).transparentProxyId!;

async function propose(
  contractId: string | ContractId,
  title: string,
  description: string,
  link: string
) {
  console.log(`\nCreating proposal `);
  const args = new ContractFunctionParameters()
    .addString(title)
    .addString(description)
    .addString(link);

  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("createProposal", args)
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

async function main() {
  console.log(`\nUsing governor proxy contract id ${contractId}`);
  await governor.initialize(contractId);
  const title = "Text Proposal - 2";
  const proposalId = await propose(contractId, title, "description", "link"); // title should be unique for each proposal
  await governor.getProposalDetails(proposalId, contractId);
  await governor.vote(proposalId, 1, contractId); // 1 is for vote.
  await governor.quorumReached(proposalId, contractId);
  await governor.voteSucceeded(proposalId, contractId);
  await governor.proposalVotes(proposalId, contractId);
  await governor.state(proposalId, contractId);
  console.log(`\nWaiting for voting period to get over.`);
  await Helper.delay(15 * 1000); // Wait till waiting period is over. It's current deadline as per Governance.
  await governor.state(proposalId, contractId); // 4 means succeeded
  await governor.execute(title, contractId);
  console.log(`\nDone`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
