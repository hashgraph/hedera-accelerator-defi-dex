import { BigNumber } from "bignumber.js";
import {
  TokenId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  AccountBalanceQuery,
  Hbar,
  TokenInfoQuery,
} from "@hashgraph/sdk";

import { EventConsumer } from "../utils/EventConsumer";
import { ContractService } from "../deployment/service/ContractService";
import { DeployedContract } from "../deployment/model/contract";
import ClientManagement from "../utils/ClientManagement";
import dex from "../deployment/model/dex";

const clientManagement = new ClientManagement();
const contractService = new ContractService();

const htsServiceAddress = contractService.getContract(
  contractService.baseContractName
);

const client = clientManagement.createOperatorClient();

const { treasureId, treasureKey } = clientManagement.getTreasure();
const { id, key } = clientManagement.getOperator();

const lpTokenContracts = [
  contractService.getContractWithProxyAtIndex(
    contractService.lpTokenContractName,
    0
  ),
  contractService.getContractWithProxyAtIndex(
    contractService.lpTokenContractName,
    1
  ),
];
const contracts = [
  contractService.getContractWithProxyAtIndex(
    contractService.pairContractName,
    0
  ),
  contractService.getContractWithProxyAtIndex(
    contractService.pairContractName,
    1
  ),
];

let precision = 0;

const withPrecision = (value: number): BigNumber => {
  return new BigNumber(value).multipliedBy(precision);
};
const token0 = TokenId.fromString(dex.TOKEN_LAB49_1);
const token1 = TokenId.fromString(dex.TOKEN_LAB49_2);
const token2 = TokenId.fromString(dex.TOKEN_LAB49_3);
const tokenHBARX = TokenId.fromString(dex.HBARX_TOKEN_ID);

let tokenA = TokenId.fromString(dex.TOKEN_LAB49_1);
let tokenB = TokenId.fromString(dex.TOKEN_LAB49_2);

const initializeLPTokenContract = async (
  lpTokenContractId: string,
  tokenName: string,
  tokenSymbol: string
) => {
  console.log(`Initialize LP contract with lp contract ${lpTokenContractId}`);

  let contractFunctionParameters = new ContractFunctionParameters()
    .addAddress(htsServiceAddress.address)
    .addString(tokenSymbol)
    .addString(tokenName);
  const initializeContractTx = await new ContractExecuteTransaction()
    .setContractId(lpTokenContractId)
    .setFunction("initialize", contractFunctionParameters)
    .setGas(500000)
    .setMaxTransactionFee(new Hbar(50))
    .setPayableAmount(new Hbar(60)) //25.31548535 should be sent
    .execute(client);

  await initializeContractTx.getReceipt(client);

  console.log(`Initialize LP contract with token done.`);
};

async function tokenQueryFunction(tokenId: string) {
  const response = await new TokenInfoQuery()
    .setTokenId(tokenId)
    .execute(client);
  console.log(`- Token name: ${response.name} symbol $${response.symbol}`);
  return { name: response.name, symbol: response.symbol };
}

const initialize = async (contId: string, lpTokenProxyAdd: string) => {
  const initialize = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(9000000)
    .setFunction(
      "initialize",
      new ContractFunctionParameters()
        .addAddress(htsServiceAddress.address)
        .addAddress(lpTokenProxyAdd)
        .addAddress(tokenA.toSolidityAddress())
        .addAddress(tokenB.toSolidityAddress())
        .addAddress(id.toSolidityAddress())
        .addInt256(new BigNumber(10))
    )
    .freezeWith(client)
    .sign(key);
  const initializeTx = await initialize.execute(client);
  const initializeTxRx = await initializeTx.getReceipt(client);
  console.log(` Initialized status : ${initializeTxRx.status}`);
  await pairCurrentPosition(contId);
};

const getTreasureBalance = async (tokens: Array<TokenId>) => {
  const treasureBalance1 = await new AccountBalanceQuery()
    .setAccountId(treasureId)
    .execute(client);

  const responseTokens = treasureBalance1.tokens ?? new Map<TokenId, Long>();
  tokens.forEach((token) =>
    console.log(
      ` Treasure Token Balance for ${token.toString()}: ${responseTokens.get(
        token
      )}`
    )
  );
};

const addLiquidity = async (contId: string) => {
  const tokenAQty = withPrecision(2.1);
  const tokenBQty = withPrecision(2.3);
  console.log(
    ` Adding ${tokenAQty} units of token A and ${tokenBQty} units of token B to the pool.`
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
        .addInt256(tokenA == tokenHBARX ? new BigNumber(0) : tokenAQty)
        .addInt256(tokenB == tokenHBARX ? new BigNumber(0) : tokenBQty)
    )
    .setPayableAmount(
      tokenA == tokenHBARX
        ? new Hbar(2.1)
        : tokenB == tokenHBARX
        ? new Hbar(2.3)
        : new Hbar(0)
    )
    .freezeWith(client)
    .sign(treasureKey);
  const addLiquidityTxRes = await addLiquidityTx.execute(client);
  const addLiquidityRx = await addLiquidityTxRes.getReceipt(client);
  console.log(` Liquidity added status: ${addLiquidityRx.status}`);
  const result = await pairCurrentPosition(contId);
};

const removeLiquidity = async (contId: string) => {
  const lpToken = withPrecision(0.05);
  console.log(` Removing ${lpToken} units of LPToken from the pool.`);
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
  const removeLiquidityRx = await removeLiquidityTx.getReceipt(client);

  console.log(` Liquidity remove status: ${removeLiquidityRx.status}`);
  await pairCurrentPosition(contId);
};

const swapTokenA = async (contId: string) => {
  const tokenAQty = withPrecision(0.01);
  console.log(` Swapping a ${tokenAQty} units of token A from the pool.`);
  const swapToken = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(5000000)
    .setFunction(
      "swapToken",
      new ContractFunctionParameters()
        .addAddress(treasureId.toSolidityAddress())
        .addAddress(tokenA.toSolidityAddress())
        .addInt256(tokenA == tokenHBARX ? new BigNumber(0) : tokenAQty)
        .addInt256(new BigNumber(0))
    )
    .setPayableAmount(tokenA == tokenHBARX ? new Hbar(0.01) : new Hbar(0))
    .freezeWith(client)
    .sign(treasureKey);
  const swapTokenTx = await swapToken.execute(client);
  const swapTokenRx = await swapTokenTx.getReceipt(client);

  console.log(` Swap status: ${swapTokenRx.status}`);
  await pairCurrentPosition(contId);
};

const pairCurrentPosition = async (
  contId: string
): Promise<[BigNumber, BigNumber]> => {
  const getPairQty = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(1000000)
    .setFunction("getPairQty")
    .freezeWith(client);
  const getPairQtyTx = await getPairQty.execute(client);
  const response = await getPairQtyTx.getRecord(client);
  const tokenAQty = response.contractFunctionResult!.getInt256(0);
  const tokenBQty = response.contractFunctionResult!.getInt256(1);
  console.log(
    ` ${tokenAQty} units of token A and ${tokenBQty} units of token B are present in the pool. \n`
  );
  return [tokenAQty, tokenBQty];
};

const getTokenPairAddress = async (
  contId: string
): Promise<[BigNumber, BigNumber]> => {
  const getPairQty = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(1000000)
    .setFunction("getTokenPairAddress")
    .freezeWith(client);
  const getPairQtyTx = await getPairQty.execute(client);
  const response = await getPairQtyTx.getRecord(client);
  const tokenAQty = response.contractFunctionResult!.getInt256(0);
  const tokenBQty = response.contractFunctionResult!.getInt256(1);
  console.log(
    ` ${tokenAQty} units of token A and ${tokenBQty} units of token B are present in the pool. \n`
  );
  return [tokenAQty, tokenBQty];
};

const spotPrice = async (contId: string) => {
  const getSpotPrice = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(1000000)
    .setFunction("getSpotPrice")
    .freezeWith(client);
  const spotPriceTx = await getSpotPrice.execute(client);
  const response = await spotPriceTx.getRecord(client);
  const price = response.contractFunctionResult!.getInt256(0);

  console.log(` Spot price for token A is ${price}. \n`);
};

const getVariantValue = async (contId: string) => {
  const getVariantValue = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(1000000)
    .setFunction("getVariantValue")
    .freezeWith(client);
  const variantValueTx = await getVariantValue.execute(client);
  const response = await variantValueTx.getRecord(client);
  const price = response.contractFunctionResult!.getInt256(0);

  console.log(` k variant value is ${price}. \n`);
};

const getOutGivenIn = async (contId: string) => {
  const tokenAQty = withPrecision(10);
  const getOutGivenIn = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(1000000)
    .setFunction(
      "getOutGivenIn",
      new ContractFunctionParameters().addInt256(tokenAQty)
    )
    .freezeWith(client);
  const getOutGivenInTx = await getOutGivenIn.execute(client);
  const response = await getOutGivenInTx.getRecord(client);
  const tokenBQty = response.contractFunctionResult!.getInt256(0);

  console.log(
    ` For tokenAQty ${tokenAQty} the getOutGivenIn tokenBQty is ${tokenBQty}. \n`
  );
};

const getInGivenOut = async (contId: string) => {
  const tokenBQty = withPrecision(11);
  const getInGivenOut = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(1000000)
    .setFunction(
      "getInGivenOut",
      new ContractFunctionParameters().addInt256(tokenBQty)
    )
    .freezeWith(client);
  const getInGivenOutTx = await getInGivenOut.execute(client);
  const response = await getInGivenOutTx.getRecord(client);
  const tokenAQty = response.contractFunctionResult!.getInt256(0);

  console.log(
    ` For tokenBQty ${tokenBQty} the getInGivenOut tokenAQty is ${tokenAQty}. \n`
  );
};

const slippageOutGivenIn = async (contId: string) => {
  const tokenAQty = withPrecision(10);
  const slippageOutGivenInTx = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(1000000)
    .setFunction(
      "slippageOutGivenIn",
      new ContractFunctionParameters().addInt256(tokenAQty)
    )
    .freezeWith(client);
  const slippageOutGivenInTxResult = await slippageOutGivenInTx.execute(client);
  const response = await slippageOutGivenInTxResult.getRecord(client);
  const tokenBQty = response.contractFunctionResult!.getInt256(0);

  console.log(
    ` For tokenAQty ${tokenAQty} the slippageOutGivenIn tokenBQty is ${tokenBQty}. \n`
  );
};

const slippageInGivenOut = async (contId: string) => {
  const tokenBQty = withPrecision(12);
  const slippageInGivenOutTx = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(1000000)
    .setFunction(
      "slippageInGivenOut",
      new ContractFunctionParameters().addInt256(tokenBQty)
    )
    .freezeWith(client);
  const slippageInGivenOuTxResult = await slippageInGivenOutTx.execute(client);
  const response = await slippageInGivenOuTxResult.getRecord(client);
  const tokenAQty = response.contractFunctionResult!.getInt256(0);

  console.log(
    ` For tokenBQty ${tokenBQty} the slippageOutGivenIn tokenAQty is ${tokenAQty}. \n`
  );
};

const getPrecisionValue = async (contId: string) => {
  const getPrecisionValueTx = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(1000000)
    .setFunction("getPrecisionValue", new ContractFunctionParameters())
    .freezeWith(client);
  const getPrecisionValueTxRes = await getPrecisionValueTx.execute(client);
  const response = await getPrecisionValueTxRes.getRecord(client);
  const precisionLocal = response.contractFunctionResult!.getInt256(0);

  precision = Number(precisionLocal);

  console.log(` getPrecisionValue ${precision}`);
};

const getLpTokenAddress = async (lpTokenProxyId: string) => {
  const getLpTokenAddressTx = await new ContractExecuteTransaction()
    .setContractId(lpTokenProxyId)
    .setGas(1000000)
    .setFunction("getLpTokenAddress", new ContractFunctionParameters())
    .freezeWith(client);
  const getLpTokenAddressTxRes = await getLpTokenAddressTx.execute(client);
  const response = await getLpTokenAddressTxRes.getRecord(client);
  const address = response.contractFunctionResult!.getAddress(0);

  console.log(` Lp token address ${address}`);
};

const setSlippage = async (contId: string, slippage: BigNumber) => {
  const transaction = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(1000000)
    .setFunction(
      "setSlippage",
      new ContractFunctionParameters().addInt256(slippage)
    )
    .freezeWith(client);
  const txRes = await transaction.execute(client);
  const record = await txRes.getRecord(client);
  const receipt = await txRes.getReceipt(client);
  console.log(` setSlippage ${receipt.status}`);
};

async function main() {
  const tokens = [tokenHBARX, token0, token1, token2];
  let index = 0;
  for (const contract of contracts) {
    tokenA = tokens[index];
    tokenB = tokens[index + 1];
    console.log(`\nTesting started for token A${index} and token B${index}`);
    await testForSinglePair(contract, lpTokenContracts[index]);
    index++;
  }
  console.log(`Done`);
}

async function testForSinglePair(
  contract: DeployedContract,
  lpContract: DeployedContract
) {
  const lpTokenProxyId = lpContract.transparentProxyId!;
  const contractProxyId = contract.transparentProxyId!;
  const { lpTokenSymbol, lpTokenName } = await createLPTokenName();
  await initializeLPTokenContract(lpTokenProxyId, lpTokenName, lpTokenSymbol);
  await getLpTokenAddress(lpTokenProxyId);
  console.log(
    `\nUsing pair proxy contractId ${contract.id} and LP token contract proxy id ${lpTokenProxyId} \n`
  );
  await initialize(contractProxyId, lpContract.transparentProxyAddress!);
  await getPrecisionValue(contractProxyId);
  await getTreasureBalance([tokenA, tokenB]);
  await addLiquidity(contractProxyId);
  await getTreasureBalance([tokenA, tokenB]);
  await removeLiquidity(contractProxyId);
  await getTokenPairAddress(contractProxyId);
  await pairCurrentPosition(contractProxyId);
  await getTreasureBalance([tokenA, tokenB]);
  await setSlippage(contractProxyId, new BigNumber(50000000));
  await swapTokenA(contractProxyId);
  await spotPrice(contractProxyId);
  await getVariantValue(contractProxyId);
  await getOutGivenIn(contractProxyId);
  await getInGivenOut(contractProxyId);
  await pairCurrentPosition(contractProxyId);
  await slippageOutGivenIn(contractProxyId);
  await slippageInGivenOut(contractProxyId);
}

async function createLPTokenName() {
  const tokenADetail = await tokenQueryFunction(tokenA.toString());
  const tokenBDetail = await tokenQueryFunction(tokenB.toString());
  const symbols = [tokenADetail.symbol, tokenBDetail.symbol];
  symbols.sort();
  const lpTokenSymbol = symbols[0] + "-" + symbols[1];
  const lpTokenName = lpTokenSymbol + " name";
  return { lpTokenSymbol, lpTokenName };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
