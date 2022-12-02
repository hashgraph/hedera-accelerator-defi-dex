import { BigNumber } from "bignumber.js";
import * as fs from "fs";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId
} from "@hashgraph/sdk";

import ClientManagement from "./utils/utils";
import { ContractService } from "../deployment/service/ContractService";
import { ethers } from "ethers";
import GovernorMethods from "./GovernorMethods";

const clientManagement = new ClientManagement();
const contractService = new ContractService();

const governor = new GovernorMethods();
const { treasureId, treasureKey } = clientManagement.getTreasure();

let client = clientManagement.createOperatorClient();
const { key } = clientManagement.getOperator();
const { adminId, adminKey } = clientManagement.getAdmin();

const adminClient = clientManagement.createClientAsAdmin();

let contractId: string | ContractId = contractService.getContractWithProxy(
    contractService.governorUpgradeContract
  ).transparentProxyId!;

const upgradeContractId = ContractId.fromString( 
    contractService.getContract(
        contractService.factoryContractName
    ).id!
);

const transparentContractId = ContractId.fromString(
    contractService.getContractWithProxy(
        contractService.factoryContractName
    ).transparentProxyId!
);

const quorumReached = async (proposalId: BigNumber) => {
  console.log(`\nGetting quorumReached `);

  let contractFunctionParameters = new ContractFunctionParameters().addUint256(
    proposalId
  );

  const contractTokenTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("quorumReached", contractFunctionParameters)
    .setGas(500000)
    .execute(client);

  const receipt = await contractTokenTx.getReceipt(client);
  const record = await contractTokenTx.getRecord(client);
  const status = record.contractFunctionResult!.getBool(0);

  console.log(
    `quorumReached tx status ${receipt.status} with quorumReached ${status}`
  );
};

const fetchUpgradeContractAddresses = async (proposalId: BigNumber) => {
  console.log(`\nGetting ContractAddresses `);

  let contractFunctionParameters = new ContractFunctionParameters().addUint256(
    proposalId
  );

  const contractTokenTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("getContractAddresses", contractFunctionParameters)
    .setGas(500000)
    .execute(client);

  const receipt = await contractTokenTx.getReceipt(client);
  const record = await contractTokenTx.getRecord(client);
  const proxy = record.contractFunctionResult!.getAddress(0);
  const contractToUgrade = record.contractFunctionResult!.getAddress(1);
  
  console.log(
    `quorumReached tx status ${receipt.status}}`
  );
  return {proxy, contractToUgrade};
};

const upgradeTo = async (newImplementation: string) => {
  const liquidityPool = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(2000000)
      .setFunction(
        "upgradeTo",
        new ContractFunctionParameters()
          .addAddress(newImplementation)
      )
      .freezeWith(adminClient)
      .sign(adminKey);
    const liquidityPoolTx = await liquidityPool.execute(adminClient);
    const transferTokenRx = await liquidityPoolTx.getReceipt(adminClient);
    console.log(`upgradedTo: ${transferTokenRx.status}`);
};

const setupFactory = async () => {
  console.log(`\nSetupFactory`);
  const baseContract = contractService.getContract(contractService.baseContractName);
  let contractFunctionParameters = new ContractFunctionParameters()
                                        .addAddress(baseContract.address)
  const contractSetPairsTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("setUpFactory", contractFunctionParameters)
    .setGas(9000000)
    .execute(client);
  const contractSetPairRx = await contractSetPairsTx.getReceipt(client);
  const response = await contractSetPairsTx.getRecord(client);
  const status = contractSetPairRx.status;
  console.log(`\nSetupFactory Result ${status} code: ${response.contractFunctionResult!.getAddress()}`);
};

async function propose(
  description: string,
  contractId: string | ContractId
) {
  console.log(`\nCreating proposal `);
  const contractFunctionParameters = new ContractFunctionParameters()
    .addString(description)
    .addAddress(transparentContractId.toSolidityAddress())
    .addAddress(upgradeContractId.toSolidityAddress());

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
};


async function main() {
  console.log(`\nUsing governor proxy contract id ${contractId}`);
  await governor.initialize(contractId);
  const description = "Create Upgrade proposal 20";

  const proposalId = await propose(
    description,
    contractId
  );
  await governor.vote(proposalId, 1, contractId); //1 is for vote.
  await quorumReached(proposalId);
  await governor.voteSucceeded(proposalId, contractId);
  await governor.proposalVotes(proposalId, contractId);
  await governor.state(proposalId, contractId);
  console.log(`\nWaiting for voting period to get over.`);
  await new Promise((f) => setTimeout(f, 15 * 1000)); //Wait till waiting period is over. It's current deadline as per Governance.
  await governor.state(proposalId, contractId); //4 means succeeded
  await governor.execute(description, contractId);
  const contracts = await fetchUpgradeContractAddresses(proposalId);
  console.log(contracts);
  contractId = ContractId.fromSolidityAddress(contracts.proxy);
  await upgradeTo(contracts.contractToUgrade);
  // await setupFactory();
  // await checkFactory();
  console.log(`\nDone`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
