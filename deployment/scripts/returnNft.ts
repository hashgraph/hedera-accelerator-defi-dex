import dex from "../model/dex";
import Common from "../../e2e-test/business/Common";

import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { MirrorNodeService } from "../../utils/MirrorNodeService";

export async function main() {
  const NFT_TOKEN_ID = TokenId.fromString(dex.NFT_TOKEN_ID);
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
        clientsInfo.treasureId.toString(),
        item.accountId,
        clientsInfo.operatorKey,
        clientsInfo.operatorClient,
      ),
    ),
  );
}

if (require.main === module) {
  main([])
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
