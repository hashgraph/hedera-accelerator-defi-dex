import dex from "../../deployment/model/dex";
import Common from "../../e2e-test/business/Common";

import { Helper } from "../../utils/Helper";
import { MirrorNodeService } from "../../utils/MirrorNodeService";
import { TokenId, Client, PrivateKey, AccountId } from "@hashgraph/sdk";

async function main() {
  for (const item of dex.ACCOUNTS) {
    await resetTask(
      AccountId.fromString(item.id),
      PrivateKey.fromString(item.key),
    );
  }
}

async function resetTask(accountId: AccountId, privateKey: PrivateKey) {
  const client = Client.forTestnet().setOperator(accountId, privateKey);
  try {
    await resetTokenAllowance(accountId, privateKey, client);
  } catch (error) {
    console.log(error);
  }
  try {
    await resetCryptoAllowance(accountId, privateKey, client);
  } catch (error) {
    console.log(error);
  }
}

async function resetTokenAllowance(
  accountId: AccountId,
  key: PrivateKey,
  client: Client,
) {
  console.log("------------------------------------------");
  console.log(
    `Resetting token allowance in progress ${accountId.toString()} ...`,
  );
  const allowances = await MirrorNodeService.getInstance()
    .enableLogs()
    .getTokenAllowanceSpenders(accountId);
  for (const allowance of allowances) {
    const spender = allowance.spender;
    const tokenId = TokenId.fromString(allowance.token_id);
    await Common.setTokenAllowance(tokenId, spender, 0, accountId, key, client);
  }
  console.log(`Resetting token allowance done ${accountId.toString()}`);
  console.log("------------------------------------------\n\n");
}

async function resetCryptoAllowance(
  accountId: AccountId,
  key: PrivateKey,
  client: Client,
) {
  console.log("------------------------------------------");
  console.log(
    `Resetting HBar allowance in progress ${accountId.toString()} ...`,
  );
  const allowances = await MirrorNodeService.getInstance()
    .enableLogs()
    .getCryptoAllowanceSpenders(accountId);
  for (const allowance of allowances) {
    const spender = allowance.spender;
    const tokenId = TokenId.fromString(dex.HBARX_TOKEN_ID);
    await Common.setTokenAllowance(tokenId, spender, 0, accountId, key, client);
  }
  console.log(`Resetting HBar allowance done ${accountId.toString()}`);
  console.log("------------------------------------------\n\n");
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
