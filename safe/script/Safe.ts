import Base from "../../e2e-test/business/Base";
import { clientsInfo } from "../../utils/ClientManagement";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";
import { BigNumber } from "bignumber.js";
import { Helper } from "../../utils/Helper";

const GET_CHAIN_ID = "getChainId";
const SETUP = "setup";
const EXEC_TRANSACTION = "execTransaction";
const NONCE = "nonce";
const GET_TRANSACTION_HASH = "getTransactionHash";
const APPROVE_HASH = "approveHash";
const GET_OWNERS = "getOwners";

export default class Safe extends Base {
  getChainId = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(
      9000000,
      GET_CHAIN_ID,
      client,
      undefined
    );
    const chainId = result.getUint256(0);
    console.log(`- Safe#${GET_CHAIN_ID}(): ${chainId}\n`);
    return chainId;
  };

  getNonce = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(9000000, NONCE, client, undefined);
    const nonceCount = result.getUint256(0);
    console.log(`- Safe#${NONCE}(): ${nonceCount}\n`);
    return nonceCount;
  };

  setup = async (
    owners: Array<string>,
    thresholdCount: number,
    to: string,
    data: Uint8Array,
    fallbackHandlerAddress: string,
    paymentTokenAddress: string,
    payment: BigNumber,
    paymentReceiverAddress: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addAddressArray(owners)
      .addUint256(thresholdCount)
      .addAddress(to)
      .addBytes(data)
      .addAddress(fallbackHandlerAddress)
      .addAddress(paymentTokenAddress)
      .addUint256(payment)
      .addAddress(paymentReceiverAddress);

    await this.execute(9000000, SETUP, client, args);
    console.log(`- Safe#${SETUP}(): Done\n`);
  };

  execTransaction = async (
    to: string,
    value: number | BigNumber,
    data: Uint8Array,
    operation: number,
    safeTxGas: BigNumber,
    baseGas: BigNumber,
    gasPrice: BigNumber,
    gasToken: string,
    refundReceiverAddress: string,
    signatures: Uint8Array,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(to)
      .addUint256(value)
      .addBytes(data)
      .addUint8(operation)
      .addUint256(safeTxGas)
      .addUint256(baseGas)
      .addUint256(gasPrice)
      .addAddress(gasToken)
      .addAddress(refundReceiverAddress)
      .addBytes(signatures);

    const { result } = await this.execute(
      9000000,
      EXEC_TRANSACTION,
      client,
      args
    );
    console.log(
      `- Safe#${EXEC_TRANSACTION}(): Execution success - ${result.getBool(
        0
      )} \n`
    );
  };

  getTransactionHash = async (
    to: string,
    value: number | BigNumber,
    data: Uint8Array,
    operation: number,
    safeTxGas: BigNumber,
    baseGas: BigNumber,
    gasPrice: BigNumber,
    gasToken: string,
    refundReceiverAddress: string,
    nonce: number,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(to)
      .addUint256(value)
      .addBytes(data)
      .addUint8(operation)
      .addUint256(safeTxGas)
      .addUint256(baseGas)
      .addUint256(gasPrice)
      .addAddress(gasToken)
      .addAddress(refundReceiverAddress)
      .addUint256(nonce);

    const { result, receipt } = await this.execute(
      9000000,
      GET_TRANSACTION_HASH,
      client,
      args
    );
    const r = result.getBytes32(0);
    console.log(
      `- Safe#${GET_TRANSACTION_HASH}(): Execution success - ${receipt.status} \n`
    );
    return r;
  };

  approveHash = async (hashToApprove: Uint8Array, client: Client) => {
    const args = new ContractFunctionParameters().addBytes32(hashToApprove);

    const { receipt, record } = await this.execute(
      9000000,
      APPROVE_HASH,
      client,
      args
    );
    console.log(`- Safe#${APPROVE_HASH}(): ${receipt.status}\n`);
  };

  getOwners = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(9000000, GET_OWNERS, client);
    console.log(`- Safe#${GET_OWNERS}(): ${Helper.getAddressArray(result)}\n`);
  };
}
