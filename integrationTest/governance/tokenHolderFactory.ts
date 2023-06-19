import dex from "../../deployment/model/dex";
import TokenHolderFactory from "../../e2e-test/business/factories/TokenHolderFactory";

import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { InstanceProvider } from "../../utils/InstanceProvider";

const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
const TOKEN_LAB49_1 = TokenId.fromString(dex.TOKEN_LAB49_1);

const NFT_TOKEN_ID = TokenId.fromString(dex.NFT_TOKEN_ID);

async function executeTokensHolderFlow(
  factory: TokenHolderFactory,
  tokens: TokenId[]
) {
  await factory.initialize();
  for (const token of tokens) {
    await factory.getTokenHolder(
      token.toSolidityAddress(),
      clientsInfo.operatorClient
    );
  }
  await factory.getTokenHolders();
  await factory.upgradeHederaService();
}

async function main() {
  const provider = InstanceProvider.getInstance();
  const godTokenHolderFactory = provider.getGODTokenHolderFactory();
  const nftTokenHolderFactory = provider.getNFTTokenHolderFactory();
  await executeTokensHolderFlow(godTokenHolderFactory, [
    GOD_TOKEN_ID,
    TOKEN_LAB49_1,
  ]);
  await executeTokensHolderFlow(nftTokenHolderFactory, [NFT_TOKEN_ID]);
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
