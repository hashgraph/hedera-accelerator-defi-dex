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
      await this.execute(SETUP_FACTORY, client, args);
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
    const { result } = await this.execute(GET_PAIR, client, args);
    const address = result.getAddress(0);
    console.log(`- Factory#${GET_PAIR}(): pair = ${address}\n`);
    return address;
  };

  getPairs = async (
    client: Client = clientsInfo.operatorClient
  ): Promise<string[]> => {
    const { result } = await this.execute(GET_PAIRS, client);
    const addresses = Helper.getAddressArray(result);
    console.log(
      `- Factory#${GET_PAIRS}(): count = ${addresses.length}, pairs = [${addresses}]\n`
    );
    return addresses;
  };

  upgradeLogic = async (implAddress: string, functionName: string) => {
    const args = new ContractFunctionParameters().addAddress(implAddress);
    this.execute(functionName, clientsInfo.dexOwnerClient, args);
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
