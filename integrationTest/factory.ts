import { BigNumber } from "bignumber.js";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  TokenId,
  AccountBalanceQuery,
  Hbar,
  AccountId,
} from "@hashgraph/sdk";

import { Helper } from "../utils/Helper";
import { ContractService } from "../deployment/service/ContractService";
import { httpRequest } from "../deployment/api/HttpsService";
import * as fs from "fs";
import ClientManagement from "../utils/ClientManagement";
import dex from "../deployment/model/dex";

const clientManagement = new ClientManagement();
const client = clientManagement.createOperatorClient();
const treasureClient = clientManagement.createClient();
const { treasureId, treasureKey } = clientManagement.getTreasure();
const { id } = clientManagement.getOperator();
const contractService = new ContractService();

const tokenA = TokenId.fromString(dex.TOKEN_LAB49_1);
const tokenB = TokenId.fromString(dex.TOKEN_LAB49_2);
const tokenC = TokenId.fromString(dex.TOKEN_LAB49_3);
const tokenGOD = TokenId.fromString(dex.GOD_TOKEN_ID);
const tokenHBARX = TokenId.fromString(dex.HBARX_TOKEN_ID);

const baseContract = contractService.getContract(
  contractService.baseContractName
);
const contractId = contractService.getContractWithProxy(
  contractService.factoryContractName
).transparentProxyId!;

let precision = 100000000;

const withPrecision = (value: number): BigNumber => {
  return new BigNumber(value).multipliedBy(precision);
};

const setupFactory = async () => {
  console.log(`\nSetupFactory`);
  const dexOwnerId = clientManagement.getDexOwner().id;
  const contractFunctionParameters = new ContractFunctionParameters()
    .addAddress(baseContract.address)
    .addAddress(dexOwnerId.toSolidityAddress());
  const contractTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("setUpFactory", contractFunctionParameters)
    .setGas(9000000)
    .execute(client);
  const receipt = await contractTx.getReceipt(client);
  const response = await contractTx.getRecord(client);
  const status = receipt.status;
  console.log(
    `\nSetupFactory Result ${status} code: ${response.contractFunctionResult!.getAddress()}`
  );
};

const createPair = async (
  contractId: string,
  token0: TokenId,
  token1: TokenId
) => {
  console.log(`createPair TokenA TokenB`);
  const createPairTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9000000)
    .setFunction(
      "createPair",
      new ContractFunctionParameters()
        .addAddress(token0.toSolidityAddress())
        .addAddress(token1.toSolidityAddress())
        .addAddress(id.toSolidityAddress())
        .addInt256(new BigNumber(10))
    )
    .setMaxTransactionFee(new Hbar(100))
    .setPayableAmount(new Hbar(100))
    .freezeWith(client)
    .sign(treasureKey);

  const createPairTxRes = await createPairTx.execute(client);
  const receipt = await createPairTxRes.getReceipt(client);
  const record = await createPairTxRes.getRecord(client);
  const contractAddress = record.contractFunctionResult!.getAddress(0);
  console.log(`CreatePair address: ${contractAddress}`);
  console.log(`CreatePair status: ${receipt.status}`);
  return contractAddress;
};

const getPair = async (
  contractId: string,
  token0: TokenId,
  token1: TokenId
) => {
  console.log(`get Pair`);
  const getPairTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9999999)
    .setFunction(
      "getPair",
      new ContractFunctionParameters()
        .addAddress(token0.toSolidityAddress())
        .addAddress(token1.toSolidityAddress())
    )
    .freezeWith(client);
  const executedTx = await getPairTx.execute(client);
  const response = await executedTx.getRecord(client);
  console.log(`getPair: ${response.contractFunctionResult!.getAddress(0)}`);
  const receiptRx = await executedTx.getReceipt(client);
  console.log(`getPair: ${receiptRx.status}`);
  return `0x${response.contractFunctionResult!.getAddress(0)}`;
};

const getAllPairs = async (contractId: string) => {
  console.log(`getAllPairs`);
  const getAllPairsTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9999999)
    .setFunction("getPairs")
    .freezeWith(client);

  const executedTx = await getAllPairsTx.execute(client);
  const response = await executedTx.getRecord(client);

  console.log(
    `getPairs Count: ${response.contractFunctionResult!.getUint256(1)}`
  );
  const modifiedArray = Helper.getAddressArray(
    response.contractFunctionResult!
  );
  console.log(`get all pair Address: ${modifiedArray}`);

  const receipt = await executedTx.getReceipt(client);
  console.log(`getPairs: ${receipt.status}`);
};

const addLiquidity = async (
  contId: string,
  token0: TokenId,
  token1: TokenId
) => {
  const tokenAQty = withPrecision(2.1);
  const tokenBQty = withPrecision(2.3);
  console.log(
    `Adding ${tokenAQty} units of token A and ${tokenBQty} units of token B to the pool.`
  );
  let params = new ContractFunctionParameters()
    .addAddress(treasureId.toSolidityAddress())
    .addAddress(token0.toSolidityAddress())
    .addAddress(token1.toSolidityAddress())
    .addInt256(token0 == tokenHBARX ? new BigNumber(0) : tokenAQty)
    .addInt256(token1 == tokenHBARX ? new BigNumber(0) : tokenBQty);

  const addLiquidityMutableTx = new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(9000000)
    .setFunction("addLiquidity", params);
  const hbar =
    token0 == tokenHBARX
      ? new Hbar(2.1)
      : token1 == tokenHBARX
      ? new Hbar(2.3)
      : new Hbar(0);
  addLiquidityMutableTx.setPayableAmount(hbar);

  const addLiquidityTx = await addLiquidityMutableTx
    .freezeWith(client)
    .sign(treasureKey);

  const addLiquidityTxRes = await addLiquidityTx.execute(client);
  const receipt = await addLiquidityTxRes.getReceipt(client);

  console.log(`Liquidity added status: ${receipt.status}`);
};

const removeLiquidity = async (contId: string) => {
  const lpToken = withPrecision(0.05);
  console.log(`Removing ${lpToken} units of LPToken from the pool.`);
  const removeLiquidity = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(9000000)
    .setFunction(
      "removeLiquidity",
      new ContractFunctionParameters()
        .addAddress(treasureId.toSolidityAddress())
        .addInt256(lpToken)
    )
    .freezeWith(client)
    .sign(treasureKey);
  const removeLiquidityTx = await removeLiquidity.execute(client);
  const receipt = await removeLiquidityTx.getReceipt(client);

  console.log(`Liquidity remove status: ${receipt.status}`);
};

const swapToken = async (contId: string, token: TokenId) => {
  const tokenQty = withPrecision(0.01);
  console.log(`Swapping a ${tokenQty} units of token A from the pool.`);
  const swapToken = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(5000000)
    .setFunction(
      "swapToken",
      new ContractFunctionParameters()
        .addAddress(treasureId.toSolidityAddress())
        .addAddress(token.toSolidityAddress())
        .addInt256(token == tokenHBARX ? BigNumber(0) : tokenQty)
    )
    .setPayableAmount(token == tokenHBARX ? new Hbar(0.01) : new Hbar(0))
    .freezeWith(client)
    .sign(treasureKey);

  const swapTokenTx = await swapToken.execute(client);
  const receipt = await swapTokenTx.getReceipt(client);

  console.log(`Swap status: ${receipt.status}`);
};

const getTokenPairAddress = async (contId: string) => {
  const getTokensTxReq = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(2000000)
    .setFunction("getTokenPairAddress")
    .freezeWith(client)
    .sign(treasureKey);
  const getTokensTx = await getTokensTxReq.execute(client);
  const record = await getTokensTx.getRecord(client);
  const newToken0 = record.contractFunctionResult!.getAddress(0);
  const newToken1 = record.contractFunctionResult!.getAddress(1);
  console.log(
    `- Addresses for Token0 : ${newToken0} & Token1 : ${newToken1}\nlp token: ${record.contractFunctionResult!.getAddress(
      2
    )} `
  );
};

const getTreasureBalance = async (tokens: Array<TokenId>) => {
  const treasureBalanceTx = await new AccountBalanceQuery()
    .setAccountId(treasureId)
    .execute(client);
  const responseTokens = treasureBalanceTx.tokens ?? new Map<TokenId, Long>();
  tokens.forEach((token) =>
    console.log(
      ` Treasure Token Balance for ${token.toString()}: ${responseTokens.get(
        token
      )}`
    )
  );
};

async function main() {
  try {
    await setupFactory();
  } catch (error) {
    console.error(error);
  }

  await testForSinglePair(contractId, tokenB, tokenHBARX);
  await testForSinglePair(contractId, tokenB, tokenC);
  await testForSinglePair(contractId, tokenA, tokenGOD);
}

async function testForSinglePair(
  contractId: string,
  token0: TokenId,
  token1: TokenId
) {
  await createPair(contractId, token0, token1);
  await getAllPairs(contractId);
  const pairAddress = await getPair(contractId, token0, token1);

  const response = await httpRequest(pairAddress, undefined);
  const pairContractId = response.contract_id;
  console.log(`contractId: ${pairContractId}`);
  await getTreasureBalance([token0, token1]);
  await getTokenPairAddress(pairContractId);
  await addLiquidity(pairContractId, token0, token1);
  await getTreasureBalance([token0, token1]);
  await removeLiquidity(pairContractId);
  await swapToken(pairContractId, token0);
  await swapToken(pairContractId, token1);
  await getTreasureBalance([token0, token1]);
  await swapToken(pairContractId, token1);
  await getTreasureBalance([token0, token1]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
