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
import { ContractService } from "../../deployment/service/ContractService";

const NFT_TOKEN_ID = dex.NFT_TOKEN_ID;
const INITIALIZE = "initialize";
const GET_TOKEN = "getToken";
const GRAB_TOKENS_FOR_VOTER = "grabTokensFromUser";
const REVERT_TOKENS_FOR_VOTER = "revertTokensForVoter";
const CAN_USER_CLAIM_TOKEN = "canUserClaimTokens";
const BALANCE_OF_VOTER = "balanceOfVoter";

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

  protected getContractName() {
    return ContractService.NFT_HOLDER;
  }

  checkAndClaimNFTTokens = async (
    client: Client = clientsInfo.operatorClient,
    accountId: AccountId = clientsInfo.operatorId
  ) => {
    return (
      (await this.canUserClaimTokens(accountId, client)) &&
      (await this.revertTokensForVoter(client))
    );
  };

  balanceOfVoter = async (accountId: AccountId, client: Client) => {
    const args = new ContractFunctionParameters().addAddress(
      accountId.toSolidityAddress()
    );
    const { result } = await this.execute(
      50_000,
      BALANCE_OF_VOTER,
      client,
      args
    );
    const balance = result.getUint256(0);
    console.log(
      `- NFTHolder#${BALANCE_OF_VOTER}(): accountId = ${accountId.toString()}, balance = ${balance}\n`
    );
    return balance.toNumber();
  };

  canUserClaimTokens = async (accountId: AccountId, client: Client) => {
    const args = new ContractFunctionParameters().addAddress(
      accountId.toSolidityAddress()
    );
    const { result } = await this.execute(
      9000000,
      CAN_USER_CLAIM_TOKEN,
      client,
      args
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
    nftTokenSerialId: number,
    accountId: AccountId = clientsInfo.operatorId,
    accountPrivateKey: PrivateKey = clientsInfo.operatorKey,
    client: Client = clientsInfo.operatorClient
  ) => {
    const tokenId = await this.getToken(client);
    const args = new ContractFunctionParameters()
      .addAddress(accountId.toSolidityAddress())
      .addUint256(nftTokenSerialId);
    const { result } = await this.execute(
      5_00_000,
      GRAB_TOKENS_FOR_VOTER,
      client,
      args,
      accountPrivateKey
    );
    const code = result.getUint256(0);
    console.log(
      `- NFTHolder#${GRAB_TOKENS_FOR_VOTER}(): TokenId = ${tokenId.toString()}, serial id = ${nftTokenSerialId}\n`
    );
    return code;
  };

  setupAllowanceForTokenLocking = async (
    accountId: AccountId = clientsInfo.operatorId,
    accountPrivateKey: PrivateKey = clientsInfo.operatorKey,
    client: Client = clientsInfo.operatorClient
  ) => {
    const tokenId = await this.getToken(client);
    await Common.setNFTTokenAllowance(
      tokenId,
      this.contractId,
      accountId,
      accountPrivateKey,
      client
    );
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

  checkAndClaimGodTokens = async (
    client: Client = clientsInfo.operatorClient,
    accountId: AccountId = clientsInfo.operatorId
  ) => {
    if (await this.canUserClaimTokens(accountId, client)) {
      await this.revertTokensForVoter(client);
    }
  };
}
