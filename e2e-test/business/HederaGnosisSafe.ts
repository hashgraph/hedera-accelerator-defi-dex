import Base from "./Base";
import ContractMetadata from "../../utils/ContractMetadata";

import { ethers } from "ethers";
import { Helper } from "../../utils/Helper";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";

const GET_OWNERS = "getOwners";
const APPROVE_HASH = "approveHash";
const GET_THRESHOLD = "getThreshold";
const EXEC_TRANSACTION = "executeTransaction";
const GET_TRANSACTION_HASH = "getTransactionHash";

export default class HederaGnosisSafe extends Base {
  executeTransaction = async (
    to: string,
    value: number | BigNumber,
    data: Uint8Array | string,
    operation: number | BigNumber,
    nonce: number | BigNumber,
    client: Client = clientsInfo.treasureClient
  ) => {
    const _data =
      data instanceof Uint8Array ? data : ethers.utils.arrayify(data);
    const op =
      operation instanceof BigNumber ? operation.toNumber() : operation;
    const args = new ContractFunctionParameters()
      .addAddress(to)
      .addUint256(value)
      .addBytes(_data)
      .addUint8(op)
      .addUint256(nonce);
    const { result, record } = await this.execute(
      10_00_000,
      EXEC_TRANSACTION,
      client,
      args
    );
    const hexBytes = ethers.utils.hexlify(result.asBytes());
    const isSuccess = result.getUint256(0).toNumber() === 1;
    console.log(
      `- GnosisSafe#${EXEC_TRANSACTION}(): resultHex = ${hexBytes}, status = ${isSuccess}, TxnId = ${record.transactionId.toString()}\n`
    );
    return isSuccess;
  };

  approveHash = async (txnHash: Uint8Array, client: Client) => {
    const hash = ethers.utils.hexlify(txnHash);
    const args = new ContractFunctionParameters().addBytes32(txnHash);
    const { receipt } = await this.execute(
      9_00_000,
      APPROVE_HASH,
      client,
      args
    );
    console.log(
      `- GnosisSafe#${APPROVE_HASH}(): txnHash = ${hash}, status = ${receipt.status}\n`
    );
  };

  getOwners = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(50_000, GET_OWNERS, client);
    const owners = Helper.getAddressArray(result);
    console.log(
      `- GnosisSafe#${GET_OWNERS}(): count = ${owners.length}, addresses = [${owners}]\n`
    );
    return owners;
  };

  getThreshold = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(90_000, GET_THRESHOLD, client);
    const threshold = result.getUint256(0).toNumber();
    console.log(`- GnosisSafe#${GET_THRESHOLD}(): threshold = ${threshold}\n`);
    return threshold;
  };

  getTransactionHash = async (
    to: string,
    value: number | BigNumber,
    data: string,
    operation: number,
    nonce: number,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(to)
      .addUint256(value)
      .addBytes(ethers.utils.arrayify(data))
      .addUint8(operation)
      .addUint256(0)
      .addUint256(0)
      .addUint256(0)
      .addAddress("0x0000000000000000000000000000000000000000")
      .addAddress("0x0000000000000000000000000000000000000000")
      .addUint256(nonce);

    const { result } = await this.execute(
      2_00_000,
      GET_TRANSACTION_HASH,
      client,
      args
    );
    const txnHash = result.getBytes32(0);
    const txnHashString = ethers.utils.hexlify(txnHash);
    console.log(
      `- GnosisSafe#${GET_TRANSACTION_HASH}(): txnHash = ${txnHashString}\n`
    );
    return txnHash;
  };

  public async getHederaGnosisSafeInterface() {
    return await new ContractMetadata().getContractInterface(
      "HederaGnosisSafe"
    );
  }
}
