import dex from "../../deployment/model/dex";
import Common from "../../e2e-test/business/Common";
import NFTToken from "../../e2e-test/business/NFTToken";

import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import { MirrorNodeService } from "../../utils/MirrorNodeService";
import {
  TokenId,
  Client,
  AccountId,
  ContractId,
  PrivateKey,
} from "@hashgraph/sdk";

async function main() {
  for (const item of dex.ACCOUNTS) {
    await resetTask(
      AccountId.fromString(item.id),
      PrivateKey.fromString(item.key),
    );
  }
  await resetNFTAllowance(dex.E2E_NFT_TOKEN_ID);
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

async function resetNFTAllowance(tokenId: TokenId | string) {
  console.log("------------------------------------------");
  console.log(
    `Resetting NFT allowance in progress for Token ${tokenId.toString()} ...`,
  );
  const contractId = ContractId.fromString(tokenId.toString());
  const client = Client.forTestnet();
  const allowances = await MirrorNodeService.getInstance()
    .disableLogs()
    .getNFTTokenAllowanceSpenders(tokenId);
  await Promise.all(
    allowances.map(async (allowance: any) => {
      try {
        const owner = allowance.owner;
        const ownerAccountId = AccountId.fromEvmAddress(0, 0, owner);
        const ownerPrivateKey = getFromAccountPrivateKey(
          ownerAccountId.toString(),
        );
        const ownerClient = client.setOperator(ownerAccountId, ownerPrivateKey);
        const spender = allowance.operator;
        await new NFTToken(contractId).setApprovalForAll(
          spender,
          false,
          ownerClient,
        );
      } catch (error: any) {
        console.error(" - resetNFTAllowance sub-task failed:", error.message);
      }
    }),
  );
  console.log(`Resetting NFT allowance done for Token ${tokenId.toString()}`);
  console.log("------------------------------------------\n\n");
}

function getFromAccountPrivateKey(fromAccountId: string) {
  return PrivateKey.fromString(
    dex.ACCOUNTS.find((item: any) => item.id === fromAccountId)?.key ??
      clientsInfo.operatorKey.toStringRaw(),
  );
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
