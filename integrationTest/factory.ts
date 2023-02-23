import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../utils/ClientManagement";
import { ContractService } from "../deployment/service/ContractService";
import { ContractId, TokenId, AccountId } from "@hashgraph/sdk";

import dex from "../deployment/model/dex";
import Pair from "../e2e-test/business/Pair";
import Common from "../e2e-test/business/Common";
import Factory from "../e2e-test/business/Factory";

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

async function main() {
  await factory.setupFactory();
  await testForSinglePair(tokenB, tokenHBARX);
  await testForSinglePair(tokenA, tokenC);
  await testForSinglePair(tokenA, tokenB);
  await testForSinglePair(tokenA, tokenGOD);
  await factory.getPairs();
}

async function testForSinglePair(
  token0: TokenId,
  token1: TokenId,
  fee: BigNumber = new BigNumber(15)
) {
  await getTokensInfo(token0, token1);
  const pairContractAddress = await createPair(token0, token1, fee);
  const pairContractId =
    ContractId.fromSolidityAddress(pairContractAddress).toString();
  pair = new Pair(pairContractId);
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
