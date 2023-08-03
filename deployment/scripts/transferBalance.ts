import dex from "../model/dex";
import Common from "../../e2e-test/business/Common";

import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import { AccountId, PrivateKey } from "@hashgraph/sdk";

const accounts = dex.ACCOUNTS;

const TARGET_ACCOUNT = "0.0.78391";
const TARGET_ACCOUNT_1 = "0.0.78619";

const EXCLUDED_ACCOUNTS = [TARGET_ACCOUNT, TARGET_ACCOUNT_1];

async function main() {
  await transferHBarBalances();
  await fetchHBarBalances();
  return "Executed Successfully";
}

async function transferHBarBalances() {
  const finalAccounts = accounts.filter(
    (item: any) => !EXCLUDED_ACCOUNTS.includes(item.id)
  );
  for (const senderAccountInfo of finalAccounts) {
    await Common.transferHBars(
      AccountId.fromString(TARGET_ACCOUNT),
      AccountId.fromString(senderAccountInfo.id),
      PrivateKey.fromString(senderAccountInfo.key)
    );
  }
}

async function fetchHBarBalances() {
  await Promise.all(
    accounts.map(async (item: any) => {
      await Common.getAccountBalance(
        AccountId.fromString(item.id),
        undefined,
        clientsInfo.operatorClient
      );
    })
  );
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
