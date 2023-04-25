import dex from "../../deployment/model/dex";
import Base from "./Base";
import Common from "./Common";

import { clientsInfo } from "../../utils/ClientManagement";
import {
  Client,
  TokenId,
  AccountId,
  PrivateKey,
  ContractFunctionParameters,
} from "@hashgraph/sdk";

const NFT_TOKEN_ID = TokenId.fromString(dex.NFT_TOKEN_ID);
const INITIALIZE = "initialize";
const GET_TOKEN = "getToken";
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
    tokenSerialId: number,
    accountId: AccountId = clientsInfo.operatorId,
    accountPrivateKey: PrivateKey = clientsInfo.operatorKey,
    client: Client = clientsInfo.operatorClient
  ) => {
    const tokenId = await this.getToken(client);
    await Common.setAllowance(
      tokenId,
      undefined,
      undefined,
      this.contractId,
      accountId,
      accountPrivateKey,
      client,
      true
    );
    const args = new ContractFunctionParameters()
      .addAddress(accountId.toSolidityAddress())
      .addUint256(tokenSerialId);
    const { result } = await this.execute(
      5_00_000,
      GRAB_TOKENS_FOR_VOTER,
      client,
      args,
      accountPrivateKey
    );
    const code = result.getUint256(0);
    console.log(
      `- NFTHolder#${GRAB_TOKENS_FOR_VOTER}(): TokenId = ${tokenId.toString()}, serial id = ${tokenSerialId}\n`
    );
    return code;
  };

  getToken = async (client: Client) => {
    const { result } = await this.execute(35_000, GET_TOKEN, client);
    const address = result.getAddress(0);
    const token = TokenId.fromSolidityAddress(address);
    console.log(
      `- NFTHolder#${GET_TOKEN}(): address = ${address}, token = ${token.toString()}\n`
    );
    return token;
  };
}
