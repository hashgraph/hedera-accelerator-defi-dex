import { clientsInfo } from "../../utils/ClientManagement";
import {
  TokenCreateTransaction,
  TokenMintTransaction,
  TokenType,
  TokenSupplyType,
  TokenId,
} from "@hashgraph/sdk";

const accountId = clientsInfo.operatorId;
const accountKey = clientsInfo.operatorKey;
const accountClient = clientsInfo.operatorClient;

async function main() {
  await createNFTToken("Lab49NFT", "Lab49NFT");
  await createNFTToken("Lab49NFT-e2e", "Lab49NFT-e2e");
  return "Executed successfully";
}

async function createNFTToken(tokenName: string, tokenSymbol: string) {
  const tx = new TokenCreateTransaction()
    .setTokenName(tokenName)
    .setTokenSymbol(tokenSymbol)
    .setTokenType(TokenType.NonFungibleUnique)
    .setDecimals(0)
    .setInitialSupply(0)
    .setTreasuryAccountId(accountId)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(1000)
    .setSupplyKey(accountKey)
    .freezeWith(accountClient);

  const txResponse = await tx.execute(accountClient);
  const txReceipt = await txResponse.getReceipt(accountClient);
  const tokenId = txReceipt.tokenId!;
  const tokenAddressSol = tokenId.toSolidityAddress();
  const item = {
    tokenId,
    tokenAddressSol,
  };
  console.log(`- NFT Token ID: ${item.tokenId}`);
  console.log(`- NFT Token ID in Solidity format: ${item.tokenAddressSol}`);
  await mintNFT(tokenId);
  await mintNFT(tokenId);
  return item;
}

async function mintNFT(tokenId: TokenId) {
  const CID = "ipfs://QmTzWcVfk88JRqjTpVwHzBeULRTNzHY7mnBSG42CpwHmPa";
  const CIDs = [...Array(10).keys()].map(() => Buffer.from(CID));
  const txn = await new TokenMintTransaction()
    .setTokenId(tokenId)
    .setMetadata(CIDs)
    .freezeWith(accountClient)
    .sign(accountKey);
  const txResponse = await txn.execute(accountClient);
  const txReceipt = await txResponse.getReceipt(accountClient);
  console.log(`- Created NFT ${tokenId} with serial: ${txReceipt.serials} \n`);
}

main()
  .then((res) => console.log(res))
  .catch((err) => console.error(err))
  .finally(() => process.exit(0));
