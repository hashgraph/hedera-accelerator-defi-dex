import { Helper } from "../utils/Helper";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../utils/ClientManagement";
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

let pair: Pair;
let precision = BigNumber(0);
const factory = new Factory();

const configuration = new Configuration();

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

const getLPTokenContractId = async () => {
  const address = await pair.getLpContractAddress();
  return ContractId.fromSolidityAddress(address).toString();
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

const addLiquidity = async (
  token0: TokenId,
  token1: TokenId,
  lpTokenAddress: string,
  pairContractId: string
) => {
  const tokenAQty = 2.1;
  const tokenBQty = 2.3;
  const userId = clientsInfo.uiUserId;
  const userKey = clientsInfo.uiUserKey;
  const userClient = clientsInfo.uiUserClient;

  await Common.associateTokensToAccount(userId, [token0], userClient);

  await Common.associateTokensToAccount(userId, [token1], userClient);

  await Common.associateTokensToAccount(
    userId,
    [TokenId.fromSolidityAddress(lpTokenAddress)],
    userClient
  );

  await Common.setTokenAllowance(
    token0,
    pairContractId,
    Number(Common.withPrecision(tokenAQty, precision)),
    userId,
    userKey,
    userClient
  );

  await Common.setTokenAllowance(
    token1,
    pairContractId,
    Number(Common.withPrecision(tokenBQty, precision)),
    userId,
    userKey,
    userClient
  );

  await pair.addLiquidity(
    userId,
    userKey,
    token0,
    tokenAQty,
    token1,
    tokenBQty,
    precision,
    userClient
  );
};

const removeLiquidity = async (lpTokenAddress: string) => {
  const lpTokenQty = Common.withPrecision(0.05, precision);

  const lpTokenContractId = await getLPTokenContractId();

  await Common.setTokenAllowance(
    TokenId.fromSolidityAddress(lpTokenAddress),
    lpTokenContractId,
    Number(lpTokenQty),
    clientsInfo.uiUserId,
    clientsInfo.uiUserKey,
    clientsInfo.uiUserClient
  );

  await pair.removeLiquidity(
    lpTokenQty,
    clientsInfo.uiUserId,
    clientsInfo.uiUserKey,
    clientsInfo.uiUserClient
  );
};

const swapToken = async (token: TokenId, pairContractId: string) => {
  const swapTokenAQty = 0.01;

  await Common.setTokenAllowance(
    token,
    pairContractId,
    Number(Common.withPrecision(swapTokenAQty, precision)),
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient
  );

  await pair.swapToken(
    token,
    swapTokenAQty,
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

const getTokenPairAddress = async () => {
  return await pair.getTokenPairAddress();
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
  const pairContractIdAsString = pairContractId.toString();
  pair = new Pair(pairContractId);
  await getPrecisionValue();
  await getTreasureBalance(pairContractId, [token0, token1]);
  const tokenAddresses = await getTokenPairAddress();
  await addLiquidity(
    token0,
    token1,
    tokenAddresses.lpTokenAddress,
    pairContractIdAsString
  );
  await getTreasureBalance(pairContractId, [token0, token1]);
  await removeLiquidity(tokenAddresses.lpTokenAddress);
  await pair.setSlippage(Common.withPrecision(1, precision));
  await getTreasureBalance(pairContractId, [token0, token1]);
  await swapToken(token0, pairContractIdAsString);
  await getTreasureBalance(pairContractId, [token0, token1]);
  await swapToken(token1, pairContractId.toString());
  await getTreasureBalance(pairContractId, [token0, token1]);
  await factory.upgradeHederaService(clientsInfo.childProxyAdminClient);
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
