import { BigNumber } from "bignumber.js";
import * as fs from "fs";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
  ContractId,
  TokenId,
} from "@hashgraph/sdk";
import { httpRequest } from "../deployment/api/HttpsService";

import ClientManagement from "./utils/utils";
import { ContractService } from "../deployment/service/ContractService";
import { ethers } from "ethers";
import GovernorMethods from "./GovernorMethods";

const clientManagement = new ClientManagement();
const contractService = new ContractService();

const governor = new GovernorMethods();

let client = clientManagement.createOperatorClient();
const { id, key } = clientManagement.getOperator();
const { adminId, adminKey } = clientManagement.getAdmin();

const { treasureId, treasureKey } = clientManagement.getTreasure();

const contractId = contractService.getContractWithProxy(
  contractService.governorContractName
).transparentProxyId!;

const factoryContractId = ContractId.fromString(
  contractService.getContractWithProxy(contractService.factoryContractName)
    .transparentProxyId!
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

const fetchNewTokenAddresses = async (proposalId: BigNumber) => {
  console.log(`\nGetting ContractAddresses `);

  let contractFunctionParameters = new ContractFunctionParameters().addUint256(
    proposalId
  );

  const contractTokenTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("getTokenAddress", contractFunctionParameters)
    .setGas(500000)
    .execute(client);

  const receipt = await contractTokenTx.getReceipt(client);
  const record = await contractTokenTx.getRecord(client);
  const tokenAddress = record.contractFunctionResult!.getAddress(0);

  console.log(`quorumReached tx status ${receipt.status}}`);
  return tokenAddress;
};

const createPair = async (
  contractId: string | ContractId,
  token0: string,
  token1: string
) => {
  console.log(`createPair TokenA TokenB`);
  const createPairTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9000000)
    .setFunction(
      "createPair",
      new ContractFunctionParameters().addAddress(token0).addAddress(token1)
    )
    .setMaxTransactionFee(new Hbar(100))
    .setPayableAmount(new Hbar(100))
    .freezeWith(client)
    .sign(treasureKey);

  const createPairTxRes = await createPairTx.execute(client);
  const receipt = await createPairTxRes.getReceipt(client);
  const record = await createPairTxRes.getRecord(client);
  const contractAddress =
    record.contractFunctionResult!.getAddress(0);
  console.log(`CreatePair address: ${contractAddress}`);
  console.log(`CreatePair status: ${receipt.status}`);
  return contractAddress;
};

const getPair = async (
  contractId: string | ContractId,
  token0: string,
  token1: string
) => {
  console.log(`get Pair`);
  const getPair = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9999999)
    .setFunction(
      "getPair",
      new ContractFunctionParameters().addAddress(token0).addAddress(token1)
    )
    .freezeWith(client);
  const getPairTx = await getPair.execute(client);
  const response = await getPairTx.getRecord(client);
  console.log(`getPair: ${response.contractFunctionResult!.getAddress(0)}`);
  const receipt = await getPairTx.getReceipt(client);
  console.log(`getPair: ${receipt.status}`);
  return `0x${response.contractFunctionResult!.getAddress(0)}`;
};

async function createPairFromFactory(tokenAddress: string) {
  const GODToken = tokenAddress;
  //await setupFactory();
  const tokenA = TokenId.fromString("0.0.48289687");
  await createPair(factoryContractId, GODToken, tokenA.toSolidityAddress());

  const pairAddress = await getPair(
    factoryContractId,
    GODToken,
    tokenA.toSolidityAddress()
  );

  const response = await httpRequest(pairAddress, undefined);
  const pairContractId = response.contract_id;
  console.log(`contractId: ${pairContractId}`);
}

async function propose(
  description: string,
  contractId: string | ContractId
) {
  console.log(`\nCreating proposal `);
  const tokenName = "Governance Hedera Open DEX";
  const tokenSymbol = "GOD";
  const contractFunctionParameters = new ContractFunctionParameters()
    .addString(description)
    .addAddress(treasureId.toSolidityAddress())
    .addBytes(treasureKey.publicKey.toBytes())
    .addAddress(id.toSolidityAddress())
    .addBytes(key.publicKey.toBytes())
    .addString(tokenName)
    .addString(tokenSymbol);

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
  const description = "Create token proposal 10";

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
  const tokenAddress = await fetchNewTokenAddresses(proposalId);
  console.log(tokenAddress);
  await createPairFromFactory(tokenAddress);
  console.log(`\nDone`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
