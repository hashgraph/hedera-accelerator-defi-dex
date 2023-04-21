import BaseDao from "./BaseDao";

import { ethers } from "ethers";
import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import {
  Client,
  TokenId,
  AccountId,
  ContractId,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import Base from "./Base";

const STATE = "state";
const INITIALIZE = "initialize";
const GET_TRANSACTION_INFO = "getTransactionInfo";
const PROPOSE_TRANSACTION = "proposeTransaction";
const PROPOSE_TRANSFER_TRANSACTION = "proposeTransferTransaction";
const GET_HEDERA_GNOSIS_SAFE_CONTRACT_ADDRESS =
  "getHederaGnosisSafeContractAddress";

export enum Operation {
  CALL,
  DELEGATE,
}

const deployment = new Deployment();

export default class MultiSigDao extends BaseDao {
  async initialize(
    admin: string,
    name: string,
    logoURL: string,
    owners: string[],
    client: Client = clientsInfo.operatorClient,
    threshold: number = owners.length
  ) {
    if (await this.isInitializationPending()) {
      const deployedItems = await deployment.deployContracts([
        ContractService.SAFE,
        ContractService.SAFE_FACTORY,
      ]);
      const gnosisLogic = deployedItems.get(ContractService.SAFE);
      const gnosisFactory = deployedItems.get(ContractService.SAFE_FACTORY);
      const gnosisFactoryId = ContractId.fromSolidityAddress(
        gnosisFactory.address
      );

      const gnosisProxy = await this.createProxy(
        gnosisFactoryId,
        gnosisLogic.address,
        owners,
        threshold,
        client
      );

      const args = new ContractFunctionParameters()
        .addAddress(admin)
        .addString(name)
        .addString(logoURL)
        .addAddress(gnosisProxy.toSolidityAddress())
        .addAddress(this.htsAddress);
      await this.execute(9_00_000, INITIALIZE, client, args);
      console.log(`- MultiSigDao#${INITIALIZE}(): done\n`);
      return;
    }
    console.log(`- MultiSigDao#${INITIALIZE}(): already done\n`);
  }

  getHederaGnosisSafeContractAddress = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    const { result } = await this.execute(
      35_000,
      GET_HEDERA_GNOSIS_SAFE_CONTRACT_ADDRESS,
      client
    );
    const address = result.getAddress(0);
    console.log(
      `- MultiSigDao#${GET_HEDERA_GNOSIS_SAFE_CONTRACT_ADDRESS}(): address = ${address}\n`
    );
    return ContractId.fromSolidityAddress(address);
  };

  state = async (
    txnHash: Uint8Array,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addBytes32(txnHash);
    const { result } = await this.execute(80_000, STATE, client, args);
    const hash = ethers.utils.hexlify(txnHash);
    const state = result.getInt256(0);
    console.log(
      `- MultiSigDao#${STATE}(): txnHash = ${hash}, state = ${state}\n`
    );
  };

  getTransactionInfo = async (
    txnHash: Uint8Array,
    client: Client = clientsInfo.uiUserClient
  ) => {
    const hash = ethers.utils.hexlify(txnHash);
    const args = new ContractFunctionParameters().addBytes32(txnHash);
    const { result } = await this.execute(
      1_00_000,
      GET_TRANSACTION_INFO,
      client,
      args
    );
    const to = result.getAddress(1);
    const value = result.getUint256(2);
    const bytes = Helper.getBytes(result, 3);
    const operation = result.getUint256(4);
    const nonce = result.getUint256(5);
    const info = {
      to,
      value,
      operation,
      nonce,
      data: ethers.utils.hexlify(bytes),
    };
    const _info = JSON.stringify(info);
    console.log(
      `- MultiSigDao#${GET_TRANSACTION_INFO}(): txnHash = ${hash}\n-- ${_info}\n`
    );
    return info;
  };

  proposeTransaction = async (
    to: string,
    data: Uint8Array,
    operation: Operation,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(to)
      .addBytes(data)
      .addUint8(operation);
    const { result } = await this.execute(
      2_00_000,
      PROPOSE_TRANSACTION,
      client,
      args
    );
    const txnHash = result.getBytes32(0);
    const hash = ethers.utils.hexlify(txnHash);
    console.log(`- MultiSigDao#${PROPOSE_TRANSACTION}(): txnHash = ${hash}\n`);
    return txnHash;
  };

  proposeTransferTransaction = async (
    token: TokenId,
    receiver: AccountId | ContractId,
    amount: number,
    client: Client = clientsInfo.uiUserClient
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(token.toSolidityAddress())
      .addAddress(receiver.toSolidityAddress())
      .addUint256(amount);
    const { result } = await this.execute(
      9_90_000,
      PROPOSE_TRANSFER_TRANSACTION,
      client,
      args
    );
    const txnHash = result.getBytes32(0);
    const hash = ethers.utils.hexlify(txnHash);
    console.log(
      `- MultiSigDao#${PROPOSE_TRANSFER_TRANSACTION}(): txnHash = ${hash}\n`
    );
    return txnHash;
  };

  private async createProxy(
    contractId: ContractId,
    logicAddress: string,
    owners: string[],
    threshold: number,
    client: Client
  ) {
    const createProxyArgs = new ContractFunctionParameters()
      .addAddress(logicAddress)
      .addBytes(new Uint8Array());
    const gnosisFactory = new Base(contractId.toString());
    const { result } = await gnosisFactory.execute(
      2_00_000,
      "createProxy",
      client,
      createProxyArgs
    );
    const gnosisProxyAddress = result.getAddress(0);
    console.log(
      ` - GnosisSafeProxyFactory#createProxy(): address = ${gnosisProxyAddress}\n`
    );

    const cId = ContractId.fromSolidityAddress(gnosisProxyAddress);

    const setupArgs = new ContractFunctionParameters()
      .addAddressArray(owners)
      .addUint256(threshold)
      .addAddress("0x0000000000000000000000000000000000000000")
      .addBytes(new Uint8Array())
      .addAddress("0x0000000000000000000000000000000000000000")
      .addAddress("0x0000000000000000000000000000000000000000")
      .addUint256(0)
      .addAddress("0x0000000000000000000000000000000000000000");
    const gnosis = new Base(cId.toString());
    await gnosis.execute(5_00_000, "setup", client, setupArgs);
    console.log(` - GnosisSafe#setup(): done\n`);
    return cId;
  }
}
