import {
  TokenCreateTransaction,
  TokenMintTransaction,
  TokenType,
  TokenSupplyType,
  TokenId,
} from "@hashgraph/sdk";

import ClientManagement from "../../utils/ClientManagement";
import dex from "../model/dex";

async function main() {
  const tokenDetail = await createNFTToken();
  const arr = Array.from({ length: 20 }, (_, index) => index + 1);
  for (let index = 0; index < arr.length; index++) {
    await mintNFT(tokenDetail.tokenId);
  }
  return "executed successfully";
}

async function createNFTToken() {
  const cm = new ClientManagement();
  const opClient = cm.createOperatorClient();
  const tx = new TokenCreateTransaction()
    .setTokenName("Lab49NFT")
    .setTokenSymbol("Lab49NFT")
    .setTokenType(TokenType.NonFungibleUnique)
    .setDecimals(0)
    .setInitialSupply(0)
    .setTreasuryAccountId(cm.getOperator().id)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(1000)
    .setSupplyKey(cm.getOperator().key)
    .freezeWith(opClient);

  const txResponse = await tx.execute(opClient);
  const txReceipt = await txResponse.getReceipt(opClient);
  const tokenId = txReceipt.tokenId!;
  const tokenAddressSol = tokenId.toSolidityAddress();
  const item = {
    tokenId: tokenId,
    tokenAddressSol,
  };
  console.log(`- NFT Token ID: ${item.tokenId}`);
  console.log(`- NFT Token ID in Solidity format: ${item.tokenAddressSol}`);
  return item;
}

async function mintNFT(tokenId: TokenId) {
  const CID = "ipfs://QmTzWcVfk88JRqjTpVwHzBeULRTNzHY7mnBSG42CpwHmPa";
  const cm = new ClientManagement();
  const opClient = cm.createOperatorClient();
  // Mint new NFT
  let mintTx = await new TokenMintTransaction()
    .setTokenId(tokenId)
    .setMetadata([Buffer.from(CID)])
    .freezeWith(opClient);

  //Sign the transaction with the supply key
  let mintTxSign = await mintTx.sign(cm.getOperator().key);

  //Submit the transaction to a Hedera network
  let mintTxSubmit = await mintTxSign.execute(opClient);

  //Get the transaction receipt
  let mintRx = await mintTxSubmit.getReceipt(opClient);

  //Log the serial number
  console.log(
    `- Created NFT ${tokenId} with serial: ${mintRx.serials[0].low} \n`
  );
}

main()
  .then((res) => console.log(res))
  .catch((err) => console.error(err))
  .finally(() => process.exit(0));
