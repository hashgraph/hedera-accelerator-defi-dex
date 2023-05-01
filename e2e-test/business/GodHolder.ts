import Base from "./Base";
import Common from "./Common";
import dex from "../../deployment/model/dex";

import { clientsInfo } from "../../utils/ClientManagement";
import {
  Client,
  TokenId,
  ContractFunctionParameters,
  AccountId,
  PrivateKey,
} from "@hashgraph/sdk";

const GET_TOKEN = "getToken";
const INITIALIZE = "initialize";
const BALANCE_OF_VOTER = "balanceOfVoter";
const CAN_USER_CLAIM_TOKENS = "canUserClaimTokens";
const REVERT_TOKENS_FOR_VOTER = "revertTokensForVoter";
const GRAB_TOKEN_FROM_USER = "grabTokensFromUser";
const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
export default class GodHolder extends Base {
  initialize = async (
    client: Client = clientsInfo.operatorClient,
    tokenAddress: string = GOD_TOKEN_ID.toSolidityAddress()
  ) => {
    if (await this.isInitializationPending()) {
      const args = new ContractFunctionParameters()
        .addAddress(this.htsAddress)
        .addAddress(tokenAddress);
      try {
        await this.execute(9_00_000, INITIALIZE, client, args);
        console.log(`- GodHolder#${INITIALIZE}(): done\n`);
      } catch (error: any) {
        console.log(`- GodHolder#${INITIALIZE}(): error, ${error.message}\n`);
      }
      return;
    }
    console.log(`- GodHolder#${INITIALIZE}(): already done\n`);
  };

  checkAndClaimGodTokens = async (
    client: Client = clientsInfo.operatorClient,
    accountId: AccountId = clientsInfo.operatorId
  ) => {
    if (await this.canUserClaimTokens(client)) {
      const balance = await this.balanceOfVoter(accountId, client);
      await this.revertTokensForVoter(client, balance);
    }
  };

  canUserClaimTokens = async (client: Client) => {
    const { result } = await this.execute(
      3_00_000,
      CAN_USER_CLAIM_TOKENS,
      client,
      undefined,
      undefined
    );
    const canUserClaimTokens = result.getBool(0);
    console.log(
      `- GodHolder#${CAN_USER_CLAIM_TOKENS}(): canUserClaimTokens = ${canUserClaimTokens}\n`
    );
    return canUserClaimTokens;
  };

  revertTokensForVoter = async (client: Client, balance: number) => {
    const args = new ContractFunctionParameters().addUint256(balance);
    const { result } = await this.execute(
      3_00_000,
      REVERT_TOKENS_FOR_VOTER,
      client,
      args
    );
    const code = result.getUint256(0);
    console.log(
      `- GodHolder#${REVERT_TOKENS_FOR_VOTER}(): amount = ${balance}, code = ${code}\n`
    );
    return code;
  };

  getToken = async (client: Client) => {
    const { result } = await this.execute(35_000, GET_TOKEN, client);
    const address = result.getAddress(0);
    const token = TokenId.fromSolidityAddress(address);
    console.log(
      `- GodHolder#${GET_TOKEN}(): address = ${address}, token = ${token.toString()}\n`
    );
    return token;
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
      `- GodHolder#${BALANCE_OF_VOTER}(): accountId = ${accountId.toString()}, balance = ${balance}\n`
    );
    return balance.toNumber();
  };

  lock = async (
    lockedAmount: number = 50001e8, // 50001 tokens
    accountId: AccountId = clientsInfo.uiUserId,
    accountPrivateKey: PrivateKey = clientsInfo.uiUserKey,
    client: Client = clientsInfo.uiUserClient
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(accountId.toSolidityAddress())
      .addUint256(lockedAmount);
    const { result } = await this.execute(
      5_00_000,
      GRAB_TOKEN_FROM_USER,
      client,
      args,
      accountPrivateKey
    );
    const code = result.getUint256(0);
    console.log(
      `- GodHolder#${GRAB_TOKEN_FROM_USER}(): amount = ${lockedAmount}\n`
    );
    return code;
  };

  setupAllowanceForTokenLocking = async (
    allowanceAmount: number = 50001e8, // 50001 tokens,
    accountId: AccountId = clientsInfo.uiUserId,
    accountPrivateKey: PrivateKey = clientsInfo.uiUserKey,
    client: Client = clientsInfo.uiUserClient
  ) => {
    const tokenId = await this.getToken(client);
    await Common.getTokenBalance(accountId, tokenId, client);
    await Common.setTokenAllowance(
      tokenId,
      this.contractId,
      allowanceAmount,
      accountId,
      accountPrivateKey,
      client
    );
  };
}
