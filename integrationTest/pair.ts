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
const htsAddress = csDev.getContract(csDev.baseContractName).address;

const lpTokenContracts = [
  csDev.getContractWithProxyAtIndex(csDev.lpTokenContractName, 0),
  csDev.getContractWithProxyAtIndex(csDev.lpTokenContractName, 1),
];
const pairContracts = [
  csDev.getContractWithProxyAtIndex(csDev.pairContractName, 0),
  csDev.getContractWithProxyAtIndex(csDev.pairContractName, 1),
];

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
    await lpToken.initialize(htsAddress, lpTokenName, lpTokenSymbol);
  } catch (error) {
    console.error(error);
  }
};

const initializePairContract = async () => {
  try {
    const lpContractId = ContractId.fromString(lpToken.contractId);
    const lpContractAddress = lpContractId.toSolidityAddress();
    await pair.initialize(
      htsAddress,
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

const setSlippage = async (slippage: BigNumber) => {
  await pair.setSlippage(slippage);
};

const spotPrice = async () => {
  await pair.getSpotPrice();
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

const addLiquidity = async () => {
  await pair.addLiquidity(
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    tokenA,
    2.1,
    tokenB,
    2.3,
    precision,
    clientsInfo.treasureClient
  );
  await pair.getPairQty();
};

const removeLiquidity = async () => {
  const lpTokenQty = Common.withPrecision(0.05, precision);
  await pair.removeLiquidity(
    lpTokenQty,
    clientsInfo.treasureId,
    clientsInfo.treasureKey
  );
  await pair.getPairQty();
};

const swapTokenA = async () => {
  await pair.swapToken(
    tokenA,
    0.01,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    precision
  );
  await pair.getPairQty();
};

async function main() {
  const tokens = [tokenHBARX, token0, token1, token2];
  let index = 0;
  for (const contract of pairContracts) {
    tokenA = tokens[index];
    tokenB = tokens[index + 1];
    await testForSinglePair(contract, lpTokenContracts[index]);
    index++;
  }
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
  lpToken = new LpToken(lpContract.transparentProxyId!);
  pair = new Pair(pairContract.transparentProxyId!);

  await initializeLPTokenContract();
  await getLpTokenAddress();

  await initializePairContract();
  await getPrecisionValue();
  await getTokenPairAddress();
  await getAccountTokensBalance();
  await addLiquidity();
  await getAccountTokensBalance();
  await removeLiquidity();
  await getAccountTokensBalance();
  await setSlippage(new BigNumber(50000000));
  await swapTokenA();
  await spotPrice();
  await getVariantValue();
  await getOutGivenIn();
  await getInGivenOut();
  await slippageOutGivenIn();
  await slippageInGivenOut();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
