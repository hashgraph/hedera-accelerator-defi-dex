import dex from "../model/dex";

import { clientsInfo } from "../../utils/ClientManagement";
import {
  TokenType,
  TokenSupplyType,
  TokenCreateTransaction,
} from "@hashgraph/sdk";

async function main() {
  await createToken("Governance Hedera Open DEX", "GOD", 200000 * 1e8);
  await createToken("HBAR", "HBAR", 0);
  await createToken("LAB49A", "LAB49A", 200000 * 1e8);
  await createToken("LAB49B", "LAB49B", 200000 * 1e8);
  await createToken("LAB49C", "LAB49C", 200000 * 1e8);
  await createToken(
    dex.GOVERNANCE_DAO_ONE,
    dex.GOVERNANCE_DAO_ONE,
    200000 * 1e8,
  );
  await createToken(
    dex.GOVERNANCE_DAO_TWO,
    dex.GOVERNANCE_DAO_TWO,
    200000 * 1e8,
  );
  return "executed successfully";
}

async function createToken(
  tokenName: string,
  tokenSymbol: string,
  initialSupply: number,
) {
  const treasuryClient = clientsInfo.treasureClient;
  const treasureId = clientsInfo.treasureId;
  const treasuryKey = clientsInfo.treasureKey;
  const tx = await new TokenCreateTransaction()
    .setTokenName(tokenName)
    .setTokenSymbol(tokenSymbol)
    .setInitialSupply(initialSupply)
    .setDecimals(8)
    .setTreasuryAccountId(treasureId)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setSupplyKey(treasuryKey)
    .setAdminKey(treasuryKey)
    .freezeWith(treasuryClient)
    .sign(treasuryKey);

  const txResponse = await tx.execute(treasuryClient);
  const txReceipt = await txResponse.getReceipt(treasuryClient);
  const tokenId = txReceipt.tokenId!;
  const tokenAddressSol = tokenId.toSolidityAddress();
  const item = {
    tokenId: tokenId.toString(),
    tokenAddressSol,
  };
  console.log(`- ${tokenName} Token ID: ${item.tokenId}`);
  console.log(
    `- ${tokenName} Token ID in Solidity format: ${item.tokenAddressSol}`,
  );
  return item;
}

main()
  .then((res) => console.log(res))
  .catch((err) => console.error(err))
  .finally(() => process.exit(0));
