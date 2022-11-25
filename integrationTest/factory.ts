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
const tokenC = TokenId.fromString("0.0.48301281")
let tokenD = TokenId.fromString("0.0.48301282")
const tokenE = TokenId.fromString("0.0.48301300")
let tokenF = TokenId.fromString("0.0.48301322")

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
    const contractTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("setUpFactory", contractFunctionParameters)
      .setGas(9000000)
      .execute(client);
    const receipt = await contractTx.getReceipt(client);
    const response = await contractTx.getRecord(client);
    const status = receipt.status;
    console.log(`\nSetupFactory Result ${status} code: ${response.contractFunctionResult!.getAddress()}`);
};

const createPair = async (contractId: string, token0: TokenId, token1: TokenId) => {
  
  console.log(
    `createPair TokenA TokenB`
  );
  const createPairTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9000000)
    .setFunction(
      "createPair",
      new ContractFunctionParameters()
        .addAddress(token0.toSolidityAddress())
        .addAddress(token1.toSolidityAddress())
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

const getPair = async (contractId: string, token0: TokenId, token1: TokenId) => {
  console.log(
    `get Pair`
  );
  const getPairTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9999999)
    .setFunction(
      "getPair",
      new ContractFunctionParameters()
      .addAddress(token0.toSolidityAddress())
      .addAddress(token1.toSolidityAddress())
    )
    .freezeWith(client)
  const executedTx = await getPairTx.execute(client);
  const response = await executedTx.getRecord(client);
   console.log(`getPair: ${response.contractFunctionResult!.getAddress(0)}`);
  const receiptRx = await executedTx.getReceipt(client);
  console.log(`getPair: ${receiptRx.status}`);
  return `0x${response.contractFunctionResult!.getAddress(0)}`;
};

const getAllPairs = async (contractId: string) => {
  console.log(
    `getAllPairs`
  );
  const getAllPairsTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9999999)
    .setFunction(
      "getPairs",
      new ContractFunctionParameters()
      .addUint256(0)
    )
    .freezeWith(client)

  const executedTx = await getAllPairsTx.execute(client);
  const response = await executedTx.getRecord(client);
  
  const tokenCount = response.contractFunctionResult!.getUint256(0);
  const newToken1 = response.contractFunctionResult!.getAddress(1);
  console.log(`getPairs Count: ${response.contractFunctionResult!.getUint256(0)}`);
  console.log(`getPairs First pair Address: ${response.contractFunctionResult!.getAddress(1)}`);
  const receipt = await executedTx.getReceipt(client);
  console.log(`getPairs: ${receipt.status}`);
};

const initializeContract = async (contId: string, token0: TokenId, token1: TokenId ) => {
  const tokenAQty = withPrecision(200);
  const tokenBQty = withPrecision(220);
  console.log(
    `Creating a pool of ${tokenAQty} units of token A and ${tokenBQty} units of token B.`
  );
  const tx = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(9000000)
    .setFunction(
      "initializeContract",
      new ContractFunctionParameters()
        .addAddress(treasureId.toSolidityAddress())
        .addAddress(token0.toSolidityAddress())
        .addAddress(token1.toSolidityAddress())
        .addInt256(tokenAQty)
        .addInt256(tokenBQty)
        .addInt256(new BigNumber(10))//fee
        .addAddress(treasureId.toSolidityAddress())
    )
    .freezeWith(client)
    .sign(treasureKey);
  const executedTx = await tx.execute(client);
  const receipt = await executedTx.getReceipt(client);
  console.log(`Liquidity pool created: ${receipt.status}`);
};

const addLiquidity = async (contId: string, token0: TokenId, token1: TokenId) => {
  const tokenAQty = withPrecision(10);
  const tokenBQty = withPrecision(10);
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
        .addAddress(token0.toSolidityAddress())
        .addAddress(token1.toSolidityAddress())
        .addInt256(tokenAQty)
        .addInt256(tokenBQty)
    )
    .freezeWith(client)
    .sign(treasureKey);
  const addLiquidityTxRes = await addLiquidityTx.execute(client);
  const receipt = await addLiquidityTxRes.getReceipt(client);

  console.log(`Liquidity added status: ${receipt.status}`);
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
  const receipt = await removeLiquidityTx.getReceipt(client);

  console.log(`Liquidity remove status: ${receipt.status}`);
};

const swapToken = async (contId: string, token: TokenId) => {
  const tokenQty = withPrecision(1);
  console.log(`Swapping a ${tokenQty} units of token A from the pool.`);
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
  const receipt = await swapTokenTx.getReceipt(client);

  console.log(`Swap status: ${receipt.status}`);
};

const getTokenPairAddress = async (contId: string) => {
  const tokenQty = withPrecision(1);
  console.log(`Swapping a ${tokenQty} units of token A from the pool.`);
  // Need to pass different token B address so that only swap of token A is considered.
  const getTokensTxReq = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(2000000)
    .setFunction(
      "getTokenPairAddress",
      new ContractFunctionParameters()
    )
    .freezeWith(client)
    .sign(treasureKey);
  const getTokensTx = await getTokensTxReq.execute(client);
  const getTokensRx = await getTokensTx.getReceipt(client);
  const record = await getTokensTx.getRecord(client);
  const newToken0 = record.contractFunctionResult!.getAddress(0);
  const newToken1 = record.contractFunctionResult!.getAddress(1);
  console.log(`Token0 : ${newToken0}\nToken1: ${newToken1}`);
  console.log(`Swap status: ${getTokensRx.status}`);
};

const getTreasureBalance = async (tokens: Array<TokenId>) => {
  const treasureBalanceTx = await new AccountBalanceQuery()
      .setAccountId(treasureId)
      .execute(client);
  const responseTokens = treasureBalanceTx.tokens ?? new Map<TokenId, Long>();
  tokens.forEach(token =>   console.log(` Treasure Token Balance for ${token.toString()}: ${responseTokens.get(token)}`));
}

async function main() {
    await setupFactory();
    await testForSinglePair(contractId, tokenC, tokenB);
    await testForSinglePair(contractId, tokenC, tokenD);
}

async function testForSinglePair(contractId: string, token0: TokenId, token1: TokenId) {
    await createPair(contractId, token0, token1);
    await getAllPairs(contractId);
    const pairAddress =  await getPair(contractId, token0, token1);
    
    const response = await httpRequest(pairAddress, undefined);
    const pairContractId = response.contract_id;
    console.log(`contractId: ${pairContractId}`)
    await getTreasureBalance([token0, token1]);
    await initializeContract(pairContractId, token0, token1);
    await getTokenPairAddress(pairContractId);
    await getTreasureBalance([token0, token1]);
    await addLiquidity(pairContractId, token0, token1);
    await getTreasureBalance([token0, token1]);
    await removeLiquidity(pairContractId);
    await swapToken(pairContractId, token0);
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

