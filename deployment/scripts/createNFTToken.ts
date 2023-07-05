import { clientsInfo } from "../../utils/ClientManagement";
import {
  TokenCreateTransaction,
  TokenMintTransaction,
  TokenType,
  TokenSupplyType,
  TokenId,
} from "@hashgraph/sdk";

async function main() {
  const tokenDetail = await createNFTToken();
  const arr = Array.from({ length: 20 }, (_, index) => index + 1);
  for (let index = 0; index < arr.length; index++) {
    await mintNFT(tokenDetail.tokenId);
  }
  return "executed successfully";
}

async function createNFTToken() {
  const operatorId = clientsInfo.operatorId;
  const operatorKey = clientsInfo.operatorKey;
  const operatorClient = clientsInfo.operatorClient;
  const tx = new TokenCreateTransaction()
    .setTokenName("Lab49NFT")
    .setTokenSymbol("Lab49NFT")
    .setTokenType(TokenType.NonFungibleUnique)
    .setDecimals(0)
    .setInitialSupply(0)
    .setTreasuryAccountId(operatorId)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(1000)
    .setSupplyKey(operatorKey)
    .freezeWith(operatorClient);

  const txResponse = await tx.execute(operatorClient);
  const txReceipt = await txResponse.getReceipt(operatorClient);
  const tokenId = txReceipt.tokenId!;
  const tokenAddressSol = tokenId.toSolidityAddress();
  const item = {
    tokenId,
    tokenAddressSol,
  };
  console.log(`- NFT Token ID: ${item.tokenId}`);
  console.log(`- NFT Token ID in Solidity format: ${item.tokenAddressSol}`);
  return item;
}

async function mintNFT(tokenId: TokenId) {
  const CID = "ipfs://QmTzWcVfk88JRqjTpVwHzBeULRTNzHY7mnBSG42CpwHmPa";
  const operatorClient = clientsInfo.operatorClient;
  // Mint new NFT
  const mintTx = await new TokenMintTransaction()
    .setTokenId(tokenId)
    .setMetadata([Buffer.from(CID)])
    .freezeWith(operatorClient);

  // Sign the transaction with the supply key
  const mintTxSign = await mintTx.sign(clientsInfo.operatorKey);

  // Submit the transaction to a Hedera network
  const mintTxSubmit = await mintTxSign.execute(operatorClient);

  // Get the transaction receipt
  const mintRx = await mintTxSubmit.getReceipt(operatorClient);

  // Log the serial number
  console.log(
    `- Created NFT ${tokenId} with serial: ${mintRx.serials[0].low} \n`
  );
}

main()
  .then((res) => console.log(res))
  .catch((err) => console.error(err))
  .finally(() => process.exit(0));
