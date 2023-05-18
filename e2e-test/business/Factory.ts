import Base from "./Base";
import Pair from "./Pair";

import { Helper } from "../../utils/Helper";
import { BigNumber } from "bignumber.js";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
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
const RECOMMENDED_PAIR_TO_SWAP = "recommendedPairToSwap";
export const METHOD_PAIR_IMPL = "upgradePairImplementation";
export const METHOD_LP_IMPL = "upgradeLpTokenImplementation";

export default class Factory extends Base {
  setupFactory = async (client: Client = clientsInfo.operatorClient) => {
    if (await this.isInitializationPending()) {
      const deployment = new Deployment();
      const deployedItems = await deployment.deployContracts([
        ContractService.PAIR,
        ContractService.LP_TOKEN,
      ]);
      const pair = deployedItems.get(ContractService.PAIR);
      const lpToken = deployedItems.get(ContractService.LP_TOKEN);
      const args = new ContractFunctionParameters()
        .addAddress(this.htsAddress)
        .addAddress(clientsInfo.dexOwnerId.toSolidityAddress())
        .addAddress(pair.address)
        .addAddress(lpToken.address)
        .addAddress(this.configuration);
      await this.execute(9_00_000, SETUP_FACTORY, client, args);
      console.log(`- Factory#${SETUP_FACTORY}(): done\n`);
      return;
    }
    console.log(`- Factory#${SETUP_FACTORY}(): already done\n`);
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
      .addUint256(fee);
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
    fee: BigNumber = new BigNumber(10),
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(token1.toSolidityAddress())
      .addAddress(token2.toSolidityAddress())
      .addUint256(fee);
    const { result } = await this.execute(
      5_00_000,
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
      1_000_000,
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

  recommendedPairToSwap = async (
    tokenAddress: string,
    otherTokenAddress: string,
    qtyToSwap: BigNumber,
    client: Client = clientsInfo.operatorClient
  ): Promise<number> => {
    const args = new ContractFunctionParameters()
      .addAddress(tokenAddress)
      .addAddress(otherTokenAddress)
      .addUint256(qtyToSwap);

    const { result } = await this.execute(
      2_000_000,
      RECOMMENDED_PAIR_TO_SWAP,
      client,
      args,
      undefined
    );
    console.log(
      `- Factory#${RECOMMENDED_PAIR_TO_SWAP}(): 
      Selected pair = ${result.getAddress(0)}, 
      token = ${result.getAddress(1)}, 
      swapped qty = ${result.getUint256(2)}, 
      fee = ${result.getUint256(3)}, 
      slippage = ${result.getUint256(4)}
      \n`
    );
    return Number(result.getUint256(2));
  };
}
