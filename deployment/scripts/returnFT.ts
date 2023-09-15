import fs from "fs-extra";
import dex from "../model/dex";
import Common from "../../e2e-test/business/Common";

import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import { MirrorNodeService } from "../../utils/MirrorNodeService";
import { AccountId, PrivateKey } from "@hashgraph/sdk";

const ACCOUNTS = dex.ACCOUNTS;
const TOKEN_ID = "0.0.8576";
const TOKENS_PATH = "./deployment/state/token_balances.json";

async function main() {
  await fetchBalance();
  await transfer();
}

async function fetchBalance() {
  const balances = await MirrorNodeService.getInstance()
    .enableLogs()
    .getTokensAccountBalance(TOKEN_ID.toString());
  fs.writeJSONSync(TOKENS_PATH, balances, {
    spaces: 2,
  });
}

async function transfer() {
  const eoaAccountList = ACCOUNTS.map((account: any) => String(account.id));
  console.log("- excluding EOA's accounts i.e", eoaAccountList);
  const mirrorNode = MirrorNodeService.getInstance().disableLogs();
  const balances = fs.readJSONSync(TOKENS_PATH);
  await Promise.all(
    balances
      .filter((item: any) => {
        return !eoaAccountList.includes(item.account);
      })
      .map(async (item: any) => {
        try {
          const creator = await mirrorNode.getContractCreator(item.account);
          const creatorId = AccountId.fromSolidityAddress(creator).toString();
          const creatorKey = getAccountKey(creatorId);
          if (creatorKey === undefined) {
            throw Error(`No account exist : ${creatorId}`);
          }
          await Common.transferAssets(
            TOKEN_ID.toString(),
            item.balance,
            clientsInfo.treasureId,
            AccountId.fromString(item.account),
            PrivateKey.fromString(creatorKey),
            clientsInfo.operatorClient,
          );
        } catch (error: any) {
          console.log("transfer: ", error.message, item);
        }
      }),
  );

  function getAccountKey(accountId: string) {
    return ACCOUNTS.find((item: any) => item.id === accountId)?.key;
  }
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
