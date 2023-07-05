import Base from "./Base";
import { Helper } from "../../utils/Helper";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import { Client, PrivateKey, ContractFunctionParameters } from "@hashgraph/sdk";

const INITIALIZE = "initialize";
const GET_TRANSACTIONS_FEE = "getTransactionsFee";
const SET_TRANSACTIONS_FEE = "setTransactionFee";
const GET_HBARX_ADDRESS = "getHbarxAddress";
const SET_HBARX_ADDRESS = "setHbarxAddress";

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

  getHbarxAddress = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(50000, GET_HBARX_ADDRESS, client);
    const hbarAddress = result.getAddress(0);
    console.log(
      `- Configuration#${GET_HBARX_ADDRESS}(): address = ${hbarAddress}\n`
    );
    return hbarAddress;
  };

  setHbarxAddress = async (
    hbarxAddress: string,
    ownerKey: PrivateKey,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addAddress(hbarxAddress);
    const { receipt } = await this.execute(
      50_000,
      SET_HBARX_ADDRESS,
      client,
      args
    );
    console.log(
      `- Configuration#${SET_HBARX_ADDRESS}(): tx status = ${receipt.status}\n`
    );
  };
}
