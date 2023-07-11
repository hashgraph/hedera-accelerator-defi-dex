import Base from "./Base";
import Common from "./Common";
import BaseDao from "./BaseDao";
import HederaGnosisSafe from "./HederaGnosisSafe";

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
  PrivateKey,
} from "@hashgraph/sdk";

const TITLE = "TITLE";
const DESCRIPTION = "DESCRIPTION";
const LINK_TO_DISCUSSION = "LINK_TO_DISCUSSION";

const STATE = "state";
const INITIALIZE = "initialize";
const GET_TRANSACTION_INFO = "getTransactionInfo";
const PROPOSE_TRANSACTION = "proposeTransaction";
const GET_APPROVAL_COUNTS = "getApprovalCounts";
const PROPOSE_BATCH_TRANSACTION = "proposeBatchTransaction";
const PROPOSE_TRANSFER_TRANSACTION = "proposeTransferTransaction";
const GET_HEDERA_GNOSIS_SAFE_CONTRACT_ADDRESS =
  "getHederaGnosisSafeContractAddress";
const GET_MULTI_SEND_CONTRACT_ADDRESS = "getMultiSendContractAddress";

enum TransactionState {
  Pending,
  Approved,
  Executed,
}

const ADD_MEMBER = 1001;
const REMOVE_MEMBER = 1002;
const REPLACE_MEMBER = 1003;
const CHANGE_THRESHOLD = 1004;

const deployment = new Deployment();

export default class MultiSigDao extends BaseDao {
  async initialize(
    admin: string,
    name: string,
    logoURL: string,
    desc: string,
    webLinks: string[],
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
        .addString(desc)
        .addStringArray(webLinks)
        .addAddress(gnosisProxy.toSolidityAddress())
        .addAddress(this.htsAddress)
        .addAddress(this.getMultiSendContractAddress());
      await this.execute(9_00_000, INITIALIZE, client, args);
      console.log(`- MultiSigDao#${INITIALIZE}(): ${this.contractId} done\n`);
      return;
    }
    console.log(
      `- MultiSigDao#${INITIALIZE}(): ${this.contractId} already done\n`
    );
  }

  protected getContractName() {
    return ContractService.MULTI_SIG;
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

  getMultiSendContractAddressFromDAO = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    const { result } = await this.execute(
      50_000,
      GET_MULTI_SEND_CONTRACT_ADDRESS,
      client
    );
    const address = result.getAddress(0);
    console.log(
      `- MultiSigDao#${GET_MULTI_SEND_CONTRACT_ADDRESS}(): address = ${address}\n`
    );
    return ContractId.fromSolidityAddress(address);
  };

  state = async (
    txnHash: Uint8Array,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addBytes32(txnHash);
    const { result } = await this.execute(5_00_000, STATE, client, args);
    const hash = ethers.utils.hexlify(txnHash);
    const state = result.getInt256(0);
    console.log(
      `- MultiSigDao#${STATE}(): txnHash = ${hash}, state = ${state}\n`
    );
    return state;
  };

  getApprovalCounts = async (
    txnHash: Uint8Array,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addBytes32(txnHash);
    const { result } = await this.execute(
      5_00_000,
      GET_APPROVAL_COUNTS,
      client,
      args
    );
    const hash = ethers.utils.hexlify(txnHash);
    const count = result.getInt256(0);
    console.log(
      `- MultiSigDao#${GET_APPROVAL_COUNTS}(): txnHash = ${hash}, count = ${count}\n`
    );
    return count;
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
    const txnType = result.getUint256(6);
    const info = {
      to,
      value,
      operation,
      nonce,
      data: ethers.utils.hexlify(bytes),
      type: txnType,
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
    transactionType: number = 10,
    client: Client = clientsInfo.operatorClient,
    title: string = TITLE,
    description: string = DESCRIPTION,
    linkToDiscussion: string = LINK_TO_DISCUSSION
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(to)
      .addBytes(data)
      .addUint256(transactionType)
      .addString(title)
      .addString(description)
      .addString(linkToDiscussion);
    const { result } = await this.execute(
      3_000_000,
      PROPOSE_TRANSACTION,
      client,
      args
    );
    const txnHash = result.getBytes32(0);
    const hash = ethers.utils.hexlify(txnHash);
    console.log(`- MultiSigDao#${PROPOSE_TRANSACTION}(): txnHash = ${hash}\n`);
    return txnHash;
  };

  setupAllowanceForTransferTransaction = async (
    token: TokenId,
    allowanceAmount: number,
    tokenSenderClient: Client = clientsInfo.uiUserClient,
    tokenSenderAccountId: AccountId = clientsInfo.uiUserId,
    tokenSenderPrivateKey: PrivateKey = clientsInfo.uiUserKey,
    gnosisSafe: HederaGnosisSafe
  ) => {
    await Common.setTokenAllowance(
      token,
      gnosisSafe.contractId,
      allowanceAmount,
      tokenSenderAccountId,
      tokenSenderPrivateKey,
      tokenSenderClient
    );
  };

  proposeAddOwnerWithThreshold = async (
    threshold: number,
    newOwnerAccountId: AccountId,
    gnosisSafe: HederaGnosisSafe,
    client: Client = clientsInfo.operatorClient
  ) => {
    const data = await this.encodeFunctionData(
      ContractService.SAFE,
      "addOwnerWithThreshold",
      [newOwnerAccountId.toSolidityAddress(), threshold]
    );
    return await this.proposeTransaction(
      ContractId.fromString(gnosisSafe.contractId).toSolidityAddress(),
      data.bytes,
      ADD_MEMBER,
      client
    );
  };

  proposeChangeThreshold = async (
    threshold: number,
    gnosisSafe: HederaGnosisSafe,
    client: Client = clientsInfo.operatorClient
  ) => {
    const data = await this.encodeFunctionData(
      ContractService.SAFE,
      "changeThreshold",
      [threshold]
    );
    return await this.proposeTransaction(
      ContractId.fromString(gnosisSafe.contractId).toSolidityAddress(),
      data.bytes,
      CHANGE_THRESHOLD,
      client
    );
  };

  proposeRemoveOwnerWithThreshold = async (
    threshold: number,
    previousOwnerAccountId: AccountId,
    ownerAccountId: AccountId,
    gnosisSafe: HederaGnosisSafe,
    client: Client = clientsInfo.operatorClient
  ) => {
    const data = await this.encodeFunctionData(
      ContractService.SAFE,
      "removeOwner",
      [
        previousOwnerAccountId.toSolidityAddress(),
        ownerAccountId.toSolidityAddress(),
        threshold,
      ]
    );
    return await this.proposeTransaction(
      ContractId.fromString(gnosisSafe.contractId).toSolidityAddress(),
      data.bytes,
      REMOVE_MEMBER,
      client
    );
  };

  proposeSwapOwnerWithThreshold = async (
    previousOwnerAccountId: AccountId,
    oldOwnerAccountId: AccountId,
    newOwnerAccountId: AccountId,
    gnosisSafe: HederaGnosisSafe,
    client: Client = clientsInfo.operatorClient
  ) => {
    const data = await this.encodeFunctionData(
      ContractService.SAFE,
      "swapOwner",
      [
        previousOwnerAccountId.toSolidityAddress(),
        oldOwnerAccountId.toSolidityAddress(),
        newOwnerAccountId.toSolidityAddress(),
      ]
    );
    return await this.proposeTransaction(
      ContractId.fromString(gnosisSafe.contractId).toSolidityAddress(),
      data.bytes,
      REPLACE_MEMBER,
      client
    );
  };

  proposeBatchTransaction = async (
    values: number[],
    targets: ContractId[],
    callDataArray: Uint8Array[],
    client: Client = clientsInfo.operatorClient,
    title: string = TITLE,
    description: string = DESCRIPTION,
    linkToDiscussion: string = LINK_TO_DISCUSSION
  ) => {
    const args = new ContractFunctionParameters()
      .addAddressArray(
        targets.map((address: ContractId) => address.toSolidityAddress())
      )
      .addUint256Array(values)
      .addBytesArray(callDataArray)
      .addString(title)
      .addString(description)
      .addString(linkToDiscussion);
    const { result } = await this.execute(
      1_000_000,
      PROPOSE_BATCH_TRANSACTION,
      client,
      args
    );
    const txnHash = result.getBytes32(0);
    const hash = ethers.utils.hexlify(txnHash);
    console.log(
      `- MultiSigDao#${PROPOSE_BATCH_TRANSACTION}(): txnHash = ${hash}\n`
    );
    return txnHash;
  };

  proposeTransferTransaction = async (
    token: TokenId,
    receiver: AccountId | ContractId,
    amount: number,
    tokenSenderClient: Client = clientsInfo.uiUserClient,
    title: string = TITLE,
    description: string = DESCRIPTION,
    linkToDiscussion: string = LINK_TO_DISCUSSION
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(token.toSolidityAddress())
      .addAddress(receiver.toSolidityAddress())
      .addUint256(amount)
      .addString(title)
      .addString(description)
      .addString(linkToDiscussion);
    const { result } = await this.execute(
      3_000_000,
      PROPOSE_TRANSFER_TRANSACTION,
      tokenSenderClient,
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
    const gnosisFactory = new Common(contractId);
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
    const gnosis = new Common(cId);
    await gnosis.execute(5_00_000, "setup", client, setupArgs);
    console.log(` - GnosisSafe#setup(): done\n`);
    return cId;
  }

  getTransactionNumericState = async (transactionState: string) => {
    return Object.values(TransactionState).indexOf(transactionState);
  };
}
