import Common from "../e2e-test/business/Common";

import { Helper } from "../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../utils/ClientManagement";
import { InstanceProvider } from "../utils/InstanceProvider";

const TOKEN_A_QTY = Common.withPrecision(10, 1e8);
const TOKEN_B_QTY = Common.withPrecision(10, 1e8);
const TOKEN_LP_QTY = Common.withPrecision(5, 1e8);

const TOKEN_NAME = "LP-Token-Name";
const TOKEN_SYMBOL = "LP-Token-Symbol";

async function main() {
  const lpToken = InstanceProvider.getInstance().getLpToken();
  await lpToken.initialize(
    TOKEN_NAME,
    TOKEN_SYMBOL,
    clientsInfo.operatorId,
    clientsInfo.operatorClient
  );
  const tokenId = TokenId.fromSolidityAddress(
    await lpToken.getLpTokenAddress(clientsInfo.treasureClient)
  );
  await Common.associateTokensToAccount(
    clientsInfo.treasureId,
    [tokenId],
    clientsInfo.treasureClient,
    clientsInfo.treasureKey
  );
  await lpToken.allotLPToken(
    TOKEN_A_QTY,
    TOKEN_B_QTY,
    clientsInfo.treasureId,
    clientsInfo.operatorClient
  );
  await Common.setTokenAllowance(
    tokenId,
    lpToken.contractId,
    TOKEN_LP_QTY.toNumber(),
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient
  );
  await lpToken.removeLPToken(
    TOKEN_LP_QTY,
    clientsInfo.treasureId,
    clientsInfo.operatorClient
  );
  await lpToken.getAllLPTokenCount(clientsInfo.treasureClient);
  await lpToken.lpTokenForUser(clientsInfo.treasureId);
  await lpToken.upgradeHederaService();
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
