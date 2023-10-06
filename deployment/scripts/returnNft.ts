import dex from "../model/dex";
import Common from "../../e2e-test/business/Common";

import { Helper } from "../../utils/Helper";
import { PrivateKey, TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { MirrorNodeService } from "../../utils/MirrorNodeService";

export async function main(nftIdString: string) {
  const NFT_TOKEN_ID = TokenId.fromString(nftIdString);
  const { treasuryAccountId } = await Common.getTokenInfo(NFT_TOKEN_ID);
  const nftTokenSerialNumbersInfo = (
    await MirrorNodeService.getInstance()
      .enableLogs()
      .getNFTSerialNumbersInfo(NFT_TOKEN_ID)
  ).filter((item: any) => item.accountId !== treasuryAccountId);
  console.log("- NFT accounts and serials:", nftTokenSerialNumbersInfo);
  await Promise.all(
    nftTokenSerialNumbersInfo.map(async (item: any) =>
      Common.transferAssets(
        NFT_TOKEN_ID,
        item.serialNo,
        treasuryAccountId,
        item.accountId,
        getFromAccountPrivateKey(item.accountId),
        clientsInfo.operatorClient,
      ),
    ),
  );
}

function getFromAccountPrivateKey(fromAccountId: string) {
  return PrivateKey.fromString(
    dex.ACCOUNTS.find((item: any) => item.id === fromAccountId)?.key ??
      clientsInfo.operatorKey.toStringRaw(),
  );
}

if (require.main === module) {
  main(dex.E2E_NFT_TOKEN_ID.toString())
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
