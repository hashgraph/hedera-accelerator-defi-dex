import Base from "./Base";
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
  Hbar,
} from "@hashgraph/sdk";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import { AddressHelper } from "../../utils/AddressHelper";
import Token from "./Token";

export default class Common extends Base {
  static baseUrl: string = "https://testnet.mirrornode.hedera.com/";
  static UPGRADE_TO: string = "upgradeTo";
  static CHANGE_ADMIN: string = "changeAdmin";

  protected getContractName(): string {
    return this.constructor.name;
  }

  static setNFTTokenAllowance = async (
    tokenId: string | TokenId,
    spenderAccountId: string | AccountId,
    ownerAccount: string | AccountId,
    ownerAccountPrivateKey: PrivateKey,
    client: Client,
  ) => {
    const allowanceTxn =
      new AccountAllowanceApproveTransaction().approveTokenNftAllowanceAllSerials(
        tokenId,
        ownerAccount,
        spenderAccountId,
      );
    const signTx = await allowanceTxn
      .freezeWith(client)
      .sign(ownerAccountPrivateKey);
    const txResponse = await signTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const transactionStatus = receipt.status;
    console.log(
      `- Common#setNFTTokenAllowance(): status = ${transactionStatus.toString()}, tokenId = ${tokenId.toString()}, spenderAccountId = ${spenderAccountId.toString()}, ownerAccount = ${ownerAccount.toString()}\n`,
    );
  };

  static deleteSpendersNftAllowanceForAllSerials = async (
    tokenId: string | TokenId,
    spenderAccountId: string | AccountId,
    ownerAccount: string | AccountId,
    ownerAccountPrivateKey: PrivateKey,
    client: Client,
  ) => {
    const txn =
      new AccountAllowanceApproveTransaction().deleteTokenNftAllowanceAllSerials(
        tokenId,
        ownerAccount,
        spenderAccountId,
      );
    const signTx = await txn.freezeWith(client).sign(ownerAccountPrivateKey);
    const txResponse = await signTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const transactionStatus = receipt.status;
    console.log(
      `- Common#deleteSpendersNftAllowanceForAllSerials(): status = ${transactionStatus.toString()}, tokenId = ${tokenId.toString()}\n`,
    );
  };

  static setTokenAllowance = async (
    tokenId: TokenId,
    spenderAccountId: string | AccountId,
    amount: number,
    ownerAccount: string | AccountId,
    ownerAccountPrivateKey: PrivateKey,
    client: Client,
  ) => {
    dex.HBARX_TOKEN_ID === tokenId.toString()
      ? await Common.approveHbarAllowance(
          spenderAccountId,
          amount,
          ownerAccount,
          ownerAccountPrivateKey,
          client,
        )
      : await Common.approveTokenAllowance(
          tokenId,
          spenderAccountId,
          amount,
          ownerAccount,
          ownerAccountPrivateKey,
          client,
        );
  };

  static approveTokenAllowance = async (
    tokenId: string | TokenId,
    spenderAccountId: string | AccountId,
    amount: number,
    ownerAccount: string | AccountId,
    ownerAccountPrivateKey: PrivateKey,
    client: Client,
  ) => {
    const allowanceTxn =
      new AccountAllowanceApproveTransaction().approveTokenAllowance(
        tokenId,
        ownerAccount,
        spenderAccountId,
        amount,
      );
    const signTx = await allowanceTxn
      .freezeWith(client)
      .sign(ownerAccountPrivateKey);
    const txResponse = await signTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const transactionStatus = receipt.status;
    console.log(
      `- Common#approveTokenAllowance(): status = ${transactionStatus.toString()}, tokenId = ${tokenId.toString()}, spenderAccountId = ${spenderAccountId.toString()}, ownerAccount = ${ownerAccount.toString()}, amount = ${amount}\n`,
    );
  };

  static approveHbarAllowance = async (
    spenderAccountId: string | AccountId,
    amount: number,
    ownerAccount: string | AccountId,
    ownerAccountPrivateKey: PrivateKey,
    client: Client,
  ) => {
    const allowanceTxn =
      new AccountAllowanceApproveTransaction().approveHbarAllowance(
        ownerAccount,
        spenderAccountId,
        amount,
      );
    const signTx = await allowanceTxn
      .freezeWith(client)
      .sign(ownerAccountPrivateKey);
    const txResponse = await signTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const transactionStatus = receipt.status;
    console.log(
      `- Common#approveHbarAllowance(): status = ${transactionStatus.toString()}, spenderAccountId = ${spenderAccountId.toString()}, ownerAccount = ${ownerAccount.toString()}, hbar = ${amount}\n`,
    );
  };

  public upgradeTo = async (
    proxyAddress: string,
    logicAddress: string,
    adminKey: PrivateKey = clientsInfo.proxyAdminKey,
    client: Client = clientsInfo.proxyAdminClient,
  ) => {
    const args = new ContractFunctionParameters().addAddress(logicAddress);
    await this.execute(2_00_000, Common.UPGRADE_TO, client, args, adminKey);
    console.log(
      `- Common#upgradeTo(): proxyId = ${this.contractId}, new-implementation =  ${logicAddress}\n`,
    );
  };

  public changeAdmin = async (
    newAdminAddress: string,
    adminKey: PrivateKey = clientsInfo.proxyAdminKey,
    client: Client = clientsInfo.proxyAdminClient,
  ) => {
    const args = new ContractFunctionParameters().addAddress(newAdminAddress);
    await this.execute(50_000, Common.CHANGE_ADMIN, client, args, adminKey);
    console.log(
      `- Common#changeAdmin(): proxyId = ${this.contractId.toString()}, new-admin-address = ${newAdminAddress}\n`,
    );
  };

  static async createLPTokenName(
    tokenA: TokenId | string,
    tokenB: TokenId | string,
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
    precision: BigNumber | number,
  ): BigNumber => {
    return new BigNumber(value).multipliedBy(precision);
  };

  static createToken = async (
    tokenName: string,
    tokenSymbol: string,
    treasuryId: AccountId,
    treasuryKey: PrivateKey,
    client: Client,
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
      `- Common#createToken(): TokenId = ${tokenId}, TokenAddress = ${tokenId.toSolidityAddress()}, name = ${tokenName}, symbol = ${tokenSymbol}\n`,
    );
    return tokenId;
  };

  static getAccountBalance = async (
    accountId: AccountId | ContractId,
    tokens: TokenId[] | undefined = undefined,
    client: Client = clientsInfo.operatorClient,
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
    idOrEvmAddress: AccountId | ContractId | string,
    tokenId: TokenId,
    client: Client = clientsInfo.operatorClient,
  ) => {
    let address: string = "";
    if (idOrEvmAddress instanceof ContractId) {
      address = await AddressHelper.idToEvmAddress(idOrEvmAddress.toString());
    } else if (idOrEvmAddress instanceof AccountId) {
      address = idOrEvmAddress.toSolidityAddress();
    } else if (typeof idOrEvmAddress === "string") {
      address = idOrEvmAddress;
    } else {
      throw Error(`Unsupported id :- ${idOrEvmAddress}`);
    }
    const token = new Token(ContractId.fromString(tokenId.toString()));
    return await token.getBalance(address);
  };

  static getTokenInfo = async (
    tokenId: string | TokenId,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const response = await new TokenInfoQuery()
      .setTokenId(tokenId)
      .execute(client);
    const isNFT = response.tokenType === TokenType.NonFungibleUnique;
    console.log(
      `- Common#getTokenInfo(): TokenId = ${tokenId}, name = ${response.name}, symbol = ${response.symbol}, totalSupply = ${response.totalSupply}, isNFT = ${isNFT}\n`,
    );
    return {
      name: response.name,
      symbol: response.symbol,
      treasuryAccountId: response.treasuryAccountId?.toString(),
      isNFT,
    };
  };

  static transferAssets = async (
    tokenId: string | TokenId,
    amountOrId: number,
    toAccountId: string | AccountId,
    fromAccountId: string | AccountId,
    fromPrivateKey: PrivateKey,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const txn = new TransferTransaction();
    switch (true) {
      case tokenId.toString() === dex.HBARX_TOKEN_ID:
      case tokenId.toString() === dex.ZERO_TOKEN_ID.toString():
        txn
          .addHbarTransfer(fromAccountId, Hbar.fromTinybars(-amountOrId))
          .addHbarTransfer(toAccountId, Hbar.fromTinybars(amountOrId));
        break;
      case (await Common.getTokenInfo(tokenId, clientsInfo.operatorClient))
        .isNFT:
        txn.addNftTransfer(tokenId, amountOrId, fromAccountId, toAccountId);
        break;
      default:
        txn
          .addTokenTransfer(tokenId, fromAccountId, -amountOrId)
          .addTokenTransfer(tokenId, toAccountId, amountOrId);
    }
    const signedTxn = await txn.freezeWith(client).sign(fromPrivateKey);
    const txnResponse = await signedTxn.execute(client);
    const txnReceipt = await txnResponse.getReceipt(client);
    console.log("- Common#transferAssets():");
    console.table({
      tokenId: tokenId.toString(),
      amountOrId,
      toAccountId: toAccountId.toString(),
      fromAccountId: fromAccountId.toString(),
      status: txnReceipt.status.toString(),
    });
    console.log("");
  };

  static deleteToken = async (
    tokenId: string | TokenId,
    client: Client = clientsInfo.operatorClient,
    adminKey: PrivateKey = clientsInfo.operatorKey,
  ) => {
    const transaction = new TokenDeleteTransaction()
      .setTokenId(tokenId)
      .freezeWith(client);
    const signTx = await transaction.sign(adminKey);
    const txResponse = await signTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const transactionStatus = receipt.status;
    console.log(
      `Common#deleteToken(): TokenId = ${tokenId}, transaction status is: ${transactionStatus.toString()}`,
    );
  };

  static mintToken = async (
    tokenId: TokenId,
    mintAmt: number,
    supplyKey: PrivateKey = clientsInfo.operatorKey,
    client: Client = clientsInfo.operatorClient,
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
      `Common#mintToken(): TokenId = ${tokenId},  mintAmt = ${mintAmt}, transaction status is: ${transactionStatus.toString()}`,
    );
  };

  static associateTokensToAccount = async (
    accountId: string | AccountId,
    tokenIds: (string | TokenId)[],
    client: Client = clientsInfo.operatorClient,
    accountKey: PrivateKey = clientsInfo.operatorKey,
  ) => {
    const transaction = await new TokenAssociateTransaction()
      .setAccountId(accountId)
      .setTokenIds(tokenIds)
      .freezeWith(client);
    const signTx = await transaction.sign(accountKey);
    try {
      const txResponse = await signTx.execute(client);
      const receipt = await txResponse.getReceipt(client);
      const transactionStatus = receipt.status;
      console.log(
        `Common#associateTokensToAccount(): TokenIds = ${tokenIds},  accountId = ${accountId}, transaction status is: ${transactionStatus.toString()} \n`,
      );
    } catch (error: any) {
      console.log(
        `Common#associateTokensToAccount(): TokenIds = ${tokenIds},  accountId = ${accountId}, transaction status is: ${error.toString()} \n`,
      );
    }
  };

  private static getBalanceInternally = async (
    id: AccountId | ContractId,
    client: Client,
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
