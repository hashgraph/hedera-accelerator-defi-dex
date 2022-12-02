import { BigNumber } from "bignumber.js";
import * as fs from "fs";
import {
  AccountId,
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  Hbar,
  TokenCreateTransaction,
  TokenId,
  TokenSupplyType,
  TokenType,
} from "@hashgraph/sdk";

import ClientManagement from "./utils/utils";
import { ContractService } from "../deployment/service/ContractService";
import { ethers } from "ethers";
import GovernorMethods from "./GovernorMethods";

const clientManagement = new ClientManagement();
const contractService = new ContractService();

const governor = new GovernorMethods();

let client = clientManagement.createOperatorClient();
const treasurerClient = clientManagement.createClient();
const dexOwnerClient = clientManagement.dexOwnerClient();
const { adminId, adminKey } = clientManagement.getAdmin();
const { id, key } = clientManagement.getOperator();

const { treasureId, treasureKey } = clientManagement.getTreasure();
const { id: dexOwnerId, key: dexOwnerKey } = clientManagement.getDexOwner();

const htsServiceAddress = contractService.getContract(
  contractService.baseContractName
).address;

const contractId = contractService.getContractWithProxy(
  contractService.governorTTContractName
).transparentProxyId!;
const transferTokenId = TokenId.fromString("0.0.48504379");

const readFileContent = (filePath: string) => {
  const rawdata: any = fs.readFileSync(filePath);
  return JSON.parse(rawdata);
};

const initialize = async (tokenId: TokenId) => {
  console.log(`\nInitialize contract with token  `);
  const votingDelay = 0;
  const votingPeriod = 12;

  let contractFunctionParameters = new ContractFunctionParameters()
    .addAddress(tokenId.toSolidityAddress()) // token that define the voting weight, to vote user should have % of this token.
    .addAddress(id.toSolidityAddress()) // from
    .addAddress(clientManagement.getDexOwner().id.toSolidityAddress()) // to
    .addAddress(transferTokenId.toSolidityAddress()) // tokenToTransfer
    .addInt256(new BigNumber(100000000)) // amountToTransfer
    .addUint256(votingDelay)
    .addUint256(votingPeriod)
    .addAddress(htsServiceAddress);

  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("initialize", contractFunctionParameters)
    .setGas(900000)
    .execute(client);

  const receipt = await tx.getReceipt(client);

  console.log(`Initialize contract with token done with status - ${receipt}`);
};

const execute = async (
  targets: Array<string>,
  ethFees: Array<number>,
  calls: Array<Uint8Array>,
  description: string
) => {
  console.log(`\nExecuting  proposal - `);

  const contractFunctionParameters = new ContractFunctionParameters()
    .addAddressArray(targets)
    .addUint256Array(ethFees)
    .addBytesArray(calls)
    .addString(description);

  const contractAllotTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("executePublic", contractFunctionParameters)
    .setPayableAmount(new Hbar(70))
    .setMaxTransactionFee(new Hbar(70))
    .setGas(900000)
    .freezeWith(client)
    .sign(dexOwnerKey); //Admin of token

  const executedTx = await contractAllotTx.execute(client);
  const record = await executedTx.getRecord(client);
  const contractAllotRx = await executedTx.getReceipt(client);
  const status = contractAllotRx.status;

  console.log(
    `Execute tx status ${status} for proposal id ${record.contractFunctionResult?.getUint256(
      0
    )}`
  );
};

const associateTokenPublicCallData = async (
  tokenId: TokenId
): Promise<Uint8Array> => {
  const contractJson = readFileContent(
    "./artifacts/contracts/common/BaseHTS.sol/BaseHTS.json"
  );
  const contractInterface = new ethers.utils.Interface(contractJson.abi);

  const receiver = adminId.toSolidityAddress();
  const callData = contractInterface.encodeFunctionData(
    "associateTokenPublic",
    [receiver, tokenId.toSolidityAddress()]
  );
  return ethers.utils.toUtf8Bytes(callData);
};

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

const propose = async (
  targets: Array<string>,
  ethFees: Array<number>,
  calls: Array<Uint8Array>,
  description: string,
  contractId: string | ContractId,
  operator: Client = treasurerClient
) => {
  console.log(`\nCreating proposal `);

  const contractFunctionParameters = new ContractFunctionParameters()
    .addAddressArray(targets)
    .addUint256Array(ethFees)
    .addBytesArray(calls)
    .addString(description);

  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("propose", contractFunctionParameters)
    .setGas(900000)
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

const delegateTo = async (
  delegatee: string,
  contractId: string | ContractId,
  client: Client
) => {
  console.log(`\ndelegateTo `);

  let contractFunctionParameters = new ContractFunctionParameters().addAddress(
    delegatee
  );

  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("delegateTo", contractFunctionParameters)
    .setGas(500000)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const record = await tx.getRecord(client);

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

  const tokenId = TokenId.fromString("0.0.48602743");
  await initialize(tokenId);

  const targets = [htsServiceAddress];
  const ethFees = [0];
  const associateToken = await associateTokenPublicCallData(tokenId);
  const calls = [associateToken];
  const description = "Create token  transfer proposal with delegation 4";

  const proposalId = await propose(
    targets,
    ethFees,
    calls,
    description,
    contractId
  ); //Operator must be user that has tokens

  const userThatHasTokens = treasurerClient;

  await vote(proposalId, 1, contractId, userThatHasTokens); //1 is for vote.

  const userThatHasNoTokens = clientManagement.getDexOwner();

  await delegateTo(
    userThatHasNoTokens.id.toSolidityAddress(),
    contractId,
    userThatHasTokens
  );

  const clientThatHasNoTokens = clientManagement.dexOwnerClient();

  await vote(proposalId, 1, contractId, clientThatHasNoTokens); //1 is against vote.

  await quorumReached(proposalId);
  await governor.voteSucceeded(proposalId, contractId);
  await governor.proposalVotes(proposalId, contractId);
  await governor.state(proposalId, contractId);
  console.log(`\nWaiting for voting period to get over.`);
  await new Promise((f) => setTimeout(f, 15 * 1000)); //Wait till waiting period is over. It's current deadline as per Governance.
  await governor.state(proposalId, contractId); //4 means succeeded

  await execute(targets, ethFees, calls, description);

  console.log(`\nDone`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
