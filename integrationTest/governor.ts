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

const treasurerClient = clientManagement.createClient();
const { treasureId, treasureKey } = clientManagement.getTreasure();

const htsServiceAddress = contractService.getContract(
  contractService.baseContractName
).address;

const contractId = contractService.getContractWithProxy(
  contractService.governorContractName
).transparentProxyId!;

const factoryContractId = ContractId.fromString(
  contractService.getContractWithProxy(contractService.factoryContractName)
    .transparentProxyId!
);

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
  description: string
) => {
  console.log(`\nExecuting  proposal - `);

  const contractFunctionParameters = new ContractFunctionParameters()
    .addString(description);

  const contractAllotTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("executeProposal", contractFunctionParameters)
    .setPayableAmount(new Hbar(100))
    .setMaxTransactionFee(new Hbar(100))
    .setGas(9000000)
    .freezeWith(treasurerClient)// treasurer of token
    .sign(key);//Admin of token

  const executedTx = await contractAllotTx.execute(treasurerClient);

  const record = await executedTx.getRecord(treasurerClient);
  const contractAllotRx = await executedTx.getReceipt(treasurerClient);

  const status = contractAllotRx.status;

  console.log(
    `Execute tx status ${status} for proposal id ${record.contractFunctionResult?.getUint256(
      0
    )}`
  );
};

const transferTokenPublicCallData = async (
  tokenId: TokenId
): Promise<Uint8Array> => {
  const contractJson = readFileContent(
    "./artifacts/contracts/common/BaseHTS.sol/BaseHTS.json"
  );
  const contractInterface = new ethers.utils.Interface(contractJson.abi);
  const sender = treasureId.toSolidityAddress();
  const receiver = adminId.toSolidityAddress();
  const callData = contractInterface.encodeFunctionData("transferTokenPublic", [
    tokenId.toSolidityAddress(),
    sender,
    receiver,
    50,
  ]);
  return Buffer.from(callData, "hex");
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

const setupFactory = async () => {
  console.log(`\nSetupFactory`);
  const baseContract = contractService.getContract(
    contractService.baseContractName
  );
  let contractFunctionParameters = new ContractFunctionParameters().addAddress(
    baseContract.address
  );
  const contractFactoryTx = await new ContractExecuteTransaction()
    .setContractId(factoryContractId)
    .setFunction("setUpFactory", contractFunctionParameters)
    .setGas(9000000)
    .execute(client);
  const receipt = await contractFactoryTx.getReceipt(client);
  const response = await contractFactoryTx.getRecord(client);
  const status = receipt.status;
  console.log(
    `\nSetupFactory Result ${status} code: ${response.contractFunctionResult!.getAddress()}`
  );
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

const getAllPairs = async (): Promise<string> => {
  console.log(`getAllPairs`);
  const allPairs = await new ContractExecuteTransaction()
    .setContractId(factoryContractId)
    .setGas(9999999)
    .setFunction("getPairs", new ContractFunctionParameters())
    .freezeWith(client);
  const allPairsTx = await allPairs.execute(client);
  const record = await allPairsTx.getRecord(client);
  console.log(`getPairs: ${record.contractFunctionResult!.getAddress(0)}`);
  const transferTokenRx = await allPairsTx.getReceipt(client);
  console.log(`getPairs: ${transferTokenRx.status}`);
  return record.contractFunctionResult!.getAddress(0);
};

const upgradeTo = async (newImplementation: string) => {
  const upgradeTo = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(2000000)
    .setFunction(
      "upgradeTo",
      new ContractFunctionParameters().addAddress(newImplementation)
    )
    .freezeWith(client)
    .sign(adminKey);
  const upgradeToTx = await upgradeTo.execute(client);
  const receipt = await upgradeToTx.getReceipt(client);
  console.log(`upgradedTo: ${receipt.status}`);
};

const getTokenPairAddress = async (contId: string) => {
  const getPairAddresses = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(1000000)
    .setFunction("getTokenPairAddress")
    .freezeWith(client);
  const getPairAddressesTx = await getPairAddresses.execute(client);
  const response = await getPairAddressesTx.getRecord(client);
  const tokenAAddress = response.contractFunctionResult!.getAddress(0);
  const tokenBAddress = response.contractFunctionResult!.getAddress(1);
  console.log(
    ` ${tokenAAddress} address of token A and ${tokenBAddress} address of token B are present in the pool. \n`
  );
  const tokenAQty = response.contractFunctionResult!.getInt256(0);
  const tokenBQty = response.contractFunctionResult!.getInt256(1);
  console.log(
    ` ${tokenAQty} units of token A and ${tokenBQty} units of token B are present in the pool. \n`
  );
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
  const tokenId = TokenId.fromString("0.0.48602743");
  await initialize(tokenId);
  const description = "Create token proposal 1";

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
  await execute(description);
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
