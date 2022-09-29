import { BigNumber } from "bignumber.js";
import {
  TokenId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  AccountBalanceQuery,
} from "@hashgraph/sdk";

import ClientManagement from "./utils/utils";
import { ContractService } from "../deployment/service/ContractService";

const clientManagement = new ClientManagement();
const contractService = new ContractService();

const htsServiceAddress = contractService.getContract(contractService.baseContractName).address;
const lpTokenContracts = contractService.getLast3Contracts(contractService.lpTokenContractName);
const client = clientManagement.createClient();

const tokenA = TokenId.fromString("0.0.48289687").toSolidityAddress();
let tokenB = TokenId.fromString("0.0.48289686").toSolidityAddress();
const tokenC = TokenId.fromString("0.0.48301281").toSolidityAddress();
let tokenD = TokenId.fromString("0.0.48301282").toSolidityAddress();
const tokenE = TokenId.fromString("0.0.48301300").toSolidityAddress();
let tokenF = TokenId.fromString("0.0.48301322").toSolidityAddress();

const {treasureId, treasureKey} = clientManagement.getTreasure();

//const contractId = contractService.getContractWithProxy("swap").id!;
const contractIds = contractService.getLast3Contracts(contractService.pairContractName);

let precision = 0;

const withPrecision = (value: number): BigNumber => {
  return new BigNumber(value).multipliedBy(precision);
}

let contractId: string = "";
let lpContract: string  = "";
let token0: string  = "";
let token1: string  = "";

const initialize = async () => {
  const initialize = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(2000000)
    .setFunction(
      "initialize",
      new ContractFunctionParameters()
        .addAddress(htsServiceAddress)
        .addAddress(lpContract)
    )
    .freezeWith(client)
    .sign(treasureKey);
  const initializeTx = await initialize.execute(client);
  const initializeTxRx = await initializeTx.getReceipt(client);
  console.log(`\n Initialized status : ${initializeTxRx.status}`);
};

const getTreasureBalance = async () => {
  const treasureBalance1 = await new AccountBalanceQuery()
      .setAccountId(treasureId)
      .execute(client);
  console.log(`Treasure LP Token Balance: ${treasureBalance1.tokens}`); //2 Sep 01:02 pm
}

const createLiquidityPool = async () => {
  const tokenAQty = withPrecision(200);
  const tokenBQty = withPrecision(220);
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
        .addAddress(token0)
        .addAddress(token1)
        .addInt256(tokenAQty)
        .addInt256(tokenBQty)
    )
    .freezeWith(client)
    .sign(treasureKey);
  const liquidityPoolTx = await liquidityPool.execute(client);
  const transferTokenRx = await liquidityPoolTx.getReceipt(client);
  console.log(`Liquidity pool created: ${transferTokenRx.status}`);
  await pairCurrentPosition();
};

const addLiquidity = async () => {
  const tokenAQty = withPrecision(10);
  const tokenBQty = withPrecision(10);
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
  const result = await pairCurrentPosition();
};

const removeLiquidity = async () => {
  const lpToken = withPrecision(5);
  console.log(
    `Removing ${lpToken} units of LPToken from the pool.`
  );
  const removeLiquidity = await new ContractExecuteTransaction()
    .setContractId(contractId)
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
  await pairCurrentPosition();
};

const swapTokenA = async () => {
  const tokenAQty = withPrecision(1);
  const tokenBQty = withPrecision(0);
  console.log(`Swapping a ${tokenAQty} units of token A from the pool.`);
  // Need to pass different token B address so that only swap of token A is considered.
  token1 = TokenId.fromString("0.0.47646100").toSolidityAddress();
  const swapToken = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(2000000)
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
  await pairCurrentPosition();
};

const pairCurrentPosition = async (): Promise<[BigNumber, BigNumber]> => {
  const getPairQty = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(1000000)
    .setFunction("getPairQty")
    .freezeWith(client);
  const getPairQtyTx = await getPairQty.execute(client);
  const response = await getPairQtyTx.getRecord(client);
  const tokenAQty = response.contractFunctionResult!.getInt256(0);
  const tokenBQty = response.contractFunctionResult!.getInt256(1);
  console.log(
    `${tokenAQty} units of token A and ${tokenBQty} units of token B are present in the pool. \n`
  );
  return [tokenAQty, tokenBQty];
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
  const tokenAQty = response.contractFunctionResult!.getInt256(0);
  const tokenBQty = response.contractFunctionResult!.getInt256(1);
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
  const tokenAQty = withPrecision(10);
  const getOutGivenIn = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(1000000)
    .setFunction("getOutGivenIn",
      new ContractFunctionParameters()
          .addInt256(tokenAQty))
    .freezeWith(client);
  const getPairQtyTx = await getOutGivenIn.execute(client);
  const response = await getPairQtyTx.getRecord(client);
  const tokenBQty = response.contractFunctionResult!.getInt256(0);

  console.log(`For tokenAQty ${tokenAQty} the getOutGivenIn tokenBQty is ${tokenBQty}. \n`);
};

const getInGivenOut =async () => {
  const tokenBQty = withPrecision(11);
  const getInGivenOut = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(1000000)
    .setFunction("getInGivenOut",
      new ContractFunctionParameters()
            .addInt256(tokenBQty))
    .freezeWith(client);
  const getPairQtyTx = await getInGivenOut.execute(client);
  const response = await getPairQtyTx.getRecord(client);
  const tokenAQty = response.contractFunctionResult!.getInt256(0);

  console.log(`For tokenBQty ${tokenBQty} the getInGivenOut tokenAQty is ${tokenAQty}. \n`);
};

const slippageOutGivenIn = async () => {
  const tokenAQty = withPrecision(10);
  const slippageOutGivenInTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(1000000)
    .setFunction("slippageOutGivenIn",
      new ContractFunctionParameters()
            .addInt256(tokenAQty))
    .freezeWith(client);
  const slippageOutGivenInTxResult = await slippageOutGivenInTx.execute(client);
  const response = await slippageOutGivenInTxResult.getRecord(client);
  const tokenBQty = response.contractFunctionResult!.getInt256(0);

  console.log(`For tokenAQty ${tokenAQty} the slippageOutGivenIn tokenBQty is ${tokenBQty}. \n`);
};

const slippageInGivenOut = async () => {
  const tokenBQty = withPrecision(12);
  const slippageInGivenOutTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(1000000)
    .setFunction("slippageInGivenOut",
      new ContractFunctionParameters()
            .addInt256(tokenBQty))
    .freezeWith(client);
  const slippageInGivenOuTxResult = await slippageInGivenOutTx.execute(client);
  const response = await slippageInGivenOuTxResult.getRecord(client);
  const tokenAQty = response.contractFunctionResult!.getInt256(0);

  console.log(`For tokenbQty ${tokenBQty} the slippageOutGivenIn tokenAQty is ${tokenAQty}. \n`);
};

const getPrecisionValue = async () => {
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

  console.log(`getPrecisionValue ${precision} \n `);
};

async function main() {
  
  contractId = contractIds[0].id;
  lpContract = lpTokenContracts[0].address;
  token0 = tokenA;
  token1 = tokenB;
  console.log(`Using contractId ${contractId} and LP token contract id ${lpContract}`);
  await testForSinglePair();

  contractId = contractIds[1].id;
  lpContract = lpTokenContracts[1].address;
  token0 = tokenC;
  token1 = tokenD;
  console.log(`Using contractId ${contractId} and LP token contract id ${lpContract}`);
  await testForSinglePair();

  contractId = contractIds[2].id;
  lpContract = lpTokenContracts[2].address;
  token0 = tokenE;
  token1 = tokenF;
  console.log(`Using contractId ${contractId} and LP token contract id ${lpContract}`);
  await testForSinglePair();
}

async function testForSinglePair() {
  await initialize();
  await getPrecisionValue();
  await createLiquidityPool();
  await addLiquidity();
  await removeLiquidity();
  await swapTokenA();
  await spotPrice();
  await getVariantValue();
  await getOutGivenIn();
  await getInGivenOut();
  await pairCurrentPosition();
  await slippageOutGivenIn();
  await slippageInGivenOut();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
