import {
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
} from "@hashgraph/sdk";

import ClientManagement from "../../utils/ClientManagement";

async function main() {
  await createGODToken(200000 * 100000000);
  return "executed successfully";
}

async function createGODToken(initialSupply: number) {
  const cm = new ClientManagement();
  const opClient = cm.createOperatorClient();
  const tx = await new TokenCreateTransaction()
    .setTokenName("Governance Hedera Open DEX")
    .setTokenSymbol("GOD")
    .setInitialSupply(initialSupply)
    .setDecimals(8)
    .setTreasuryAccountId(cm.getOperator().id)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setSupplyKey(cm.getOperator().key)
    .freezeWith(opClient)
    .sign(cm.getOperator().key);

  const txResponse = await tx.execute(opClient);
  const txReceipt = await txResponse.getReceipt(opClient);
  const tokenId = txReceipt.tokenId!;
  const tokenAddressSol = tokenId.toSolidityAddress();
  const item = {
    tokenId: tokenId.toString(),
    tokenAddressSol,
  };
  console.log(`- Token ID: ${item.tokenId}`);
  console.log(`- Token ID in Solidity format: ${item.tokenAddressSol}`);
  return item;
}

main()
  .then((res) => console.log(res))
  .catch((err) => console.error(err))
  .finally(() => process.exit(0));
