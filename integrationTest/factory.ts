import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../utils/ClientManagement";
import { ContractService } from "../deployment/service/ContractService";
import { ContractId, TokenId } from "@hashgraph/sdk";

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
const htsAddress = csDev.getContract(csDev.baseContractName).address;
const factoryContractId = csDev.getContractWithProxy(csDev.factoryContractName)
  .transparentProxyId!;

let pair: Pair;
let precision = BigNumber(0);
const factory = new Factory(factoryContractId);

const setupFactory = async () => {
  try {
    const adminAddress = clientsInfo.dexOwnerId.toSolidityAddress();
    await factory.setupFactory(htsAddress, adminAddress);
  } catch (error) {
    console.error(error);
  }
};

const getPrecisionValue = async () => {
  precision = await pair.getPrecisionValue();
};

const getTreasureBalance = async (tokens: TokenId[]) => {
  await Common.getAccountBalance(clientsInfo.treasureId, tokens);
};

const getTokensInfo = async (token0: TokenId, token1: TokenId) => {
  await Common.getTokenInfo(token0);
  await Common.getTokenInfo(token1);
};

const createPair = async (token0: TokenId, token1: TokenId) => {
  const feeCollectionAccountId = clientsInfo.operatorId;
  const tokensOwnerKey = clientsInfo.treasureKey;
  return await factory.createPair(
    token0,
    token1,
    feeCollectionAccountId,
    tokensOwnerKey
  );
};

const addLiquidity = async (token0: TokenId, token1: TokenId) => {
  await pair.addLiquidity(
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    token0,
    2.1,
    token1,
    2.3,
    precision,
    clientsInfo.treasureClient
  );
};

const removeLiquidity = async () => {
  const lpTokenQty = Common.withPrecision(0.05, precision);
  await pair.removeLiquidity(
    lpTokenQty,
    clientsInfo.treasureId,
    clientsInfo.treasureKey
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
  await setupFactory();
  await testForSinglePair(tokenB, tokenHBARX);
  await testForSinglePair(tokenB, tokenC);
  await testForSinglePair(tokenA, tokenGOD);
  await factory.getPairs();
}

async function testForSinglePair(token0: TokenId, token1: TokenId) {
  await getTokensInfo(token0, token1);
  const pairContractAddress = await createPair(token0, token1);
  const pairContractId =
    ContractId.fromSolidityAddress(pairContractAddress).toString();
  pair = new Pair(pairContractId);
  await getPrecisionValue();
  await getTreasureBalance([token0, token1]);
  await addLiquidity(token0, token1);
  await getTreasureBalance([token0, token1]);
  await removeLiquidity();
  await getTreasureBalance([token0, token1]);
  await swapToken(token0);
  await swapToken(token1);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
