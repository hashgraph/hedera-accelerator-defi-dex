import Base from "./Base";
import BigNumber from "bignumber.js";

import { clientsInfo } from "../../utils/ClientManagement";
import { Client, AccountId, ContractFunctionParameters } from "@hashgraph/sdk";

const INITIALIZE = "initialize";
const ALLOT_LP_TOKEN = "allotLPTokenFor";
const REMOVE_LP_TOKEN = "removeLPTokenFor";
const LP_TOKEN_FOR_USER = "lpTokenForUser";
const GET_LP_TOKEN_COUNT = "getAllLPTokenCount";
const GET_LP_TOKEN_ADDRESS = "getLpTokenAddress";
const LPTOKEN_COUNT_FOR_GIVEN_TOKENS_QTY = "lpTokenCountForGivenTokensQty";

export default class LpToken extends Base {
  initialize = async (
    tokenName: string,
    tokenSymbol: string,
    ownerId: AccountId,
    client: Client = clientsInfo.operatorClient
  ) => {
    if (await this.isInitializationPending()) {
      const args = new ContractFunctionParameters()
        .addAddress(this.htsAddress)
        .addAddress(ownerId.toSolidityAddress())
        .addString(tokenSymbol)
        .addString(tokenName);
      await this.execute(5_00_000, INITIALIZE, client, args, undefined, 60);
      console.log(`- LpToken#${INITIALIZE}(): done\n`);
      return;
    }
    console.log(`- LpToken#${INITIALIZE}(): already done\n`);
  };

  getLpTokenAddress = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(50_000, GET_LP_TOKEN_ADDRESS, client);
    const address = result.getAddress(0);
    console.log(`- LpToken#${GET_LP_TOKEN_ADDRESS}(): address = ${address}\n`);
    return address;
  };

  getAllLPTokenCount = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(2_00_000, GET_LP_TOKEN_COUNT, client);
    const count = result.getInt256(0);
    console.log(`- LpToken#${GET_LP_TOKEN_COUNT}(): count = ${count}\n`);
    return count;
  };

  lpTokenCountForGivenTokensQty = async (
    tokenAQty: BigNumber,
    tokenBQty: BigNumber,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addInt256(tokenAQty)
      .addInt256(tokenBQty);

    const { result } = await this.execute(
      2_00_000,
      LPTOKEN_COUNT_FOR_GIVEN_TOKENS_QTY,
      client,
      args
    );

    const count = result.getInt256(0);
    console.log(
      `- LpToken#${LPTOKEN_COUNT_FOR_GIVEN_TOKENS_QTY}(): count = ${count}\n`
    );
    return count;
  };

  allotLPToken = async (
    tokenAQty: BigNumber,
    tokenBQty: BigNumber,
    receiverAccountId: AccountId,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addInt256(tokenAQty)
      .addInt256(tokenBQty)
      .addAddress(receiverAccountId.toSolidityAddress());
    await this.execute(2_00_000, ALLOT_LP_TOKEN, client, args);
    const sqrt = Math.sqrt(Number(tokenAQty.multipliedBy(tokenBQty)));
    console.log(
      `- LpToken#${ALLOT_LP_TOKEN}(): quantities = [${tokenAQty} x ${tokenAQty}], qty = ${sqrt}\n`
    );
  };

  removeLPToken = async (
    lpTokenQty: BigNumber,
    senderAccountId: AccountId,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addInt256(lpTokenQty)
      .addAddress(senderAccountId.toSolidityAddress());
    await this.execute(2_00_000, REMOVE_LP_TOKEN, client, args);
    console.log(`- LpToken#${REMOVE_LP_TOKEN}(): qty = ${lpTokenQty}\n`);
  };

  lpTokenForUser = async (
    userAccountId: AccountId,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addAddress(
      userAccountId.toSolidityAddress()
    );
    const { result } = await this.execute(
      2_00_000,
      LP_TOKEN_FOR_USER,
      client,
      args
    );
    const count = result.getInt256(0);
    console.log(`- LpToken#${LP_TOKEN_FOR_USER}(): count = ${count}\n`);
  };
}
