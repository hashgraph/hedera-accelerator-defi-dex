import { BigNumber } from "bignumber.js";
import * as fs from "fs";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
  ContractId,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
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
const {adminId, adminKey} = clientManagement.getAdmin();

const treasurerClient = clientManagement.createClient();
const { treasureId, treasureKey } = clientManagement.getTreasure();

const htsServiceAddress = contractService.getContract(contractService.baseContractName).address;

const contractId = contractService.getContractWithProxy(contractService.governorContractName).transparentProxyId!;

const factoryContractId = ContractId.fromString(
  contractService.getContractWithProxy(
      contractService.factoryContractName
  ).transparentProxyId!
);

const readFileContent = (filePath: string) => {
  const rawdata: any = fs.readFileSync(filePath);
  return JSON.parse(rawdata);
};

const initialize = async (tokenId: TokenId) => {
  console.log(`\nInitialize contract with token  `);
  const tokenName = "Governance Hedera Open DEX";
  const tokenSymbol = "GOD";
  const votingDelay = 0;
  const votingPeriod = 12;

  let contractFunctionParameters = new ContractFunctionParameters()
    .addAddress(tokenId.toSolidityAddress())// token that define the voting weight, to vote user should have % of this token.
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
  
  console.log(
    `quorumReached tx status ${receipt.status}}`
  );
  return {tokenAddress};
};

const setupFactory = async () => {
  console.log(`\nSetupFactory`);
  const baseContract = contractService.getContract(contractService.baseContractName);
  let contractFunctionParameters = new ContractFunctionParameters()
                                        .addAddress(baseContract.address)
  const contractSetPairsTx = await new ContractExecuteTransaction()
    .setContractId(factoryContractId)
    .setFunction("setUpFactory", contractFunctionParameters)
    .setGas(9000000)
    .execute(client);
  const contractSetPairRx = await contractSetPairsTx.getReceipt(client);
  const response = await contractSetPairsTx.getRecord(client);
  const status = contractSetPairRx.status;
  console.log(`\nSetupFactory Result ${status} code: ${response.contractFunctionResult!.getAddress()}`);
};

const createPair = async (contractId: string | ContractId, token0: string, token1: string) => {
  
  console.log(
    `createPair TokenA TokenB`
  );
  const addLiquidityTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9000000)
    .setFunction(
      "createPair",
      new ContractFunctionParameters()
        .addAddress(token0)
        .addAddress(token1)
    )
    .setMaxTransactionFee(new Hbar(100))
    .setPayableAmount(new Hbar(100))
    .freezeWith(client)
    .sign(treasureKey);

  const addLiquidityTxRes = await addLiquidityTx.execute(client);
  const transferTokenRx = await addLiquidityTxRes.getReceipt(client);
  const transferTokenRecord = await addLiquidityTxRes.getRecord(client);
  const contractAddress = transferTokenRecord.contractFunctionResult!.getAddress(0);
  console.log(`CreatePair address: ${contractAddress}`);
  console.log(`CreatePair status: ${transferTokenRx.status}`);
  return contractAddress;
  //return `0x${contractAddress}`;
};

const getAllPairs = async (): Promise<string> => {
  console.log(
    `getAllPairs`
  );
  const liquidityPool = await new ContractExecuteTransaction()
    .setContractId(factoryContractId)
    .setGas(9999999)
    .setFunction(
      "getPairs",
      new ContractFunctionParameters()
    )
    .freezeWith(client)
  const liquidityPoolTx = await liquidityPool.execute(client);
  const response = await liquidityPoolTx.getRecord(client);
   console.log(`getPairs: ${response.contractFunctionResult!.getAddress(0)}`);
  const transferTokenRx = await liquidityPoolTx.getReceipt(client);
  console.log(`getPairs: ${transferTokenRx.status}`);
  return response.contractFunctionResult!.getAddress(0);
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
      .freezeWith(client)
      .sign(adminKey);
    const liquidityPoolTx = await liquidityPool.execute(client);
    const transferTokenRx = await liquidityPoolTx.getReceipt(client);
    console.log(`upgradedTo: ${transferTokenRx.status}`);
};

const getTokenPairAddress = async (contId: string) => {
  const getPairQty = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(1000000)
    .setFunction("getTokenPairAddress")
    .freezeWith(client);
  const getPairQtyTx = await getPairQty.execute(client);
  const response = await getPairQtyTx.getRecord(client);
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
  // return [tokenAAddress, tokenBAddress];
};

const getPair = async (contractId: string | ContractId, token0: string, token1: string) => {
  console.log(
    `get Pair`
  );
  const liquidityPool = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9999999)
    .setFunction(
      "getPair",
      new ContractFunctionParameters()
      .addAddress(token0)
      .addAddress(token1)
    )
    .freezeWith(client)
  const liquidityPoolTx = await liquidityPool.execute(client);
  const response = await liquidityPoolTx.getRecord(client);
   console.log(`getPair: ${response.contractFunctionResult!.getAddress(0)}`);
  const transferTokenRx = await liquidityPoolTx.getReceipt(client);
  console.log(`getPair: ${transferTokenRx.status}`);
  return `0x${response.contractFunctionResult!.getAddress(0)}`;
};

async function createPairFromFactory(tokenAddress: string) {
  const GODToken = tokenAddress;
  await setupFactory();
  const tokenA = TokenId.fromString("0.0.48289687");
  await createPair(factoryContractId, GODToken, tokenA.toSolidityAddress());

  const pairAddress = await getPair(factoryContractId, GODToken, tokenA.toSolidityAddress());

  const response = await httpRequest(pairAddress, undefined);
  const pairContractId = response.contract_id;
  console.log(`contractId: ${pairContractId}`)
}

async function main() {
  console.log(`\nUsing governor proxy contract id ${contractId}`);
  const tokenId = TokenId.fromString("0.0.48602743");
  await initialize(tokenId);

  const targets = [htsServiceAddress];
  const ethFees = [0];
  const associateToken = await associateTokenPublicCallData(tokenId);
  const calls = [associateToken];
  const description = "Create token proposal 8";

  const proposalId = await governor.propose(targets, ethFees, calls, description, contractId);
  await governor.vote(proposalId, 1, contractId);//1 is for vote. 
  await quorumReached(proposalId);
  await governor.voteSucceeded(proposalId, contractId);
  await governor.proposalVotes(proposalId, contractId);
  await governor.state(proposalId, contractId);
  console.log(`\nWaiting for voting period to get over.`);
  await new Promise(f => setTimeout(f, 15 * 1000));//Wait till waiting period is over. It's current deadline as per Governance. 
  await governor.state(proposalId, contractId);//4 means succeeded
  await execute(targets, ethFees, calls, description);
  const tokenAddress = await fetchNewTokenAddresses(proposalId);
  console.log(tokenAddress.tokenAddress);

  await createPairFromFactory(tokenAddress.tokenAddress);
  
  // upgradeToProxy
  const contractName = process.env.CONTRACT_NAME!.toLowerCase();
  const contractGettingUpgraded = contractService.getContract(contractName);
  await upgradeTo(contractGettingUpgraded.address);

  console.log(`\nDone`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
