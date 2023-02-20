import Base from "./Base";
import Long from "long";
import dex from "../../deployment/model/dex";
import {
  Client,
  TokenId,
  TokenType,
  AccountId,
  ContractId,
  PrivateKey,
  TokenInfoQuery,
  TokenSupplyType,
  AccountBalanceQuery,
  TransferTransaction,
  TokenCreateTransaction,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";

export default class Common {
  static upgradeTo = async (
    proxyAddress: string,
    logicAddress: string,
    adminKey: PrivateKey = clientsInfo.adminKey,
    client: Client = clientsInfo.operatorClient
  ) => {
    const proxyContractId = ContractId.fromSolidityAddress(proxyAddress);
    const args = new ContractFunctionParameters().addAddress(logicAddress);
    await new Base(proxyContractId.toString()).execute(
      4000000,
      "upgradeTo",
      client,
      args,
      adminKey
    );
    console.log(
      `- Common#upgradeTo(): proxyId = ${proxyContractId.toString()}, new-implementation =  ${logicAddress}\n`
    );
  };

  static async createLPTokenName(
    tokenA: TokenId | string,
    tokenB: TokenId | string
  ) {
    const tokenADetail = await this.getTokenInfo(tokenA);
    const tokenBDetail = await this.getTokenInfo(tokenB);
    const symbols = [tokenADetail.symbol, tokenBDetail.symbol];
    symbols.sort();
    const lpTokenSymbol = symbols[0] + "-" + symbols[1];
    const lpTokenName = lpTokenSymbol + " LP token name";
    return { lpTokenSymbol, lpTokenName };
  }

  static withPrecision = (
    value: BigNumber | number,
    precision: BigNumber | number
  ): BigNumber => {
    return new BigNumber(value).multipliedBy(precision);
  };

  static createToken = async (
    tokenName: string,
    tokenSymbol: string,
    treasuryId: AccountId,
    treasuryKey: PrivateKey,
    client: Client
  ): Promise<TokenId> => {
    const txn = await new TokenCreateTransaction()
      .setTokenName(tokenName)
      .setTokenSymbol(tokenSymbol)
      .setDecimals(8)
      .setInitialSupply(200000 * 1e8)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Infinite)
      .setAdminKey(treasuryKey)
      .setSupplyKey(treasuryKey)
      .setTreasuryAccountId(treasuryId)
      .execute(client);

    const txnReceipt = await txn.getReceipt(client);
    const tokenId = txnReceipt.tokenId!;
    console.log(
      `- Common#createToken(): TokenId = ${tokenId}, TokenAddress = ${tokenId.toSolidityAddress()}, name = ${tokenName}, symbol = ${tokenSymbol}\n`
    );
    return tokenId;
  };

  static getAccountBalance = async (
    accountId: AccountId | ContractId | string,
    tokens: TokenId[] | undefined,
    client: Client = clientsInfo.operatorClient
  ) => {
    console.log(`- Common#getAccountBalance(): account-id = ${accountId}`);
    const response = await this.getAccountBalanceInternally(accountId, client);
    const accountTokens = response.tokens;
    console.log(` - HBars = ${response.hbars}`);
    if (accountTokens && tokens) {
      for (const token of tokens) {
        const balance = accountTokens.get(token);
        console.log(` - TokenId = ${token.toString()}, Balance = ${balance}`);
      }
    }
    console.log("");
    return response.hbars;
  };

  static getTokenBalance = async (
    accountId: AccountId,
    tokenId: TokenId,
    client: Client = clientsInfo.operatorClient
  ) => {
    const response = await this.getAccountBalanceInternally(accountId, client);
    const tokenBalance = response.tokens?.get(tokenId) ?? new Long(0);
    console.log(
      `- Common#getTokenBalance(): account-id = ${accountId}, TokenId = ${tokenId}, Balance = ${tokenBalance}\n`
    );
    return tokenBalance;
  };

  static getTokenInfo = async (
    tokenId: TokenId | string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const response = await new TokenInfoQuery()
      .setTokenId(tokenId)
      .execute(client);
    console.log(
      `- Common#getTokenInfo(): TokenId = ${tokenId}, name = ${response.name}, symbol = ${response.symbol}\n`
    );
    return { name: response.name, symbol: response.symbol };
  };

  static transferTokens = async (
    receiverAccountId: AccountId,
    senderAccountId: AccountId = clientsInfo.operatorId,
    senderPrivateKey: PrivateKey = clientsInfo.operatorKey,
    tokenId: string | TokenId = dex.GOD_TOKEN_ID,
    tokenQty: number = 9000000 * 1e8,
    client: Client = clientsInfo.operatorClient
  ) => {
    const txn = await new TransferTransaction()
      .addTokenTransfer(tokenId, senderAccountId, -tokenQty)
      .addTokenTransfer(tokenId, receiverAccountId, tokenQty)
      .freezeWith(client)
      .sign(senderPrivateKey);
    const txnResponse = await txn.execute(client);
    const txnReceipt = await txnResponse.getReceipt(client);
    const status = txnReceipt.status;
    console.log(
      `- Common#transferTokens(): TokenId = ${tokenId}, TokenQty = ${tokenQty}, sender = ${senderAccountId}, receiver = ${receiverAccountId}, status = ${status}`
    );
  };

  private static getAccountBalanceInternally = async (
    id: AccountId | ContractId,
    client: Client
  ) => {
    const balanceQuery = new AccountBalanceQuery();
    if (id instanceof AccountId) {
      balanceQuery.setAccountId(id);
    } else {
      balanceQuery.setContractId(id);
    }
    return await balanceQuery.execute(client);
  };
}
