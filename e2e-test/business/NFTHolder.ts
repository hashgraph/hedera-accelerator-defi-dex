import dex from "../../deployment/model/dex";
import Base from "./Base";
import BigNumber from "bignumber.js";

import { clientsInfo } from "../../utils/ClientManagement";
import { Client, TokenId, ContractFunctionParameters } from "@hashgraph/sdk";

const NFT_TOKEN_ID = TokenId.fromString(dex.NFT_TOKEN_ID);
const INITIALIZE = "initialize";
const GRAB_TOKENS_FOR_VOTER = "grabTokensFromUser";
const REVERT_TOKENS_FOR_VOTER = "revertTokensForVoter";
const CAN_USER_CLAIM_TOKEN = "canUserClaimTokens";

export default class NFTHolder extends Base {
  initialize = async (
    client: Client = clientsInfo.operatorClient,
    tokenAddress: string = NFT_TOKEN_ID.toSolidityAddress()
  ) => {
    if (await this.isInitializationPending()) {
      const args = new ContractFunctionParameters()
        .addAddress(this.htsAddress)
        .addAddress(tokenAddress);

      await this.execute(900000, INITIALIZE, client, args);
      console.log(`- NFTHolder#${INITIALIZE}(): done\n`);
      return;
    }
    console.log(`- NFTHolder#${INITIALIZE}(): already done\n`);
  };

  checkAndClaimNFTTokens = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    return (
      (await this.canUserClaimTokens(client)) &&
      (await this.revertTokensForVoter(client))
    );
  };

  canUserClaimTokens = async (client: Client) => {
    const { result } = await this.execute(
      9000000,
      CAN_USER_CLAIM_TOKEN,
      client,
      undefined,
      undefined
    );
    const canUserClaimTokens = result.getBool(0);
    console.log(
      `- NFTHolder#${CAN_USER_CLAIM_TOKEN}(): canUserClaimTokens = ${canUserClaimTokens}\n`
    );
    return canUserClaimTokens;
  };

  revertTokensForVoter = async (client: Client) => {
    const args = new ContractFunctionParameters().addUint256(0);
    const { result } = await this.execute(
      9000000,
      REVERT_TOKENS_FOR_VOTER,
      client,
      args,
      undefined,
      0
    );
    const responseCode = result.getUint256(0);
    console.log(
      `- NFTHolder#${REVERT_TOKENS_FOR_VOTER}(): response-code = ${responseCode}\n`
    );
    return responseCode;
  };

  grabTokensForVoter = async (
    user: string,
    tokenId: number,
    client: Client
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(user)
      .addUint256(new BigNumber(tokenId));

    const { result } = await this.execute(
      9999999,
      GRAB_TOKENS_FOR_VOTER,
      client,
      args,
      clientsInfo.operatorKey
    );
    const responseCode = result.getUint256(0);
    console.log(
      `- NFTHolder#${GRAB_TOKENS_FOR_VOTER}(): response-code = ${responseCode}\n`
    );
    return responseCode;
  };
}
