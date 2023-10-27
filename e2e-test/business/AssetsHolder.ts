import Base from "./Base";

import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { MirrorNodeService } from "../../utils/MirrorNodeService";
import { Client, TokenId, ContractFunctionParameters } from "@hashgraph/sdk";

export enum Events {
  TokenCreated = "TokenCreated",
}

export enum Type {
  ASSOCIATE = 1001,
  TRANSFER = 1002,
  SET_TEXT = 1003,
  CREATE_TOKEN = 1004,
  MINT_TOKEN = 1005,
  BURN_TOKEN = 1006,
  UPGRADE_PROXY = 1007,
  UPDATE_FEE_CONFIG = 1008,
  QUORUM_THRESHOLD_SET = 1009,
}

export const INITIALIZE = "initialize";
export const ASSOCIATE = "associate";
export const TRANSFER = "transfer";
export const SET_TEXT = "setText";
export const CREATE_TOKEN = "createToken";
export const MINT_TOKEN = "mintToken";
export const BURN_TOKEN = "burnToken";
export const UPGRADE_PROXY = "upgradeProxy";

export default class AssetsHolder extends Base {
  protected getContractName() {
    return ContractService.ASSET_HOLDER;
  }

  public initialize = async (
    governanceTokenAddress: string,
    client: Client = clientsInfo.operatorClient,
  ) => {
    if (await this.isInitializationPending()) {
      const args = new ContractFunctionParameters()
        .addAddress(governanceTokenAddress)
        .addAddress(this.htsAddress);
      await this.execute(10_00_000, INITIALIZE, client, args);
      console.log(`- AssetsHolder#${INITIALIZE}(): done\n`);
      return;
    }
    console.log(`- AssetsHolder#${INITIALIZE}(): already done\n`);
  };

  public associate = async (
    tokenAddress: string,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = new ContractFunctionParameters().addAddress(tokenAddress);
    const { record } = await this.execute(8_00_000, ASSOCIATE, client, args);
    console.log(
      `- AssetsHolder#${ASSOCIATE}(): done, token-address = ${tokenAddress}, TxnId = ${record.transactionId}\n`,
    );
  };

  public createToken = async (
    name: string,
    symbol: string,
    initialSupply: number,
    tokenCreationFee: number,
    client: Client = clientsInfo.operatorClient,
  ) => {
    if (tokenCreationFee < 20) {
      throw Error("Token creation fee can't be < 20 HBars");
    }
    const args = new ContractFunctionParameters()
      .addString(name)
      .addString(symbol)
      .addUint256(initialSupply);
    const { record } = await this.execute(
      2_00_000,
      CREATE_TOKEN,
      client,
      args,
      undefined,
      tokenCreationFee,
    );
    console.log(
      `- AssetsHolder#${CREATE_TOKEN}(): done, name = ${name}, symbol = ${symbol}, initialSupply = ${initialSupply}, token-creation-fee = ${tokenCreationFee}, TxnId = ${record.transactionId}\n`,
    );
  };

  public mintToken = async (
    tokenAddress: string,
    mintAmount: number,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(tokenAddress)
      .addUint256(mintAmount);
    const { record } = await this.execute(2_00_000, MINT_TOKEN, client, args);
    console.log(
      `- AssetsHolder#${MINT_TOKEN}(): done, token-address = ${tokenAddress}, amount = ${mintAmount}, TxnId = ${record.transactionId}\n`,
    );
  };

  public burnToken = async (
    tokenAddress: string,
    burnAmount: number,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(tokenAddress)
      .addUint256(burnAmount);
    const { record } = await this.execute(2_00_000, BURN_TOKEN, client, args);
    console.log(
      `- AssetsHolder#${BURN_TOKEN}(): done, token-address = ${tokenAddress}, amount = ${burnAmount}, TxnId = ${record.transactionId}\n`,
    );
  };

  public transfer = async (
    toAddress: string,
    tokenAddress: string,
    amount: number,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(toAddress)
      .addAddress(tokenAddress)
      .addUint256(amount);
    const { record } = await this.execute(1_00_000, TRANSFER, client, args);
    console.log(
      `- AssetsHolder#${TRANSFER}(): done, to = ${toAddress}, token-address = ${tokenAddress}, amount = ${amount}, TxnId = ${record.transactionId}\n`,
    );
  };

  public getCreatedTokens = async (
    delayRequired: boolean = false,
  ): Promise<TokenId[]> => {
    const events = await MirrorNodeService.getInstance().getEvents(
      this.contractId,
      delayRequired,
    );
    return (events.get(Events.TokenCreated) ?? []).map((event: any) =>
      TokenId.fromSolidityAddress(event.token),
    );
  };
}
