import Base from "./Base";
import { clientsInfo } from "../../utils/ClientManagement";
import {
  ContractFunctionParameters,
  Client,
  AccountId,
  PrivateKey,
} from "@hashgraph/sdk";
import BigNumber from "bignumber.js";

const INITIALIZE = "initialize";
const ALLOT_LP_TOKEN = "allotLPTokenFor";
const REMOVE_LP_TOKEN = "removeLPTokenFor";
const LP_TOKEN_FOR_USER = "lpTokenForUser";
const GET_LP_TOKEN_COUNT = "getAllLPTokenCount";
const GET_LP_TOKEN_ADDRESS = "getLpTokenAddress";

export default class LpToken extends Base {
  contractId: string;

  constructor(_contractId: string) {
    super();
    this.contractId = _contractId;
  }

  initialize = async (
    htsAddress: string,
    tokenName: string,
    tokenSymbol: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(htsAddress)
      .addString(tokenSymbol)
      .addString(tokenName);
    await this.execute(
      this.contractId,
      INITIALIZE,
      client,
      args,
      undefined,
      60
    );
    console.log(`- LpToken#${INITIALIZE}(): done\n`);
  };

  getLpTokenAddress = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(
      this.contractId,
      GET_LP_TOKEN_ADDRESS,
      client
    );
    const address = result.getAddress(0);
    console.log(`- LpToken#${GET_LP_TOKEN_ADDRESS}(): address = ${address}\n`);
    return address;
  };

  getAllLPTokenCount = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(
      this.contractId,
      GET_LP_TOKEN_COUNT,
      client
    );
    const count = result.getInt256(0);
    console.log(`- LpToken#${GET_LP_TOKEN_COUNT}(): count = ${count}\n`);
    return count;
  };

  allotLPToken = async (
    tokenAQty: BigNumber,
    tokenBQty: BigNumber,
    receiverAccountId: AccountId,
    receiverPrivateKey: PrivateKey,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addInt256(tokenAQty)
      .addInt256(tokenBQty)
      .addAddress(receiverAccountId.toSolidityAddress());
    await this.execute(
      this.contractId,
      ALLOT_LP_TOKEN,
      client,
      args,
      receiverPrivateKey
    );
    const number = Number(tokenAQty.multipliedBy(tokenBQty));
    const sqrt = Math.sqrt(number);
    console.log(
      `- LpToken#${ALLOT_LP_TOKEN}(): quantities = [${tokenAQty} x ${tokenAQty}], sqrt = ${sqrt}\n`
    );
  };

  removeLPToken = async (
    lpTokenQty: BigNumber,
    senderAccountId: AccountId,
    senderPrivateKey: PrivateKey,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addInt256(lpTokenQty)
      .addAddress(senderAccountId.toSolidityAddress());
    await this.execute(
      this.contractId,
      REMOVE_LP_TOKEN,
      client,
      args,
      senderPrivateKey
    );
    console.log(`- LpToken#${REMOVE_LP_TOKEN}(): qty = ${lpTokenQty}\n`);
  };

  lpTokenForUser = async (
    userAccountId: AccountId,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addAddress(
      userAccountId.toSolidityAddress()
    );
    const { result } = await this.execute(
      this.contractId,
      LP_TOKEN_FOR_USER,
      client,
      args
    );
    const count = result.getInt256(0);
    console.log(`- LpToken#${LP_TOKEN_FOR_USER}(): count = ${count}\n`);
  };
}
