import Common from "../e2e-test/business/Common";
import LpToken from "../e2e-test/business/LpToken";

import { Helper } from "../utils/Helper";
import { clientsInfo } from "../utils/ClientManagement";
import { ContractService } from "../deployment/service/ContractService";
import { TokenId } from "@hashgraph/sdk";

const csDev = new ContractService();
const lpContract = csDev.getContractWithProxy(csDev.lpTokenContractName);

const precision = 1e8;
let lpToken: LpToken;
const tokenAQty = Common.withPrecision(10, precision);
const tokenBQty = Common.withPrecision(10, precision);
const removeTokenQty = Common.withPrecision(5, precision);

const initialize = async (tokenName: string, tokenSymbol: string) => {
  try {
    await lpToken.initialize(tokenName, tokenSymbol);
  } catch (error) {
    console.error(error);
  }
};

const allotLPToken = async () => {
  await lpToken.allotLPToken(
    tokenAQty,
    tokenBQty,
    clientsInfo.treasureId,
    clientsInfo.treasureKey
  );
};

const lpTokenCountForGivenTokensQty = async () => {
  return await lpToken.lpTokenCountForGivenTokensQty(tokenAQty, tokenBQty);
};

const removeLPToken = async () => {
  await lpToken.removeLPToken(
    removeTokenQty,
    clientsInfo.treasureId,
    clientsInfo.treasureKey
  );
};

const getLpTokenCountForUser = async () => {
  return await lpToken.lpTokenForUser(clientsInfo.treasureId);
};

const getAllLPTokenCount = async () => {
  return await lpToken.getAllLPTokenCount();
};

const getLpTokenAddress = async () => {
  return await lpToken.getLpTokenAddress();
};

async function main() {
  lpToken = new LpToken(lpContract.transparentProxyId!);
  await initialize("tokenName", "tokenSymbol");
  const lpTokenAddress = await getLpTokenAddress();

  const tokenId = TokenId.fromSolidityAddress(lpTokenAddress);
  await Common.associateTokensToAccount(
    clientsInfo.treasureId,
    [tokenId],
    clientsInfo.treasureClient,
    clientsInfo.treasureKey
  );
  const lpTokenCountForAllowance = await lpTokenCountForGivenTokensQty();
  await Common.setTokenAllowance(
    tokenId,
    clientsInfo.treasureId,
    Number(lpTokenCountForAllowance),
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient
  );

  await Helper.delay(1 * 1000);

  await allotLPToken();
  await Common.setTokenAllowance(
    tokenId,
    lpContract.transparentProxyId!,
    Number(removeTokenQty),
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient
  );
  await Helper.delay(1 * 1000);
  await removeLPToken();
  await getAllLPTokenCount();
  await getLpTokenCountForUser();
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
