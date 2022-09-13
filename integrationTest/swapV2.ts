import { BigNumber } from "bignumber.js";
import {
  TokenId,
  ContractExecuteTransaction,
  ContractFunctionParameters,

  AccountBalanceQuery,
  ContractId
} from "@hashgraph/sdk";

import ClientManagement from "./utils/utils";


const clientManagement = new ClientManagement();

const htsServiceAddress = "0x0000000000000000000000000000000002dfec41"; // 13 sep 3:10
const lpTokenContractAddress = "0x0000000000000000000000000000000002dfec62"; // 13 sep 4:45
const client = clientManagement.createClient();

const tokenA = TokenId.fromString("0.0.47646195").toSolidityAddress();
let tokenB = TokenId.fromString("0.0.47646196").toSolidityAddress();
const {treasureId, treasureKey} = clientManagement.getTreasure();

const contractId = "0.0.48229478"; // 13 sep 4:55

const initialize = async () => {
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

const getTreaserBalance = async () => {
  const treasureBalance1 = await new AccountBalanceQuery()
      .setAccountId(treasureId)
      .execute(client);

  console.log(`Treasure LP Token Balance: ${treasureBalance1.tokens?._map.get('0.0.48229442')}`); //2 Sep 01:02 pm
}

const createLiquidityPool = async () => {
  const tokenAQty = new BigNumber(10);
  const tokenBQty = new BigNumber(10);
  console.log(
    `Creating a pool of ${tokenAQty} units of token A and ${tokenBQty} units of token B.`
  );
  const liquidityPool = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9000000)
    .setFunction(
      "initializeContract",
      new ContractFunctionParameters()
        .addAddress(treasureId.toSolidityAddress())
        .addAddress(tokenA)
        .addAddress(tokenB)
        .addInt64(tokenAQty)
        .addInt64(tokenBQty)
    )
    .freezeWith(client)
    .sign(treasureKey);
  const liquidityPoolTx = await liquidityPool.execute(client);
  const transferTokenRx = await liquidityPoolTx.getReceipt(client);
  console.log(`Liquidity pool created: ${transferTokenRx.status}`);
  await pairCurrentPosition();
};

const addLiquidity = async () => {
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
        .addInt64(tokenAQty)
        .addInt64(tokenBQty)
    )
    .freezeWith(client)
    .sign(treasureKey);
  const addLiquidityTxRes = await addLiquidityTx.execute(client);
  const transferTokenRx = await addLiquidityTxRes.getReceipt(client);

  console.log(`Liquidity added status: ${transferTokenRx.status}`);
  await pairCurrentPosition();
};

const removeLiquidity = async () => {
  const tokenAQty = new BigNumber(1);
  const tokenBQty = new BigNumber(1);
  console.log(
    `Removing ${tokenAQty} units of token A and ${tokenBQty} units of token B from the pool.`
  );
  const removeLiquidity = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(2000000)
    .setFunction(
      "removeLiquidity",
      new ContractFunctionParameters()
        .addAddress(treasureId.toSolidityAddress())
        .addAddress(tokenA)
        .addAddress(tokenB)
        .addInt64(tokenAQty)
        .addInt64(tokenBQty)
    )
    .freezeWith(client)
    .sign(treasureKey);
  const removeLiquidityTx = await removeLiquidity.execute(client);
  const transferTokenRx = await removeLiquidityTx.getReceipt(client);

  console.log(`Liquidity remove status: ${transferTokenRx.status}`);
  await pairCurrentPosition();
};

const swapTokenA = async () => {
  const tokenAQty = new BigNumber(5);
  const tokenBQty = new BigNumber(0);
  console.log(`Swapping a ${tokenAQty} units of token A from the pool.`);
  // Need to pass different token B address so that only swap of token A is considered.
  tokenB = TokenId.fromString("0.0.47646100").toSolidityAddress();
  const swapToken = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(2000000)
    .setFunction(
      "swapToken",
      new ContractFunctionParameters()
        .addAddress(treasureId.toSolidityAddress())
        .addAddress(tokenA)
        .addAddress(tokenB)
        .addInt64(tokenAQty)
        .addInt64(tokenBQty)
    )
    .freezeWith(client)
    .sign(treasureKey);
  const swapTokenTx = await swapToken.execute(client);
  const transferTokenRx = await swapTokenTx.getReceipt(client);

  console.log(`Swap status: ${transferTokenRx.status}`);
  await pairCurrentPosition();
};

const pairCurrentPosition = async () => {
  const getPairQty = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(1000000)
    .setFunction("getPairQty")
    .freezeWith(client);
  const getPairQtyTx = await getPairQty.execute(client);
  const response = await getPairQtyTx.getRecord(client);
  const tokenAQty = response.contractFunctionResult!.getInt64(0);
  const tokenBQty = response.contractFunctionResult!.getInt64(1);
  console.log(
    `${tokenAQty} units of token A and ${tokenBQty} units of token B are present in the pool. \n`
  );
};

const getContributorTokenShare = async () => {
  const getContributorTokenShare = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(1000000)
    .setFunction(
      "getContributorTokenShare",
      new ContractFunctionParameters().addAddress(treasureId.toSolidityAddress())
    )
    .freezeWith(client);
  const getContributorTokenShareTx = await getContributorTokenShare.execute(
    client
  );
  const response = await getContributorTokenShareTx.getRecord(client);
  const tokenAQty = response.contractFunctionResult!.getInt64(0);
  const tokenBQty = response.contractFunctionResult!.getInt64(1);
  console.log(
    `${tokenAQty} units of token A and ${tokenBQty} units of token B contributed by ${treasureId}.`
  );
};

const spotPrice = async () => {
  const getSpotPrice = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(1000000)
    .setFunction("getSpotPrice")
    .freezeWith(client);
  const getPairQtyTx = await getSpotPrice.execute(client);
  const response = await getPairQtyTx.getRecord(client);
  const price = response.contractFunctionResult!.getInt256(0);

  console.log(`spot price for token A is ${price}. \n`);
};

const getVariantValue = async () => {
  const getVariantValue = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(1000000)
    .setFunction("getVariantValue")
    .freezeWith(client);
  const getPairQtyTx = await getVariantValue.execute(client);
  const response = await getPairQtyTx.getRecord(client);
  const price = response.contractFunctionResult!.getInt256(0);

  console.log(`k variant value is ${price}. \n`);
};

const getOutGivenIn =async () => {
  const tokenAQty = new BigNumber(10);
  const getOutGivenIn = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(1000000)
    .setFunction("getOutGivenIn",
      new ContractFunctionParameters()
          .addInt64(tokenAQty))
    .freezeWith(client);
  const getPairQtyTx = await getOutGivenIn.execute(client);
  const response = await getPairQtyTx.getRecord(client);
  const tokenBQty = response.contractFunctionResult!.getInt256(0);

  console.log(`For tokenAQty ${tokenAQty} the getOutGivenIn tokenBQty is ${tokenBQty}. \n`);
};

const getInGivenOut =async () => {
  const tokenBQty = new BigNumber(11);
  const getInGivenOut = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(1000000)
    .setFunction("getInGivenOut",
      new ContractFunctionParameters()
            .addInt64(tokenBQty))
    .freezeWith(client);
  const getPairQtyTx = await getInGivenOut.execute(client);
  const response = await getPairQtyTx.getRecord(client);
  const tokenAQty = response.contractFunctionResult!.getInt256(0);

  console.log(`For tokenBQty ${tokenBQty} the getInGivenOut tokenAQty is ${tokenAQty}. \n`);
};

async function main() {
  await initialize();
  await getTreaserBalance();
  await createLiquidityPool();
  await getTreaserBalance();
  await addLiquidity();
  await removeLiquidity();
  await swapTokenA();
  await spotPrice();
  await getVariantValue();
  await getOutGivenIn();
  await getInGivenOut();
  await getTreaserBalance();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
