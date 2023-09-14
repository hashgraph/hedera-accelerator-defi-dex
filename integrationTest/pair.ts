import { Helper } from "../utils/Helper";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../utils/ClientManagement";
import { ContractService } from "../deployment/service/ContractService";
import { DeployedContract } from "../deployment/model/contract";
import { TokenId, ContractId } from "@hashgraph/sdk";

import dex from "../deployment/model/dex";
import Pair from "../e2e-test/business/Pair";
import LpToken from "../e2e-test/business/LpToken";
import Common from "../e2e-test/business/Common";

const token0 = TokenId.fromString(dex.TOKEN_LAB49_1);
const token1 = TokenId.fromString(dex.TOKEN_LAB49_2);
const token2 = TokenId.fromString(dex.TOKEN_LAB49_3);
const tokenHBARX = TokenId.fromString(dex.HBARX_TOKEN_ID);

const csDev = new ContractService();

const lpTokenContract = csDev.getContractWithProxyAtIndex(
  csDev.lpTokenContractName,
  0
);
const pairContract = csDev.getContractWithProxyAtIndex(
  csDev.pairContractName,
  0
);

let tokenA: TokenId;
let tokenB: TokenId;

let pair: Pair;
let lpToken: LpToken;
let precision = BigNumber(0);

const initializeLPTokenContract = async () => {
  try {
    const { lpTokenSymbol, lpTokenName } = await Common.createLPTokenName(
      tokenA,
      tokenB
    );
    await lpToken.initialize(
      lpTokenName,
      lpTokenSymbol,
      ContractId.fromSolidityAddress(pairContract.transparentProxyAddress!)
    );
  } catch (error) {
    console.error(error);
  }
};

const initializePairContract = async () => {
  try {
    const lpContractId = ContractId.fromString(lpToken.contractId);
    const lpContractAddress = lpContractId.toSolidityAddress();
    await pair.initialize(
      lpContractAddress,
      clientsInfo.operatorId,
      clientsInfo.treasureKey,
      tokenA,
      tokenB
    );
  } catch (error) {
    console.error(error);
  }
};

const getLpTokenAddress = async () => {
  return await lpToken.getLpTokenAddress();
};

const getAccountTokensBalance = async () => {
  const tokens = [tokenA, tokenB];
  return await Common.getAccountBalance(clientsInfo.treasureId, tokens);
};

const getTokenPairAddress = async () => {
  return await pair.getTokenPairAddress();
};

const getPrecisionValue = async () => {
  precision = await pair.getPrecisionValue();
};

const spotPrice = async () => {
  await pair.getSpotPrice(tokenA);
};

const getVariantValue = async () => {
  await pair.getVariantValue();
};

const getOutGivenIn = async () => {
  const tokenAQty = Common.withPrecision(10, precision);
  await pair.getOutGivenIn(tokenAQty);
};

const getInGivenOut = async () => {
  const tokenBQty = Common.withPrecision(11, precision);
  await pair.getInGivenOut(tokenBQty);
};

const slippageOutGivenIn = async () => {
  const tokenAQty = Common.withPrecision(10, precision);
  await pair.slippageOutGivenIn(tokenAQty);
};

const slippageInGivenOut = async () => {
  const tokenBQty = Common.withPrecision(12, precision);
  await pair.slippageInGivenOut(tokenBQty);
};

const addLiquidity = async (lpTokenAddress: string) => {
  const tokenAQty = 2.1;
  const tokenBQty = 2.3;
  const userId = clientsInfo.treasureId;
  const userKey = clientsInfo.treasureKey;
  const userClient = clientsInfo.treasureClient;

  await Common.setTokenAllowance(
    tokenA,
    pairContract.transparentProxyId!,
    Number(Common.withPrecision(tokenAQty, precision)),
    userId,
    userKey,
    userClient
  );

  await Common.setTokenAllowance(
    tokenB,
    pairContract.transparentProxyId!,
    Number(Common.withPrecision(tokenBQty, precision)),
    userId,
    userKey,
    userClient
  );

  await Common.associateTokensToAccount(
    userId,
    [TokenId.fromSolidityAddress(lpTokenAddress)],
    userClient
  );

  await pair.addLiquidity(
    userId,
    userKey,
    tokenA,
    tokenAQty,
    tokenB,
    tokenBQty,
    precision,
    userClient
  );
  await pair.getPairQty();
};

const removeLiquidity = async (lpTokenAddress: string) => {
  const lpTokenQty = Common.withPrecision(0.05, precision);

  await Common.setTokenAllowance(
    TokenId.fromSolidityAddress(lpTokenAddress),
    lpTokenContract.transparentProxyId!,
    Number(lpTokenQty),
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient
  );

  await pair.removeLiquidity(
    lpTokenQty,
    clientsInfo.treasureId,
    clientsInfo.treasureKey
  );

  await pair.getPairQty();
};

const swapTokenA = async () => {
  const swapTokenAQty = 0.01;

  await Common.setTokenAllowance(
    tokenA,
    pairContract.transparentProxyId!,
    Number(Common.withPrecision(swapTokenAQty, precision)),
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient
  );

  await pair.swapToken(
    tokenA,
    swapTokenAQty,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    precision,
    BigNumber(0)
  );
  await pair.getPairQty();
};

async function main() {
  const tokens = [tokenHBARX, token0];
  tokenA = tokens[0];
  tokenB = tokens[1];
  await testForSinglePair(pairContract, lpTokenContract);
  console.log(`Done`);
}

async function testForSinglePair(
  pairContract: DeployedContract,
  lpContract: DeployedContract
) {
  console.log(`- Running test with below inputs:`);
  console.log(` - Pair contractId = ${pairContract.transparentProxyId}`);
  console.log(` - Lp contractId = ${lpContract.transparentProxyId}`);
  console.log(` - Token Id = ${tokenA}`);
  console.log(` - Token Id = ${tokenB}\n`);
  lpToken = new LpToken(ContractId.fromString(lpContract.transparentProxyId!));
  pair = new Pair(ContractId.fromString(pairContract.transparentProxyId!));

  await initializeLPTokenContract();
  const lpTokenAddress = await getLpTokenAddress();

  await initializePairContract();
  await getPrecisionValue();
  await getTokenPairAddress();
  await getAccountTokensBalance();
  await addLiquidity(lpTokenAddress);
  await pair.getPairInfo();
  await getAccountTokensBalance();
  await removeLiquidity(lpTokenAddress);
  await getAccountTokensBalance();
  await swapTokenA();
  await spotPrice();
  await getVariantValue();
  await getOutGivenIn();
  await getInGivenOut();
  await slippageOutGivenIn();
  await slippageInGivenOut();
  await pair.upgradeHederaService();
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
