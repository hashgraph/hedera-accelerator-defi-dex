import { BigNumber } from "bignumber.js";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
} from "@hashgraph/sdk";

import ClientManagement from "./utils/utils";
import { ContractService } from "../deployment/service/ContractService";

const clientManagement = new ClientManagement();
const contractService = new ContractService();
let client = clientManagement.createOperatorClient();
const {key} = clientManagement.getOperator();
client = client.setDefaultMaxTransactionFee(new Hbar(100));

const htsServiceAddress = contractService.getContract(contractService.baseContractName).address;
const {treasureId, treasureKey} = clientManagement.getTreasure();

const contracts = [contractService.getContractWithProxy(contractService.lpTokenContractName)];

const precision = 10000000;

const initialize = async (contId: string) => {
  console.log(`Initialize contract with token  `);

  let contractFunctionParameters = new ContractFunctionParameters()
    .addAddress(htsServiceAddress);

  const contractTokenTx = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setFunction("initialize", contractFunctionParameters)
    .setGas(500000)
    .setMaxTransactionFee(new Hbar(50))
    .setPayableAmount(new Hbar(60))
    .execute(client);
    
  await contractTokenTx.getReceipt(client);

  console.log(`Initialize contract with token done.`);
}

const allotLPTokenFor = async (contId: string) => {
    const tokenAQty = new BigNumber(10).multipliedBy(precision);
    const tokenBQty = new BigNumber(10).multipliedBy(precision);

    console.log(`allotLPTokenFor tokenAQty ${tokenAQty} tokenBQty ${tokenBQty}`);
  
    const contractFunctionParameters = new ContractFunctionParameters()
        .addInt256(tokenAQty)
        .addInt256(tokenBQty)
        .addAddress(treasureId.toSolidityAddress());

    const contractAllotTx = await new ContractExecuteTransaction()
        .setContractId(contId)
        .setFunction("allotLPTokenFor", contractFunctionParameters)
        .setGas(900000)
        .setMaxTransactionFee(new Hbar(50))
        .freezeWith(client);
    
    const signTx = await contractAllotTx.sign(treasureKey);//For associating a token to treasurer

    const executedTx = await contractAllotTx.execute(client);

    const response = await executedTx.getRecord(client);
    const contractAllotRx = await executedTx.getReceipt(client);
  
    const status = contractAllotRx.status;
    console.log(`allotLPTokenFor result ${status} code: ${response.contractFunctionResult!.getInt64()}`);
}

const removeLPTokenFor = async (contId: string) => {
  const lpTokenQty = new BigNumber(5).multipliedBy(precision);

  console.log(`removeLPTokenFor ${lpTokenQty}`);

  const contractFunctionParameters = new ContractFunctionParameters()
      .addInt256(lpTokenQty)
      .addAddress(treasureId.toSolidityAddress());
      
  const contractRemoveTx = await new ContractExecuteTransaction()
      .setContractId(contId)
      .setFunction("removeLPTokenFor", contractFunctionParameters)
      .setGas(3000000)
      .freezeWith(client)
      .sign(key);

  const signTx = await contractRemoveTx.sign(treasureKey);//For associating a token to treasurer

  const executeTx = await signTx.execute(client);
  const contractRemoveRx = await executeTx.getReceipt(client);
  const response = await executeTx.getRecord(client);
  const status = contractRemoveRx.status;
  console.log(`Remove LP Token ${status} code: ${response.contractFunctionResult!.getInt64()}`);
}

const getAllLPTokenCount = async(contId: string) => {

  console.log(`getAllLPTokenCount`);

  const contractFunctionParameters = new ContractFunctionParameters();
    
  const getAllLPTokenCountTx = await new ContractExecuteTransaction()
      .setContractId(contId)
      .setFunction("getAllLPTokenCount", contractFunctionParameters)
      .setGas(2000000)
      .freezeWith(client)
      .sign(key);

  const signTx = await getAllLPTokenCountTx.sign(treasureKey);//For associating a token to treasurer

  const executedTx = await signTx.execute(client);
  const executedRx = await executedTx.getReceipt(client);
  const response = await executedTx.getRecord(client);
  const status = executedRx.status;
  console.log(`getAllLPTokenCount code: ${response.contractFunctionResult!.getInt256()}`);
}

const lpTokenForUser = async(contId: string) => {

  console.log(`lpTokenForUser`);

  const contractFunctionParameters = new ContractFunctionParameters()
    .addAddress(treasureId.toSolidityAddress());
    
  const lpTokenForUserTx = await new ContractExecuteTransaction()
      .setContractId(contId)
      .setFunction("lpTokenForUser", contractFunctionParameters)
      .setGas(2000000)
      .freezeWith(client)
      .sign(key);

  const executedTx = await lpTokenForUserTx.execute(client);
  const executedRx = await executedTx.getReceipt(client);
  const response = await executedTx.getRecord(client);
  const status = executedRx.status;
  console.log(`lpTokenForUser code: ${response.contractFunctionResult!.getInt256()}`);
}

const getLpTokenAddress = async (contId: string) => {
  const getLpTokenAddressTx = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(1000000)
    .setFunction("getLpTokenAddress",
      new ContractFunctionParameters())
    .freezeWith(client);
  const executedTx = await getLpTokenAddressTx.execute(client);
  const response = await executedTx.getRecord(client);
  const address = response.contractFunctionResult!.getAddress(0);

  console.log(`Lp token address ${address}`);
};

async function main() {
  for(const contract of contracts) {
    console.log(`Testing contract .............\n`);
    await forSingleContract(contract.transparentProxyId!);
  }
}

async function forSingleContract(contractId: string) {
  await initialize(contractId);
  await getLpTokenAddress(contractId);
  await allotLPTokenFor(contractId);
  await removeLPTokenFor(contractId);
  await getAllLPTokenCount(contractId);
  await lpTokenForUser(contractId); 
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
