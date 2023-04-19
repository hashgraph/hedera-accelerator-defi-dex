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
  TokenDeleteTransaction,
  TokenMintTransaction,
  TokenAssociateTransaction,
  AccountAllowanceApproveTransaction,
} from "@hashgraph/sdk";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import axios from "axios";

export default class Common {
  static baseUrl: string = "https://testnet.mirrornode.hedera.com/";

  static setNFTTokenAllowance = async (
    tokenId: string | TokenId,
    spenderAccountId: string | AccountId,
    ownerAccount: string | AccountId,
    ownerAccountPrivateKey: PrivateKey,
    client: Client
  ) => {
    const allowanceTxn =
      new AccountAllowanceApproveTransaction().approveTokenNftAllowanceAllSerials(
        tokenId,
        ownerAccount,
        spenderAccountId
      );
    const signTx = await allowanceTxn
      .freezeWith(client)
      .sign(ownerAccountPrivateKey);
    const txResponse = await signTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const transactionStatus = receipt.status;
    console.log(
      `- Common#setTokenAllowance(): status = ${transactionStatus.toString()}, tokenId = ${tokenId.toString()},spenderAccountId =  ${spenderAccountId.toString()}, ownerAccount =  ${ownerAccount.toString()}\n`
    );
  };

  static setTokenAllowance = async (
    tokenId: string | TokenId,
    spenderAccountId: string | AccountId,
    amount: number,
    ownerAccount: string | AccountId,
    ownerAccountPrivateKey: PrivateKey,
    client: Client
  ) => {
    const allowanceTxn =
      new AccountAllowanceApproveTransaction().approveTokenAllowance(
        tokenId,
        ownerAccount,
        spenderAccountId,
        amount
      );
    const signTx = await allowanceTxn
      .freezeWith(client)
      .sign(ownerAccountPrivateKey);
    const txResponse = await signTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const transactionStatus = receipt.status;
    console.log(
      `- Common#setTokenAllowance(): status = ${transactionStatus.toString()}, tokenId = ${tokenId.toString()},spenderAccountId =  ${spenderAccountId.toString()}, ownerAccount =  ${ownerAccount.toString()}\n`
    );
  };

  static upgradeTo = async (
    proxyAddress: string,
    logicAddress: string,
    adminKey: PrivateKey = clientsInfo.adminKey,
    client: Client = clientsInfo.adminClient
  ) => {
    const proxyContractId = ContractId.fromSolidityAddress(proxyAddress);
    const args = new ContractFunctionParameters().addAddress(logicAddress);
    await new Base(proxyContractId.toString()).execute(
      2_00_000,
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
    accountId: AccountId | ContractId,
    tokens: TokenId[] | undefined,
    client: Client = clientsInfo.operatorClient
  ) => {
    console.log(`- Common#getAccountBalance(): account-id = ${accountId}`);
    const response = await this.getBalanceInternally(accountId, client);
    const accountTokens = response.tokens;
    console.log(` - HBars = ${response.hbars}`);
    if (accountTokens && tokens) {
      for (const token of tokens) {
        const balance = accountTokens.get(token);
        console.log(` - TokenId = ${token.toString()}, Balance = ${balance}`);
      }
    }
    return response.hbars._valueInTinybar;
  };

  static getTokenBalance = async (
    id: AccountId | ContractId,
    tokenId: TokenId,
    client: Client = clientsInfo.operatorClient
  ) => {
    const response = await this.getBalanceInternally(id, client);
    const tokenBalance = response.tokens?.get(tokenId) ?? new Long(0);
    console.log(
      `- Common#getTokenBalance(): id = ${id}, TokenId = ${tokenId}, Balance = ${tokenBalance}\n`
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
      `- Common#getTokenInfo(): TokenId = ${tokenId}, name = ${response.name}, symbol = ${response.symbol},  totalSupply= ${response.totalSupply}\n`
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

  private static getBalanceInternally = async (
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

  static deleteToken = async (
    tokenId: string | TokenId,
    client: Client = clientsInfo.operatorClient,
    adminKey: PrivateKey = clientsInfo.operatorKey
  ) => {
    const transaction = new TokenDeleteTransaction()
      .setTokenId(tokenId)
      .freezeWith(client);
    const signTx = await transaction.sign(adminKey);
    const txResponse = await signTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const transactionStatus = receipt.status;
    console.log(
      `Common#deleteToken(): TokenId = ${tokenId}, transaction status is: ${transactionStatus.toString()}`
    );
  };

  static mintToken = async (
    tokenId: TokenId,
    mintAmt: number,
    supplyKey: PrivateKey = clientsInfo.operatorKey,
    client: Client = clientsInfo.operatorClient
  ) => {
    const transaction = new TokenMintTransaction()
      .setTokenId(tokenId)
      .setAmount(mintAmt)
      .freezeWith(client);
    const signTx = await transaction.sign(supplyKey);
    const txResponse = await signTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const transactionStatus = receipt.status;
    console.log(
      `Common#mintToken(): TokenId = ${tokenId},  mintAmt = ${mintAmt}, transaction status is: ${transactionStatus.toString()}`
    );
  };

  static fetchTokenBalanceFromMirrorNode = async (
    accountId: string,
    tokenId: string
  ) => {
    let balance = new BigNumber(0);
    const url = `${Common.baseUrl}api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`;
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();
    balance = new BigNumber(data.tokens[0].balance);
    console.log(
      `Common#fetchTokenBalanceFromMirrorNode(): id = ${accountId}, TokenId = ${tokenId}, Balance = ${balance}`
    );
    return balance;
  };

  static associateTokensToAccount = async (
    accountId: string | AccountId,
    tokenIds: (string | TokenId)[],
    client: Client = clientsInfo.operatorClient,
    accountKey: PrivateKey = clientsInfo.operatorKey
  ) => {
    const transaction = await new TokenAssociateTransaction()
      .setAccountId(accountId)
      .setTokenIds(tokenIds)
      .freezeWith(client);
    const signTx = await transaction.sign(accountKey);
    const txResponse = await signTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const transactionStatus = receipt.status;
    console.log(
      `Common#associateTokensToAccount(): TokenIds = ${tokenIds},  accountId = ${accountId}, transaction status is: ${transactionStatus.toString()}`
    );
  };
}
