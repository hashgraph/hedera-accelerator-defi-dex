import { BigNumber } from "bignumber.js";
import * as fs from "fs";
import {
  ContractId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  TokenId,
} from "@hashgraph/sdk";

import GovernorMethods from "./GovernorMethods";
import ClientManagement from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";

const clientManagement = new ClientManagement();
const contractService = new ContractService();

const governor = new GovernorMethods();

let client = clientManagement.createOperatorClient();
const { id, key } = clientManagement.getOperator();

const { treasureId, treasureKey } = clientManagement.getTreasure();

const contractId = contractService.getContractWithProxy(
  contractService.governorTTContractName
).transparentProxyId!;
const transferTokenId = TokenId.fromString("0.0.48504379");

async function propose(
  description: string,
  contractId: string | ContractId,
  title: string,
  link: string
) {
  console.log(`\nCreating proposal `);
  const contractFunctionParameters = new ContractFunctionParameters()
    .addString(description)
    .addAddress(id.toSolidityAddress()) // from
    .addAddress(treasureId.toSolidityAddress()) // to
    .addAddress(transferTokenId.toSolidityAddress()) // tokenToTransfer
    .addInt256(new BigNumber(100000000)) // amountToTransfer
    .addString(title)
    .addString(link);

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

const getTokenTransferData = async (
  proposalId: BigNumber,
  contractId: string | ContractId
) => {
  console.log(`\nGetting getTokenTransferData `);
  const args = new ContractFunctionParameters().addUint256(proposalId);
  const txn = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("getTokenTransferData", args)
    .setGas(500000)
    .execute(client);

  const receipt = await txn.getReceipt(client);
  const record = await txn.getRecord(client);
  const title = record.contractFunctionResult!.getString(0);
  const link = record.contractFunctionResult!.getString(1);
  console.log(
    `getTokenTransferData tx status ${receipt.status} with title = ${title} & link = ${link}`
  );
};

const claimGodToken = async (
  proposalId: BigNumber,
  contractId: string | ContractId
) => {
  console.log(`\nGetting claimGodToken `);
  const args = new ContractFunctionParameters().addUint256(proposalId);
  const txn = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("claimGODToken", args)
    .setGas(500000)
    .execute(client);

  const receipt = await txn.getReceipt(client);
  console.log(`claimGodToken tx status ${receipt.status}`);
};

async function main() {
  console.log(`\nUsing governor proxy contract id ${contractId}`);
  await governor.initialize(contractId);
  const description = "Create token proposal 7";
  const title = "Title2";
  const link = "Link2";

  const proposalId = await propose(description, contractId, title, link);
  await getTokenTransferData(proposalId, contractId);
  await governor.vote(proposalId, 1, contractId); //1 is for vote.
  await governor.quorumReached(proposalId, contractId);
  await governor.voteSucceeded(proposalId, contractId);
  await governor.proposalVotes(proposalId, contractId);
  await governor.state(proposalId, contractId);
  console.log(`\nWaiting for voting period to get over.`);
  await new Promise((f) => setTimeout(f, 15 * 1000)); //Wait till waiting period is over. It's current deadline as per Governance.
  await governor.state(proposalId, contractId); //4 means succeeded
  await governor.execute(description, contractId);
  await claimGodToken(proposalId, contractId);
  console.log(`\nDone`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
