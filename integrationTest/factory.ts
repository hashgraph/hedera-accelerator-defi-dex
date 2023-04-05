import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../utils/ClientManagement";
import { ContractService } from "../deployment/service/ContractService";
import { ContractId, TokenId, AccountId } from "@hashgraph/sdk";

import dex from "../deployment/model/dex";
import Pair from "../e2e-test/business/Pair";
import Common from "../e2e-test/business/Common";
import Factory from "../e2e-test/business/Factory";
import Configuration from "../e2e-test/business/Configuration";

const tokenA = TokenId.fromString(dex.TOKEN_LAB49_1);
const tokenB = TokenId.fromString(dex.TOKEN_LAB49_2);
const tokenC = TokenId.fromString(dex.TOKEN_LAB49_3);
const tokenGOD = TokenId.fromString(dex.GOD_TOKEN_ID);
const tokenHBARX = TokenId.fromString(dex.HBARX_TOKEN_ID);

const csDev = new ContractService();
const factoryContractId = csDev.getContractWithProxy(csDev.factoryContractName)
  .transparentProxyId!;

let pair: Pair;
let precision = BigNumber(0);
const factory = new Factory(factoryContractId);

const configurationContractId = csDev.getContractWithProxy(csDev.configuration)
  .transparentProxyId!;

const configuration = new Configuration(configurationContractId);

const getPrecisionValue = async () => {
  precision = await pair.getPrecisionValue();
};

const getTreasureBalance = async (
  account: AccountId | ContractId,
  tokens: TokenId[]
) => {
  await Common.getAccountBalance(account, tokens);
  await pair.getPairQty();
};

const getTokensInfo = async (token0: TokenId, token1: TokenId) => {
  await Common.getTokenInfo(token0);
  await Common.getTokenInfo(token1);
};

const createPair = async (token0: TokenId, token1: TokenId, fee: BigNumber) => {
  const feeCollectionAccountId = clientsInfo.operatorId;

  return await factory.createPair(
    token0,
    token1,
    feeCollectionAccountId,
    clientsInfo.uiUserKey,
    clientsInfo.uiUserClient,
    fee
  );
};

const addLiquidity = async (token0: TokenId, token1: TokenId) => {
  await pair.addLiquidity(
    clientsInfo.uiUserId,
    clientsInfo.uiUserKey,
    token0,
    2.1,
    token1,
    2.3,
    precision,
    clientsInfo.uiUserClient
  );
};

const removeLiquidity = async () => {
  const lpTokenQty = Common.withPrecision(0.05, precision);
  await pair.removeLiquidity(
    lpTokenQty,
    clientsInfo.uiUserId,
    clientsInfo.uiUserKey,
    clientsInfo.uiUserClient
  );
};

const swapToken = async (token: TokenId) => {
  await pair.swapToken(
    token,
    0.01,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    precision,
    BigNumber(0)
  );
};

const recommendedPairToSwap = async (
  tokenAddress: TokenId,
  otherTokenAddress: TokenId,
  qtyToSwap: number
) => {
  await factory.recommendedPairToSwap(
    tokenAddress.toSolidityAddress(),
    otherTokenAddress.toSolidityAddress(),
    Common.withPrecision(qtyToSwap, 100000000)
  );
};

async function main() {
  await factory.setupFactory();
  const fees = await configuration.getTransactionsFee();
  await testForSinglePair(tokenB, tokenHBARX, fees[1]);
  await testForSinglePair(tokenA, tokenC, fees[3]);
  await testForSinglePair(tokenA, tokenB, fees[1]);
  await testForSinglePair(tokenA, tokenGOD, fees[5]);
  await factory.getPairs();
  await recommendedPairToSwap(tokenB, tokenHBARX, 1);
  await recommendedPairToSwap(tokenA, tokenC, 1);
  await recommendedPairToSwap(tokenA, tokenB, 1);
  await recommendedPairToSwap(tokenA, tokenGOD, 1);
}

async function testForSinglePair(
  token0: TokenId,
  token1: TokenId,
  fee: BigNumber = new BigNumber(15)
) {
  await getTokensInfo(token0, token1);
  const pairContractAddress = await createPair(token0, token1, fee);
  const pairContractId = ContractId.fromSolidityAddress(pairContractAddress);
  pair = new Pair(pairContractId.toString());
  await getPrecisionValue();
  await getTreasureBalance(pairContractId, [token0, token1]);
  await addLiquidity(token0, token1);
  await getTreasureBalance(pairContractId, [token0, token1]);
  await removeLiquidity();
  await pair.setSlippage(Common.withPrecision(1, precision));
  await getTreasureBalance(pairContractId, [token0, token1]);
  await swapToken(token0);
  await getTreasureBalance(pairContractId, [token0, token1]);
  await swapToken(token1);
  await getTreasureBalance(pairContractId, [token0, token1]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
