import { BigNumber } from "bignumber.js";
import * as fs from "fs";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  TokenId,
  ContractId,
} from "@hashgraph/sdk";

import GovernorMethods from "./GovernorMethods";
import ClientManagement from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";

const clientManagement = new ClientManagement();
const contractService = new ContractService();
const { treasureId, treasureKey } = clientManagement.getTreasure();

const governor = new GovernorMethods();

let client = clientManagement.createOperatorClient();

const contractId = contractService.getContractWithProxy(
  contractService.governorTextContractName
).transparentProxyId!;

async function propose(description: string, contractId: string | ContractId) {
  console.log(`\nCreating proposal `);
  const contractFunctionParameters = new ContractFunctionParameters().addString(
    description
  );

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

async function main() {
  console.log(`\nUsing governor proxy contract id ${contractId}`);
  //const tokenId = await createToken();
  await governor.initialize(contractId);

  const description = "Create text proposal 14";

  const proposalId = await propose(description, contractId);
  await governor.vote(proposalId, 1, contractId); //1 is for vote.
  await governor.quorumReached(proposalId, contractId);
  await governor.voteSucceeded(proposalId, contractId);
  await governor.proposalVotes(proposalId, contractId);
  await governor.state(proposalId, contractId);
  console.log(`\nWaiting for voting period to get over.`);
  await new Promise((f) => setTimeout(f, 15 * 1000)); //Wait till waiting period is over. It's current deadline as per Governance.
  await governor.state(proposalId, contractId); //4 means succeeded
  //await governor.cancelProposal(description, contractId);
  await governor.execute(description, contractId);
  console.log(`\nDone`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
