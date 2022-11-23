import { BigNumber } from "bignumber.js";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  TokenId,
  AccountBalanceQuery,
  Hbar
} from "@hashgraph/sdk";

import ClientManagement from "./utils/utils";
import { ContractService } from "../deployment/service/ContractService";
import { httpRequest } from "../deployment/api/HttpsService";

const clientManagement = new ClientManagement();
const client = clientManagement.createOperatorClient();
const {treasureId, treasureKey} = clientManagement.getTreasure();
const contractService = new ContractService();

const tokenA = TokenId.fromString("0.0.48289687")
let tokenB = TokenId.fromString("0.0.48289686")
const tokenC = TokenId.fromString("0.0.48301281").toSolidityAddress();
let tokenD = TokenId.fromString("0.0.48301282").toSolidityAddress();
const tokenE = TokenId.fromString("0.0.48301300").toSolidityAddress();
let tokenF = TokenId.fromString("0.0.48301322").toSolidityAddress();

const baseContract = contractService.getContract(contractService.baseContractName);
const contractId = contractService.getContractWithProxy(contractService.factoryContractName).transparentProxyId!; 

let precision = 10000000;

const withPrecision = (value: number): BigNumber => {
  return new BigNumber(value).multipliedBy(precision);
}

const getPrecisionValue = async (contractId: string) => {
  const getPrecisionValueTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(1000000)
    .setFunction("getPrecisionValue",
      new ContractFunctionParameters())
    .freezeWith(client);
  const getPrecisionValueTxRes = await getPrecisionValueTx.execute(client);
  const response = await getPrecisionValueTxRes.getRecord(client);
  const precisionLocal = response.contractFunctionResult!.getInt256(0);

  precision = Number(precisionLocal);

  console.log(`getPrecisionValue ${precision}`);
};

const setupFactory = async () => {
    console.log(`\nSetupFactory`);
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

const createPair = async (contractId: string, token0: string, token1: string) => {
  console.log(`createPair TokenA TokenB`);
  const addLiquidityTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9000000)
    .setFunction(
      "createPair",
      new ContractFunctionParameters()
        .addAddress(tokenA.toSolidityAddress())
        .addAddress(tokenB.toSolidityAddress())
        .addAddress(treasureId.toSolidityAddress())
        .addInt256(new BigNumber(10))
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

const getPair = async (contractId: string) => {
  console.log(
    `get Pair`
  );
  const liquidityPool = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9999999)
    .setFunction(
      "getPair",
      new ContractFunctionParameters()
      .addAddress(tokenA.toSolidityAddress())
      .addAddress(tokenB.toSolidityAddress())
    )
    .freezeWith(client)
  const liquidityPoolTx = await liquidityPool.execute(client);
  const response = await liquidityPoolTx.getRecord(client);
   console.log(`getPair: ${response.contractFunctionResult!.getAddress(0)}`);
  const transferTokenRx = await liquidityPoolTx.getReceipt(client);
  console.log(`getPair: ${transferTokenRx.status}`);
  return `0x${response.contractFunctionResult!.getAddress(0)}`;
};

const getAllPairs = async (contractId: string) => {
  console.log(
    `getAllPairs`
  );
  const liquidityPool = await new ContractExecuteTransaction()
    .setContractId(contractId)
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
};

const addLiquidity = async (contId: string) => {
  const tokenAQty = withPrecision(210);
  const tokenBQty = withPrecision(230);
  console.log(
    `Adding ${tokenAQty} units of token A and ${tokenBQty} units of token B to the pool.`
  );
  const addLiquidityTx = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(9000000)
    .setFunction(
      "addLiquidity",
      new ContractFunctionParameters()
        .addAddress(treasureId.toSolidityAddress())
        .addAddress(tokenA.toSolidityAddress())
        .addAddress(tokenB.toSolidityAddress())
        .addInt256(tokenAQty)
        .addInt256(tokenBQty)
    )
    .freezeWith(client)
    .sign(treasureKey);
  const addLiquidityTxRes = await addLiquidityTx.execute(client);
  const transferTokenRx = await addLiquidityTxRes.getReceipt(client);

  console.log(`Liquidity added status: ${transferTokenRx.status}`);
};

const removeLiquidity = async (contId: string) => {
  const lpToken = withPrecision(5);
  console.log(
    `Removing ${lpToken} units of LPToken from the pool.`
  );
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
  const transferTokenRx = await removeLiquidityTx.getReceipt(client);

  console.log(`Liquidity remove status: ${transferTokenRx.status}`);
};

const swapToken = async (contId: string, token: TokenId) => {
  const tokenQty = withPrecision(1);
  console.log(`Swapping a ${tokenQty} units of token A from the pool.`);
  // Need to pass different token B address so that only swap of token A is considered.
  const swapToken = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(2000000)
    .setFunction(
      "swapToken",
      new ContractFunctionParameters()
        .addAddress(treasureId.toSolidityAddress())
        .addAddress(token.toSolidityAddress())
        .addInt256(tokenQty)
    )
    .freezeWith(client)
    .sign(treasureKey);
  const swapTokenTx = await swapToken.execute(client);
  const transferTokenRx = await swapTokenTx.getReceipt(client);

  console.log(`Swap status: ${transferTokenRx.status}`);
};

const getTreasureBalance = async (tokens: Array<TokenId>) => {
  const treasureBalance1 = await new AccountBalanceQuery()
      .setAccountId(treasureId)
      .execute(client);
  const responseTokens = treasureBalance1.tokens ?? new Map<TokenId, Long>();
  tokens.forEach(token =>   console.log(` Treasure Token Balance for ${token.toString()}: ${responseTokens.get(token)}`));
}

async function main() {
    await setupFactory();
    await testForSinglePair(contractId, tokenA.toSolidityAddress(), tokenB.toSolidityAddress());
}

async function testForSinglePair(contractId: string, token0: string, token1: string) {
    await createPair(contractId, token0, token1);
    const pairAddress =  await getPair(contractId);
    
    const response = await httpRequest(pairAddress, undefined);
    const pairContractId = response.contract_id;
    console.log(`contractId: ${pairContractId}`)
    await getTreasureBalance([tokenA, tokenB]);
    await getTreasureBalance([tokenA, tokenB]);
    await addLiquidity(pairContractId);
    await getTreasureBalance([tokenA, tokenB]);
    await removeLiquidity(pairContractId);
    await swapToken(pairContractId, tokenA);
    await getTreasureBalance([tokenA, tokenB]);
    await swapToken(pairContractId, tokenB);
    await getTreasureBalance([tokenA, tokenB]);
    await getAllPairs(contractId);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

