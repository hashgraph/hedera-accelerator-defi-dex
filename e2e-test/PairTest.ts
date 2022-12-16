import { BigNumber } from "bignumber.js";
import {
  TokenId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  AccountBalanceQuery,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  Hbar,
} from "@hashgraph/sdk";

import { ContractService } from "../deployment/service/ContractService";
import { DeployedContract } from "../deployment/model/contract";
import ClientManagement from "../utils/ClientManagement";
import { expect } from "chai";
const clientManagement = new ClientManagement();
const contractService = new ContractService();

const htsServiceAddress = contractService.getContract(
  contractService.baseContractName
).address;

const client = clientManagement.createOperatorClient();

const { treasureId, treasureKey } = clientManagement.getTreasure();
const treasurerClient = clientManagement.createClient();
const { key } = clientManagement.getOperator();

const lpTokenContracts = [
  contractService.getContractWithProxy(contractService.lpTokenContractName),
];
const contracts = [
  contractService.getContractWithProxy(contractService.pairContractName),
];

let precision = 0;

const withPrecision = (value: number): BigNumber => {
  return new BigNumber(value).multipliedBy(precision);
};

let tokenA: TokenId;
let tokenB: TokenId;

const createToken = async (tokenName: string): Promise<TokenId> => {
  const createTokenTx = await new TokenCreateTransaction()
    .setTokenName("Token" + tokenName)
    .setTokenSymbol("Token Symbol" + tokenName)
    .setDecimals(8)
    .setInitialSupply(20000000000000)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setSupplyKey(treasureKey)
    .setTreasuryAccountId(treasureId)
    .execute(treasurerClient);

  const tokenCreateTx = await createTokenTx.getReceipt(client);
  const tokenId = tokenCreateTx.tokenId;
  console.log(
    `Token created ${tokenId}, Token Address ${tokenId?.toSolidityAddress()}`
  );
  return tokenId!;
};

const initializeLPTokenContract = async (lpTokenContractId: string) => {
  console.log(`Initialize LP contract with lp contract ${lpTokenContractId}`);

  let contractFunctionParameters = new ContractFunctionParameters().addAddress(
    htsServiceAddress
  );

  const initializeContractTx = await new ContractExecuteTransaction()
    .setContractId(lpTokenContractId)
    .setFunction("initialize", contractFunctionParameters)
    .setGas(500000)
    .setMaxTransactionFee(new Hbar(50))
    .setPayableAmount(new Hbar(60))
    .execute(client);

  await initializeContractTx.getReceipt(client);

  console.log(`Initialize LP contract with token done.`);
};

const initialize = async (contId: string, lpTokenProxyAdd: string) => {
  const initialize = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(9000000)
    .setFunction(
      "initialize",
      new ContractFunctionParameters()
        .addAddress(htsServiceAddress)
        .addAddress(lpTokenProxyAdd)
        .addAddress(tokenA.toSolidityAddress())
        .addAddress(tokenB.toSolidityAddress())
        .addAddress(treasureId.toSolidityAddress())
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

const addLiquidity = async (
  contId: string,
  tokenAQty: BigNumber,
  tokenBQty: BigNumber
) => {
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
        .addInt256(tokenAQty)
        .addInt256(tokenBQty)
    )
    .freezeWith(client)
    .sign(treasureKey);
  const addLiquidityTxRes = await addLiquidityTx.execute(client);
  const addLiquidityRx = await addLiquidityTxRes.getReceipt(client);

  console.log(` Liquidity added status: ${addLiquidityRx.status}`);
};

const removeLiquidity = async (contId: string, lpToken: BigNumber) => {
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
};

const swapTokenA = async (contId: string) => {
  const tokenAQty = withPrecision(1);
  console.log(` Swapping a ${tokenAQty} units of token A from the pool.`);
  const swapToken = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(9000000)
    .setFunction(
      "swapToken",
      new ContractFunctionParameters()
        .addAddress(treasureId.toSolidityAddress())
        .addAddress(tokenA.toSolidityAddress())
        .addInt256(tokenAQty)
    )
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
): Promise<[string, string]> => {
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
    ` ${tokenAAddress} address of token A and ${tokenBAddress} address of token B  \n`
  );
  return [tokenAAddress, tokenBAddress];
};

const spotPrice = async (contId: string): Promise<BigNumber> => {
  const getSpotPrice = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(1000000)
    .setFunction("getSpotPrice")
    .freezeWith(client);
  const spotPriceTx = await getSpotPrice.execute(client);
  const response = await spotPriceTx.getRecord(client);
  const price = response.contractFunctionResult!.getInt256(0);
  console.log(` Spot price for token A is ${price}. \n`);
  return price;
};

const getVariantValue = async (contId: string): Promise<BigNumber> => {
  const getVariantValue = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(1000000)
    .setFunction("getVariantValue")
    .freezeWith(client);
  const variantValueTx = await getVariantValue.execute(client);
  const response = await variantValueTx.getRecord(client);
  const price = response.contractFunctionResult!.getInt256(0);
  console.log(` k variant value is ${price}. \n`);
  return price;
};

const getOutGivenIn = async (contId: string): Promise<BigNumber> => {
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
  return tokenBQty;
};

const getInGivenOut = async (contId: string): Promise<BigNumber> => {
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
  return tokenAQty;
};

const slippageOutGivenIn = async (contId: string): Promise<BigNumber> => {
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
  return tokenBQty;
};

const slippageInGivenOut = async (contId: string): Promise<BigNumber> => {
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
  return tokenAQty;
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

const getAllLPTokenCount = async (contId: string): Promise<BigNumber> => {
  console.log(`getAllLPTokenCount`);

  const getAllLPTokenCountTx = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setFunction("getAllLPTokenCount")
    .setGas(2000000)
    .freezeWith(client)
    .sign(key);

  const signTx = await getAllLPTokenCountTx.sign(treasureKey); //For associating a token to treasurer

  const executedTx = await signTx.execute(client);
  const executedRx = await executedTx.getReceipt(client);
  const response = await executedTx.getRecord(client);
  const status = executedRx.status;
  console.log(
    `getAllLPTokenCount code: ${response.contractFunctionResult!.getInt256()}`
  );
  return response.contractFunctionResult!.getInt256();
};

async function main() {
  let index = 0;
  for (const contract of contracts) {
    tokenA = await createToken("A" + index);
    tokenB = await createToken("B" + index);
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
  await initializeLPTokenContract(lpTokenProxyId);
  await getLpTokenAddress(lpTokenProxyId);
  console.log(
    `\nUsing pair proxy contractId ${contract.id} and LP token contract proxy id ${lpTokenProxyId} \n`
  );
  await initialize(contractProxyId, lpContract.transparentProxyAddress!);
  await getPrecisionValue(contractProxyId);
  await getTreasureBalance([tokenA, tokenB]);

  const tokensBeforeAddingLiquidity = await pairCurrentPosition(
    contractProxyId
  );
  const tokenAQty = withPrecision(210);
  const tokenBQty = withPrecision(230);
  await addLiquidity(contractProxyId, tokenAQty, tokenBQty);
  const tokensAfterAddingLiquidity = await pairCurrentPosition(contractProxyId);
  expect(tokensAfterAddingLiquidity[0]).to.be.equal(
    BigNumber.sum(tokensBeforeAddingLiquidity[0], tokenAQty)
  );
  expect(tokensAfterAddingLiquidity[1]).to.be.equal(
    BigNumber.sum(tokensBeforeAddingLiquidity[1], tokenBQty)
  );

  await getTreasureBalance([tokenA, tokenB]);
  const allLPTokens = await getAllLPTokenCount(lpTokenProxyId);
  const tokenBeforeRemovingLiquidity = await pairCurrentPosition(
    contractProxyId
  );
  const lpToken = withPrecision(5);
  await removeLiquidity(contractProxyId, lpToken);
  const tokenAQuantity = (
    (lpToken * tokenBeforeRemovingLiquidity[0]) /
    allLPTokens
  ).toFixed();
  const tokenBQuantity = (
    (lpToken * tokenBeforeRemovingLiquidity[1]) /
    allLPTokens
  ).toFixed();
  const tokenALeftInPool = BigNumber(
    tokenBeforeRemovingLiquidity[0] - BigNumber(tokenAQuantity)
  );
  const tokenBLeftInPool = BigNumber(
    tokenBeforeRemovingLiquidity[1] - BigNumber(tokenBQuantity)
  );

  const tokenAfterRemovingLiquidity = await pairCurrentPosition(
    contractProxyId
  );
  expect(tokenALeftInPool).to.be.equal(tokenAfterRemovingLiquidity[0]);
  expect(tokenBLeftInPool).to.be.equal(tokenAfterRemovingLiquidity[1]);
  await getTokenPairAddress(contractProxyId);

  const tokensBeforeSwap = await pairCurrentPosition(contractProxyId);
  await swapTokenA(contractProxyId);
  const tokensAfterSwap = await pairCurrentPosition(contractProxyId);
  expect(tokensAfterSwap[0]).to.be.greaterThan(tokensBeforeSwap[0]);
  expect(tokensAfterSwap[1]).to.be.lessThan(tokensBeforeSwap[1]);

  const sportPrice = await spotPrice(contractProxyId);
  expect(sportPrice).not.to.be.lessThan(0);

  const variantVal = await getVariantValue(contractProxyId);
  expect(variantVal).not.to.be.lessThan(0);

  const getOutGivenInVal = await getOutGivenIn(contractProxyId);
  expect(getOutGivenInVal).not.to.be.lessThan(0);

  const getInGivenOutVal = await getInGivenOut(contractProxyId);
  expect(getInGivenOutVal).not.to.be.lessThan(0);

  const slippageOutGivenInVal = await slippageOutGivenIn(contractProxyId);
  expect(slippageOutGivenInVal).not.to.be.lessThan(0);

  const slippageInGivenOutVal = await slippageInGivenOut(contractProxyId);
  expect(slippageInGivenOutVal).not.to.be.lessThan(0);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
