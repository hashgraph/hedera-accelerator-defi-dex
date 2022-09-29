import { BigNumber } from "bignumber.js";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  TokenId,
  AccountBalanceQuery
} from "@hashgraph/sdk";

import ClientManagement from "./utils/utils";

const clientManagement = new ClientManagement();
const client = clientManagement.createClientAsAdmin();
const contractId = "0.0.48470738"; //29 Sep 15:10
const {treasureId, treasureKey} = clientManagement.getTreasure();

const htsServiceAddress = "0x0000000000000000000000000000000002e15051"; // 28 Sep sep 3:10
const lpTokenABContractAddress = "0x0000000000000000000000000000000002e377a0"; // 28 Sep sep 3:10
const lpTokenCDContractAddress = "0x0000000000000000000000000000000002e377a2"; // 28 Sep sep 3:10
const lpTokenEFContractAddress = "0x0000000000000000000000000000000002e377a4"; // 28 Sep sep 3:10

const tokenA = TokenId.fromString("0.0.48289687").toSolidityAddress();
let tokenB = TokenId.fromString("0.0.48289686").toSolidityAddress();
const tokenC = TokenId.fromString("0.0.48301281").toSolidityAddress();
let tokenD = TokenId.fromString("0.0.48301282").toSolidityAddress();
const tokenE = TokenId.fromString("0.0.48301300").toSolidityAddress();
let tokenF = TokenId.fromString("0.0.48301322").toSolidityAddress();

// 28 Sep sep 3:10
const contractIdAB = "0.0.48461739"
const contractIdCD = "0.0.48461742"
const contractIdEF = "0.0.48461745"

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

const createLiquidityPool = async (contractId: string, token0: string, token1: string) => {
  const token0Qty = new BigNumber(10);
  const token1Qty = new BigNumber(10);
  console.log(
    `Creating a pool of ${token0Qty} units of token A and ${token1Qty} units of token B.`
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
        .addInt256(token0Qty)
        .addInt256(token1Qty)
    )
    .freezeWith(client)
    .sign(treasureKey);
  const liquidityPoolTx = await liquidityPool.execute(client);
  const transferTokenRx = await liquidityPoolTx.getReceipt(client);
  console.log(`Liquidity pool created: ${transferTokenRx.status}`);
};

const setupFactory = async () => {
  if (contractId != null) {
    console.log(`\n STEP 1 - Set Static Pairs for now in Contract`);
    let contractFunctionParameters = new ContractFunctionParameters()
                                          .addAddressArray(["0x0000000000000000000000000000000002e377ab", 
                                                            "0x0000000000000000000000000000000002e377ae",
                                                            "0x0000000000000000000000000000000002e377b1"])
    const contractAllotTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("setPairs", contractFunctionParameters)
      .setGas(900000)
      .execute(client);
    const contractAllotRx = await contractAllotTx.getReceipt(client);
    const response = await contractAllotTx.getRecord(client);
    const status = contractAllotRx.status;
    console.log(`\n setPair Result ${status} code: ${response.contractFunctionResult!.getAddress()}`);
  }
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
        .addAddress(token0)
        .addAddress(token1)
        .addInt256(tokenAQty)
        .addInt256(tokenBQty)
    )
    .freezeWith(client)
    .sign(treasureKey);
  const addLiquidityTxRes = await addLiquidityTx.execute(client);
  const transferTokenRx = await addLiquidityTxRes.getReceipt(client);

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
        .addInt64(tokenAQty)
        .addInt64(tokenBQty)
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
  await initialize(contractIdAB, htsServiceAddress, lpTokenABContractAddress);
  await initialize(contractIdCD, htsServiceAddress, lpTokenCDContractAddress);
  await initialize(contractIdEF, htsServiceAddress, lpTokenEFContractAddress);
  await createLiquidityPool(contractIdAB, tokenA, tokenB)
  await createLiquidityPool(contractIdCD, tokenC, tokenD)
  await createLiquidityPool(contractIdEF, tokenE, tokenF)
  await setupFactory();
  await testForSinglePair(contractId, tokenA, tokenB);
  await testForSinglePair(contractId, tokenC, tokenD);
  await testForSinglePair(contractId, tokenE, tokenF);
}

async function testForSinglePair(contractId: string, token0: string, token1: string) {
  await getTreaserBalance();
  await addLiquidity(contractId, token0, token1);
  await removeLiquidity(contractId, token0, token1);
  await swapTokenA(contractId, token0, token1);
  await getTreaserBalance();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
