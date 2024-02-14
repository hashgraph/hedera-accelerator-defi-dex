import { AccountId, TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";

import dex from "../model/dex";
import Common from "../../e2e-test/business/Common";

async function main() {
  await Common.transferAssets(
    dex.GOD_TOKEN_ID,
    100000 * 1e8,
    AccountId.fromString("0.0.3418053"),
    clientsInfo.uiUserId,
    clientsInfo.uiUserKey,
  );
  await Common.getTokenBalance(
    AccountId.fromString("0.0.3418053"),
    TokenId.fromString(dex.GOD_TOKEN_ID),
  );
  return "executed successfully";
}

main()
  .then((res) => console.log(res))
  .catch((err) => console.error(err))
  .finally(() => process.exit(0));
