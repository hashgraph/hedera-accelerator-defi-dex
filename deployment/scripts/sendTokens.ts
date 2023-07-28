import { AccountId, TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";

import dex from "../model/dex";
import Common from "../../e2e-test/business/Common";

async function main() {
  await Common.transferTokens(
    AccountId.fromString("0.0.78391"),
    clientsInfo.uiUserId,
    clientsInfo.uiUserKey,
    dex.GOD_TOKEN_ID,
    100000 * 1e8
  );
  await Common.getTokenBalance(
    AccountId.fromString("0.0.78391"),
    TokenId.fromString(dex.GOD_TOKEN_ID)
  );
  return "executed successfully";
}

main()
  .then((res) => console.log(res))
  .catch((err) => console.error(err))
  .finally(() => process.exit(0));
