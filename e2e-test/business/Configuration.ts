import Base from "./Base";
import { Helper } from "../../utils/Helper";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";

const INITIALIZE = "initialize";
const GET_TRANSACTIONS_FEE = "getTransactionsFee";
const SET_TRANSACTIONS_FEE = "setTransactionFee";

export default class Configuration extends Base {
  initialize = async (client: Client = clientsInfo.operatorClient) => {
    try {
      await this.execute(800000, INITIALIZE, client);
      console.log(`- Configuration#${INITIALIZE}(): done\n`);
      return true;
    } catch (error) {
      console.error(`- Configuration#${INITIALIZE}(): error ${error}\n`);
      return false;
    }
  };

  setTransactionFee = async (
    key: BigNumber,
    value: BigNumber,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addUint256(key)
      .addUint256(value);
    await this.execute(400000, SET_TRANSACTIONS_FEE, client, args);
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
}
