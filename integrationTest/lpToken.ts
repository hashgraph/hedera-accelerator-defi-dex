import Common from "../e2e-test/business/Common";
import LpToken from "../e2e-test/business/LpToken";

import { Helper } from "../utils/Helper";
import { clientsInfo } from "../utils/ClientManagement";
import { ContractService } from "../deployment/service/ContractService";

const csDev = new ContractService();
const lpContracts = [csDev.getContractWithProxy(csDev.lpTokenContractName)];

const precision = 1e8;
let lpToken: LpToken;

const initialize = async (tokenName: string, tokenSymbol: string) => {
  try {
    await lpToken.initialize(tokenName, tokenSymbol);
  } catch (error) {
    console.error(error);
  }
};

const allotLPToken = async () => {
  const tokenAQty = Common.withPrecision(10, precision);
  const tokenBQty = Common.withPrecision(10, precision);
  await lpToken.allotLPToken(
    tokenAQty,
    tokenBQty,
    clientsInfo.treasureId,
    clientsInfo.treasureKey
  );
};

const removeLPToken = async () => {
  const lpTokenQty = Common.withPrecision(5, precision);
  await lpToken.removeLPToken(
    lpTokenQty,
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
  for (const contract of lpContracts) {
    await forSingleContract(contract.transparentProxyId!);
  }
}

async function forSingleContract(contractId: string) {
  lpToken = new LpToken(contractId);
  await initialize("tokenName", "tokenSymbol");
  await getLpTokenAddress();
  await allotLPToken();
  await removeLPToken();
  await getAllLPTokenCount();
  await getLpTokenCountForUser();
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
