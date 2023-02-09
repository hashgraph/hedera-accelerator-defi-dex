import Base from "./Base";
import Pair from "./Pair";
import { BigNumber } from "bignumber.js";
import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import {
  ContractFunctionParameters,
  TokenId,
  PrivateKey,
  Client,
  AccountId,
  ContractId,
} from "@hashgraph/sdk";

const GET_PAIR = "getPair";
const GET_PAIRS = "getPairs";
const CREATE_PAIR = "createPair";
const SETUP_FACTORY = "setUpFactory";
const GET_TRANSACTIONS_FEE = "getTransactionsFee";
const SET_TRANSACTIONS_FEE = "setTransactionFee";
export const METHOD_PAIR_IMPL = "upgradePairImplementation";
export const METHOD_LP_IMPL = "upgradeLpTokenImplementation";

export default class Factory extends Base {
  setupFactory = async (
    adminAddress: string = clientsInfo.dexOwnerId.toSolidityAddress(),
    client: Client = clientsInfo.operatorClient
  ) => {
    try {
      const args = new ContractFunctionParameters()
        .addAddress(this.htsAddress)
        .addAddress(adminAddress);
      await this.execute(9000000, SETUP_FACTORY, client, args, undefined);
      console.log(`- Factory#${SETUP_FACTORY}(): done\n`);
    } catch (error) {
      console.error(`- Factory#${SETUP_FACTORY}(): error`, error, "\n");
      return false;
    }
    return true;
  };

  createPair = async (
    token1: TokenId,
    token2: TokenId,
    feeCollectionAccountId: AccountId,
    tokensOwnerKey: PrivateKey,
    client: Client = clientsInfo.operatorClient,
    fee: BigNumber = new BigNumber(10)
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(token1.toSolidityAddress())
      .addAddress(token2.toSolidityAddress())
      .addAddress(feeCollectionAccountId.toSolidityAddress())
      .addInt256(fee);
    const { result } = await this.execute(
      9000000,
      CREATE_PAIR,
      client,
      args,
      tokensOwnerKey,
      100
    );
    const address = result.getAddress(0);
    console.log(
      `- Factory#${CREATE_PAIR}(): TokenId = ${token1}, TokenId = ${token2}, fee = ${fee} and resulted pair = ${address}\n`
    );
    return address;
  };

  getPair = async (
    token1: TokenId,
    token2: TokenId,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(token1.toSolidityAddress())
      .addAddress(token2.toSolidityAddress());
    const { result } = await this.execute(
      9999999,
      GET_PAIR,
      client,
      args,
      undefined
    );
    const address = result.getAddress(0);
    console.log(`- Factory#${GET_PAIR}(): pair = ${address}\n`);
    return address;
  };

  getPairs = async (
    client: Client = clientsInfo.operatorClient
  ): Promise<string[]> => {
    const { result } = await this.execute(
      9999999,
      GET_PAIRS,
      client,
      undefined,
      undefined
    );
    const addresses = Helper.getAddressArray(result);
    console.log(
      `- Factory#${GET_PAIRS}(): count = ${addresses.length}, pairs = [${addresses}]\n`
    );
    return addresses;
  };

  setTransactionFee = async (
    key: BigNumber,
    value: BigNumber,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addUint256(key)
      .addUint256(value);
    await this.execute(50000, SET_TRANSACTIONS_FEE, client, args);
    console.log(
      `- Factory#${SET_TRANSACTIONS_FEE}(): key = ${key.toFixed()}, value = ${value.toFixed()} done\n`
    );
  };

  getTransactionsFee = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(50000, GET_TRANSACTIONS_FEE, client);
    const items = Helper.getUint256Array(result);
    const fees = Helper.convertToFeeObjectArray(items);
    console.log(
      `- Factory#${GET_TRANSACTIONS_FEE}(): count = ${
        fees.length
      }, fees = ${JSON.stringify(fees)}\n`
    );
    return items;
  };

  upgradeLogic = async (implAddress: string, functionName: string) => {
    const args = new ContractFunctionParameters().addAddress(implAddress);
    this.execute(4000000, functionName, clientsInfo.dexOwnerClient, args);
    console.log(`- Factory${functionName}(): done\n`);
  };

  resolveProxyAddress = async (functionName: string, proxyAddress: string) => {
    if (functionName === METHOD_PAIR_IMPL) {
      return proxyAddress;
    }
    if (functionName === METHOD_LP_IMPL) {
      const cId = ContractId.fromSolidityAddress(proxyAddress).toString();
      return await new Pair(cId).getLpContractAddress();
    }
    throw Error(`Invalid function name passed: ${functionName}`);
  };
}
