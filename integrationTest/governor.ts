import { BigNumber } from "bignumber.js";
import * as fs from "fs";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenId,
  AccountId
} from "@hashgraph/sdk";

import ClientManagement from "./utils/utils";
import { EventConsumer } from "./utils/EventConsumer";
import { ContractService } from "../deployment/service/ContractService";
import { ethers } from "ethers";

const eventConsumer = new EventConsumer("./artifacts/contracts/common/GovernorCountingSimpleInternal.sol/GovernorCountingSimpleInternal.json");

const clientManagement = new ClientManagement();
const contractService = new ContractService();

let client = clientManagement.createOperatorClient();
const { id, key } = clientManagement.getOperator();
const { adminId } = clientManagement.getAdmin();

const treasurerClient = clientManagement.createClient();
const { treasureId, treasureKey } = clientManagement.getTreasure();

const htsServiceAddress = contractService.getContract(contractService.baseContractName).address;

const contractId = contractService.getContractWithProxy(contractService.governorContractName).transparentProxyId!;

const readFileContent = (filePath: string) => {
  const rawdata: any = fs.readFileSync(filePath);
  return JSON.parse(rawdata);
};

const createToken = async (): Promise<TokenId> => {
  const createTokenTx = await new TokenCreateTransaction()
    .setTokenName("Governance Hedera Open DEX")
    .setTokenSymbol("GOD")
    .setDecimals(8)
    .setInitialSupply(20000000000)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setSupplyKey(treasureKey)
    .setAdminKey(treasureKey)
    .setTreasuryAccountId(treasureId)
    .execute(treasurerClient);

  const tokenCreateTx = await createTokenTx.getReceipt(treasurerClient);
  const tokenId = tokenCreateTx.tokenId;
  console.log(`Token created ${tokenId}, Token Address ${tokenId?.toSolidityAddress()}`);
  return tokenId!;
}

const initialize = async (tokenId: TokenId) => {
  console.log(`\nInitialize contract with token  `);
  const tokenName = "Governance Hedera Open DEX";
  const tokenSymbol = "GOD";
  const votingDelay = 0;
  const votingPeriod = 12;

  let contractFunctionParameters = new ContractFunctionParameters()
    .addAddress(tokenId.toSolidityAddress())
    .addAddress(treasureId.toSolidityAddress())
    .addBytes(treasureKey.publicKey.toBytes())
    .addAddress(id.toSolidityAddress())
    .addBytes(key.publicKey.toBytes())
    .addString(tokenName)
    .addString(tokenSymbol)
    .addUint256(votingDelay)
    .addUint256(votingPeriod);

  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("initialize", contractFunctionParameters)
    .setGas(900000)
    .execute(client);

  const receipt = await tx.getReceipt(client);

  console.log(`Initialize contract with token done with status - ${receipt}`);
}

const propose = async (targets: Array<string>, ethFees: Array<number>, calls: Array<Uint8Array>, description: string) => {
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
    .freezeWith(client);

  const executedTx = await tx.execute(client);

  const record = await executedTx.getRecord(client);
  const receipt = await executedTx.getReceipt(client);

  const status = receipt.status;
  const proposalId = record.contractFunctionResult?.getUint256(0)!;
  console.log(`Proposal tx status ${status} with proposal id ${proposalId}`);

  return proposalId;
}

const vote = async (proposalId: BigNumber, voteId: number) => {
  console.log(`\nVote for proposal id ${proposalId} `);
  const contractFunctionParameters = new ContractFunctionParameters()
    .addUint256(proposalId)
    .addUint8(voteId);

  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("castVote", contractFunctionParameters)
    .setGas(900000)
    .freezeWith(treasurerClient);

  const executedTx = await tx.execute(treasurerClient);

  const response = await executedTx.getRecord(client);
  const receipt = await executedTx.getReceipt(treasurerClient);

  // const logs = await eventConsumer.getEventsFromRecord(response.contractFunctionResult?.logs, "VoteCast");
  // logs.forEach(log => {
  //   console.log(JSON.stringify(log));
  //});

  const status = receipt.status;

  console.log(`Vote tx status ${status} for proposal id ${response.contractFunctionResult?.getUint256(0)}`);
}

const execute = async (targets: Array<string>, ethFees: Array<number>, calls: Array<Uint8Array>, description: string) => {
  console.log(`\nExecuting  proposal - `);

  const contractFunctionParameters = new ContractFunctionParameters()
    .addAddressArray(targets)
    .addUint256Array(ethFees)
    .addBytesArray(calls)
    .addString(description);

  const contractAllotTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("execute", contractFunctionParameters)
    .setPayableAmount(new Hbar(70))
    .setMaxTransactionFee(new Hbar(70))
    .setGas(900000)
    .freezeWith(treasurerClient)// treasurer of token
    .sign(key);//Admin of token

  const executedTx = await contractAllotTx.execute(treasurerClient);

  const record = await executedTx.getRecord(treasurerClient);
  const contractAllotRx = await executedTx.getReceipt(treasurerClient);

  const status = contractAllotRx.status;

  console.log(`Execute tx status ${status} for proposal id ${record.contractFunctionResult?.getUint256(0)}`);
}

const transferTokenPublicCallData = async (tokenId: TokenId): Promise<Uint8Array> => {
  const contractJson = readFileContent("./artifacts/contracts/common/BaseHTS.sol/BaseHTS.json");
  const contractInterface = new ethers.utils.Interface(contractJson.abi);
  const sender = treasureId.toSolidityAddress();
  const receiver = adminId.toSolidityAddress();
  const callData = contractInterface.encodeFunctionData("transferTokenPublic", [tokenId.toSolidityAddress(), sender, receiver, 50]);
  return Buffer.from(callData, "hex");
}

const associateTokenPublicCallData = async (tokenId: TokenId): Promise<Uint8Array> => {
  const contractJson = readFileContent("./artifacts/contracts/common/BaseHTS.sol/BaseHTS.json");
  const contractInterface = new ethers.utils.Interface(contractJson.abi);

  const receiver = adminId.toSolidityAddress();
  const callData = contractInterface.encodeFunctionData("associateTokenPublic", [receiver, tokenId.toSolidityAddress()]);
  return ethers.utils.toUtf8Bytes(callData);;
}

const quorumReached = async (proposalId: BigNumber) => {
  console.log(`\nGetting quorumReached `);

  let contractFunctionParameters = new ContractFunctionParameters()
    .addUint256(proposalId);

  const contractTokenTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("quorumReached", contractFunctionParameters)
    .setGas(500000)
    .execute(client);

  const receipt = await contractTokenTx.getReceipt(client);
  const record = await contractTokenTx.getRecord(client);
  const status = record.contractFunctionResult!.getBool(0);

  console.log(`quorumReached tx status ${receipt.status} with quorumReached ${status}`);
}

const voteSucceeded = async (proposalId: BigNumber) => {
  console.log(`\nvoteSucceeded `);

  let contractFunctionParameters = new ContractFunctionParameters()
    .addUint256(proposalId);

  const contractTokenTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("voteSucceeded", contractFunctionParameters)
    .setGas(500000)
    .execute(client);

  const receipt =  await contractTokenTx.getReceipt(client);
  const record = await contractTokenTx.getRecord(client);
  const status = record.contractFunctionResult!.getBool(0);

  console.log(`voteSucceeded tx status ${receipt.status} with status ${status}`);
}

const proposalVotes = async (proposalId: BigNumber) => {
  console.log(`\nGetting proposalVotes - `);

  let contractFunctionParameters = new ContractFunctionParameters()
    .addUint256(proposalId);

  const contractTokenTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("proposalVotes", contractFunctionParameters)
    .setGas(500000)
    .execute(client);

  const receipt = await contractTokenTx.getReceipt(client);
  const record = await contractTokenTx.getRecord(client);
  const against = record.contractFunctionResult!.getInt256(0);
  const forVote = record.contractFunctionResult!.getInt256(1);
  const abstain = record.contractFunctionResult!.getInt256(2);

  console.log(`proposalVotes tx status ${receipt.status}, Votes detail - against ${against}  forVote ${forVote}  abstain ${abstain}`);
}


const state = async (proposalId: BigNumber) => {
  console.log(`\nGet state `);

  let contractFunctionParameters = new ContractFunctionParameters()
    .addUint256(proposalId);

  const contractTokenTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("state", contractFunctionParameters)
    .setGas(500000)
    .execute(client);

  const receipt = await contractTokenTx.getReceipt(client);
  const record = await contractTokenTx.getRecord(client);
  const state = record.contractFunctionResult!.getInt256(0);

  console.log(`state tx status ${receipt.status}, state ${state} `);
}

async function main() {
  console.log(`\nUsing governor proxy contract id ${contractId}`);
  //const tokenId = await createToken();
  const tokenId = TokenId.fromString("0.0.48602743");
  //await initialize(tokenId);

  const targets = [htsServiceAddress];
  const ethFees = [0];
  const associateToken = await associateTokenPublicCallData(tokenId);
  const calls = [associateToken];
  const description = "Create token proposal 1";

  const proposalId = await propose(targets, ethFees, calls, description);
  await vote(proposalId, 1);//1 is for vote. 
  await quorumReached(proposalId);
  await voteSucceeded(proposalId);
  await proposalVotes(proposalId);
  await state(proposalId);
  console.log(`\nWaiting for voting period to get over.`);
  await new Promise(f => setTimeout(f, 15 * 1000));//Wait till waiting period is over. It's current deadline as per Governance. 
  await state(proposalId);//4 means succeeded
  await execute(targets, ethFees, calls, description);
  console.log(`\nDone`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
