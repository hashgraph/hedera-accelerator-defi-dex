import dex from "../../deployment/model/dex";
import Base from "./Base";
import { clientsInfo } from "../../utils/ClientManagement";
import { Client, TokenId, ContractFunctionParameters } from "@hashgraph/sdk";

const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
const INITIALIZE = "initialize";
const REVERT_TOKENS_FOR_VOTER = "revertTokensForVoter";
const CAN_USER_CLAIM_GOD_TOKEN = "canUserClaimGodTokens";

export default class GodHolder extends Base {
  initialize = async (client: Client) => {
    const args = new ContractFunctionParameters()
      .addAddress(this.htsAddress)
      .addAddress(GOD_TOKEN_ID.toSolidityAddress());

    await this.execute(900000, INITIALIZE, client, args);
    console.log(`- GodHolder#${INITIALIZE}(): done\n`);
  };

  initializeWithToken = async (client: Client, tokenAddress: string) => {
    const args = new ContractFunctionParameters()
      .addAddress(this.htsAddress)
      .addAddress(tokenAddress);

    await this.execute(900000, INITIALIZE, client, args);
    console.log(`- GodHolder#${INITIALIZE}(): done\n`);
  };

  checkAndClaimedGodTokens = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    return (
      (await this.canUserClaimGodTokens(client)) &&
      (await this.revertTokensForVoter(client))
    );
  };

  canUserClaimGodTokens = async (client: Client) => {
    const { result } = await this.execute(
      9000000,
      CAN_USER_CLAIM_GOD_TOKEN,
      client,
      undefined,
      undefined
    );
    const canUserClaimGodTokens = result.getBool(0);
    console.log(
      `- GodHolder#${CAN_USER_CLAIM_GOD_TOKEN}(): canUserClaimGodTokens = ${canUserClaimGodTokens}\n`
    );
    return canUserClaimGodTokens;
  };

  revertTokensForVoter = async (client: Client) => {
    const { result } = await this.execute(
      9000000,
      REVERT_TOKENS_FOR_VOTER,
      client,
      undefined,
      undefined
    );
    const responseCode = result.getUint256(0);
    console.log(
      `- GodHolder#${REVERT_TOKENS_FOR_VOTER}(): response-code = ${responseCode}\n`
    );
    return responseCode;
  };
}
