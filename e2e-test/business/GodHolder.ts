import dex from "../../deployment/model/dex";
import Base from "./Base";
import { clientsInfo } from "../../utils/ClientManagement";
import { Client, TokenId, ContractFunctionParameters } from "@hashgraph/sdk";

const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
const INITIALIZE = "initialize";
const REVERT_TOKENS_FOR_VOTER = "revertTokensForVoter";
const CAN_USER_CLAIM_GOD_TOKEN = "canUserClaimGodTokens";

export default class Governor extends Base {
  initialize = async (client: Client) => {
    const args = new ContractFunctionParameters()
      .addAddress(this.htsAddress)
      .addAddress(GOD_TOKEN_ID.toSolidityAddress());

    await this.execute(INITIALIZE, client, args);
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
    const { result } = await this.execute(CAN_USER_CLAIM_GOD_TOKEN, client);
    const canUserClaimGodTokens = result.getBool(0);
    console.log(
      `- GodHolder#${CAN_USER_CLAIM_GOD_TOKEN}(): canUserClaimGodTokens = ${canUserClaimGodTokens}\n`
    );
    return canUserClaimGodTokens;
  };

  revertTokensForVoter = async (client: Client) => {
    const { result } = await this.execute(REVERT_TOKENS_FOR_VOTER, client);
    const responseCode = result.getUint256(0);
    console.log(
      `- GodHolder#${REVERT_TOKENS_FOR_VOTER}(): response-code = ${responseCode}\n`
    );
    return responseCode;
  };
}
