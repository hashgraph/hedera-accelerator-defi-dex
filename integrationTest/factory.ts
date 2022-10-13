import { BigNumber } from "bignumber.js";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  TokenId,
  AccountBalanceQuery,
  Hbar,
  AccountId
} from "@hashgraph/sdk";

import ClientManagement from "./utils/utils";
import { ContractService } from "../deployment/service/ContractService";

const clientManagement = new ClientManagement();
const client = clientManagement.createClientAsAdmin();
const opclient = clientManagement.createOperatorClient();
const {treasureId, treasureKey} = clientManagement.getTreasure();
const contractService = new ContractService();
const adminId = AccountId.fromString(process.env.ADMIN_ID!);

const tokenA = TokenId.fromString("0.0.48289687").toSolidityAddress();
let tokenB = TokenId.fromString("0.0.48289686").toSolidityAddress();
const tokenC = TokenId.fromString("0.0.48301281").toSolidityAddress();
let tokenD = TokenId.fromString("0.0.48301282").toSolidityAddress();
const tokenE = TokenId.fromString("0.0.48301300").toSolidityAddress();
let tokenF = TokenId.fromString("0.0.48301322").toSolidityAddress();

const pairContractIds = contractService.getContract(contractService.pairContractName);
const lpContractIds = contractService.getLast3Contracts(contractService.lpTokenContractName);
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

  console.log(` getPrecisionValue ${precision}`);
};

const initialize = async (contractId: string, htsServiceAddress: string, lpTokenContractAddress: string ) => {
  const initialize = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(2000000)
    .setFunction(
      "initialize",
      new ContractFunctionParameters()
        .addAddress(htsServiceAddress)
        .addAddress(lpTokenContractAddress)
    )
    .freezeWith(client)
    .sign(treasureKey);
  const initializeTx = await initialize.execute(client);
  const initializeTxRx = await initializeTx.getReceipt(client);
  console.log(`Initialized status : ${initializeTxRx.status}`);
};

const setupFactory = async () => {

    console.log(`\n STEP 1 - Set Static Pairs for now in Contract`);
    let contractFunctionParameters = new ContractFunctionParameters()
                                          .addAddress(baseContract.address)
    const contractSetPairsTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("setUpFactory", contractFunctionParameters)
      .setGas(9000000)
      .execute(opclient);
    const contractSetPairRx = await contractSetPairsTx.getReceipt(client);
    const response = await contractSetPairsTx.getRecord(client);
    const status = contractSetPairRx.status;
    console.log(`\n setupFactory Result ${status} code: ${response.contractFunctionResult!.getAddress()}`);
};

const createPair = async (contractId: string, token0: string, token1: string) => {
  
  console.log(
    `createPair TokenA TokenB`
  );
  const addLiquidityTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9000000)
    .setFunction(
      "createPair",
      new ContractFunctionParameters()
        .addAddress(tokenA)
        .addAddress(tokenB)
    )
    .setMaxTransactionFee(new Hbar(100))
    .setPayableAmount(new Hbar(100))
    .freezeWith(opclient)
    .sign(treasureKey);

  const addLiquidityTxRes = await addLiquidityTx.execute(opclient);
  const transferTokenRx = await addLiquidityTxRes.getReceipt(opclient);

  console.log(`CreatePair status: ${transferTokenRx.status}`);
};

const getAllPairs = async (contractId: string, token0: string, token1: string) => {
  console.log(
    `getAllPairs`
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
    .freezeWith(opclient)
  const liquidityPoolTx = await liquidityPool.execute(opclient);
  const response = await liquidityPoolTx.getRecord(opclient);
   console.log(`getPairs: ${response.contractFunctionResult!.getAddress(0)}`);
  const transferTokenRx = await liquidityPoolTx.getReceipt(opclient);
  console.log(`getPairs: ${transferTokenRx.status}`);
};

const initialaizePair = async (contractId: string, token0: string, token1: string) => {
  const tokenAQty = withPrecision(200);
  const tokenBQty = withPrecision(220);
  const fees = withPrecision(5);
  console.log(
    `Creating a pool of ${tokenAQty} units of token A and ${tokenBQty} units of token B.`
  );
  const liquidityPool = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9900000)
    .setFunction(
      "initializePairContract",
      new ContractFunctionParameters()
        .addAddress(treasureId.toSolidityAddress())
        .addAddress(token0)
        .addAddress(token1)
        .addInt256(tokenAQty)
        .addInt256(tokenBQty)
        .addInt256(fees)
    )
    .freezeWith(opclient)
    .sign(treasureKey);
  const liquidityPoolTx = await liquidityPool.execute(opclient);
  const transferTokenRx = await liquidityPoolTx.getReceipt(opclient);
  console.log(`Liquidity pool created: ${transferTokenRx.status}`);
};

const initialaizePairContract = async (contractId: string, token0: string, token1: string) => {
  const tokenAQty = withPrecision(200);
  const tokenBQty = withPrecision(220);
  const fees = withPrecision(5);
  console.log(
    `Creating a pool of ${tokenAQty} units of token A and ${tokenBQty} units of token B.`
  );
  const liquidityPool = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9900000)
    .setFunction(
      "initializeContract",
      new ContractFunctionParameters()
        .addAddress(treasureId.toSolidityAddress())
        .addAddress(token0)
        .addAddress(token1)
        .addInt256(tokenAQty)
        .addInt256(tokenBQty)
        .addInt256(fees)
    )
    .freezeWith(opclient)
    .sign(treasureKey);
  const liquidityPoolTx = await liquidityPool.execute(opclient);
  const transferTokenRx = await liquidityPoolTx.getReceipt(opclient);
  console.log(`Liquidity pool created: ${transferTokenRx.status}`);
};

const addLiquidity = async (contractId: string, token0: string, token1: string) => {
  const tokenAQty = new BigNumber(10);
  const tokenBQty = new BigNumber(10);
  console.log(
    `Adding ${tokenAQty} units of token A and ${tokenBQty} units of token B to the pool.`
  );
  const addLiquidityTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9000000)
    .setFunction(
      "addLiquidity",
      new ContractFunctionParameters()
        .addAddress(treasureId.toSolidityAddress())
        .addAddress(tokenA)
        .addAddress(tokenB)
        .addInt256(tokenAQty)
        .addInt256(tokenBQty)
    )
    .setMaxTransactionFee(new Hbar(100))
    .freezeWith(opclient)
    .sign(treasureKey);

  const addLiquidityTxRes = await addLiquidityTx.execute(opclient);
  const transferTokenRx = await addLiquidityTxRes.getReceipt(opclient);

  console.log(`Liquidity added status: ${transferTokenRx.status}`);
};

const removeLiquidity = async (contractId: string, token0: string, token1: string) => {
  const lpToken = new BigNumber(5);
  const tokenBQty = new BigNumber(1);
  console.log(`Removing ${lpToken} units of LPToken from the pool.`);
  const removeLiquidity = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9900000)
    .setFunction(
      "removeLiquidity",
      new ContractFunctionParameters()
        .addAddress(treasureId.toSolidityAddress())
        .addAddress(token1)
        .addAddress(token0)
        .addInt256(lpToken)
    )
    .freezeWith(client)
    .sign(treasureKey);
  const removeLiquidityTx = await removeLiquidity.execute(client);
  const transferTokenRx = await removeLiquidityTx.getReceipt(client);

  console.log(`Liquidity remove status: ${transferTokenRx.status}`);
};

const swapTokenA = async (contractId: string, token0: string, token1: string) => {
  const tokenAQty = new BigNumber(5);
  const tokenBQty = new BigNumber(0);
  console.log(`Swapping a ${tokenAQty} units of token A from the pool.`);
  // Need to pass different token B address so that only swap of token A is considered.
  //token1 = TokenId.fromString("0.0.47646100").toSolidityAddress();
  console.log(`Token A: ${token0} Token1: ${token1}`)
  const swapToken = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9000000)
    .setFunction(
      "swapToken",
      new ContractFunctionParameters()
        .addAddress(treasureId.toSolidityAddress())
        .addAddress(token0)
        .addAddress(token1)
        .addInt256(tokenAQty)
        .addInt256(tokenBQty)
    )
    .freezeWith(client)
    .sign(treasureKey);
  const swapTokenTx = await swapToken.execute(client);
  const transferTokenRx = await swapTokenTx.getReceipt(client);

  console.log(`Swap status: ${transferTokenRx.status}`);
};

const getTreaserBalance = async () => {
  const treasureBalance1 = await new AccountBalanceQuery()
      .setAccountId(treasureId)
      .execute(client);
  console.log(`Treasure LP Token Balance: ${treasureBalance1.tokens}`); //2 Sep 01:02 pm
}

async function main() {
  // await initialize(pairContractIds[0].id, baseContract.address , lpContractIds[0].address);
  // await initialize(pairContractIds[1].id, baseContract.address , lpContractIds[1].address);
  // await initialize(pairContractIds[2].id, baseContract.address , lpContractIds[2].address);
  // await getPrecisionValue(pairContractIds[0].id);
  // await createLiquidityPool(pairContractIds[0].id, tokenA, tokenB)
  // await createLiquidityPool(pairContractIds[1].id, tokenC, tokenD)
  // await createLiquidityPool(pairContractIds[2].id, tokenE, tokenF)
   await setupFactory();
   await testForSinglePair(contractId, tokenA, tokenB);
  // await testForSinglePair(contractId, tokenC, tokenD);
  // await testForSinglePair(contractId, tokenE, tokenF);
}

async function testForSinglePair(contractId: string, token0: string, token1: string) {
  // await getTreaserBalance();
  await createPair(contractId, token0, token1);
  // await getAllPairs(contractId, token0, token1);
  await initialaizePair(contractId, token0, token1);
  //await initialaizePairContract("0x0cd4fab0b5915c1fb9778b795de99a53b20e1047", token0, token1);
  //await addLiquidity(contractId, token0, token1);
  // await removeLiquidity(contractId, token0, token1);
  // await swapTokenA(contractId, token0, token1);
  // await getTreaserBalance();
  // await getTreaserBalance();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
