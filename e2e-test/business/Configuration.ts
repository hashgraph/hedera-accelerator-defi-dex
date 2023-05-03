import Base from "./Base";
import { Helper } from "../../utils/Helper";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import { Client, PrivateKey, ContractFunctionParameters } from "@hashgraph/sdk";

const INITIALIZE = "initialize";
const GET_TRANSACTIONS_FEE = "getTransactionsFee";
const SET_TRANSACTIONS_FEE = "setTransactionFee";
const ADD_URL_KEY = "addUrlKey";
const GET_URL_KEYS = "getCommaSeparatedUrlKeys";

export default class Configuration extends Base {
  initialize = async (client: Client = clientsInfo.operatorClient) => {
    if (await this.isInitializationPending()) {
      await this.execute(8_00_000, INITIALIZE, client);
      console.log(`- Configuration#${INITIALIZE}(): done\n`);
      return;
    }
    console.log(`- Configuration#${INITIALIZE}(): already done\n`);
  };

  setTransactionFee = async (
    key: BigNumber,
    value: BigNumber,
    ownerKey: PrivateKey,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addUint256(key)
      .addUint256(value);
    await this.execute(400000, SET_TRANSACTIONS_FEE, client, args, ownerKey);
    console.log(
      `- Configuration#${SET_TRANSACTIONS_FEE}(): key = ${key.toFixed()}, value = ${value.toFixed()} done\n`
    );
  };

  getTransactionsFee = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(50000, GET_TRANSACTIONS_FEE, client);
    const items = Helper.getUint256Array(result);
    const fees = Helper.convertToFeeObjectArray(items);
    console.log(
      `- Configuration#${GET_TRANSACTIONS_FEE}(): count = ${
        fees.length
      }, fees = ${JSON.stringify(fees)}\n`
    );
    return items;
  };

  addUrlKey = async (
    key: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addString(key);
    await this.execute(
      400000,
      ADD_URL_KEY,
      client,
      args,
      clientsInfo.operatorKey
    );
    console.log(
      `- Configuration#${ADD_URL_KEY}(): ${key} added to configuration.\n`
    );
  };

  getCommaSeparatedUrlKeys = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    const { result } = await this.execute(50000, GET_URL_KEYS, client);
    const allKeysCommaSeparated = JSON.stringify(result.getString(0));
    console.log(
      `- Configuration#${GET_URL_KEYS}(): keys = ${allKeysCommaSeparated}\n`
    );
    return allKeysCommaSeparated;
  };
}
