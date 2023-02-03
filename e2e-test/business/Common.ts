import Long from "long";
import {
  Client,
  TokenId,
  TokenType,
  AccountId,
  PrivateKey,
  TokenInfoQuery,
  TokenSupplyType,
  AccountBalanceQuery,
  TokenCreateTransaction,
} from "@hashgraph/sdk";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";

export default class Common {
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
    accountId: AccountId | string,
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
    token: TokenId,
    client: Client = clientsInfo.operatorClient
  ) => {
    console.log(`- Common#getTokenBalance(): account-id = ${accountId}\n`);
    const response = await this.getAccountBalanceInternally(accountId, client);
    return response.tokens?.get(token) ?? new Long(0);
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

  private static getAccountBalanceInternally = async (
    accountId: AccountId | string,
    client: Client
  ) => {
    return await new AccountBalanceQuery()
      .setAccountId(accountId)
      .execute(client);
  };
}
