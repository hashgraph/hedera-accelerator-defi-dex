import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import {
  Client,
  PrivateKey,
  Transaction,
  ContractExecuteTransaction,
  ContractFunctionParameters,
} from "@hashgraph/sdk";

export default class Base {
  private csDev: ContractService = new ContractService();
  protected htsAddress: string;
  contractId: string;

  constructor(_contractId: string) {
    this.htsAddress = this.getBaseHTSContractAddress();
    this.contractId = _contractId;
    console.log(
      `- Base#constructor(): called with contract-id = ${_contractId}\n`
    );
  }

  getCurrentImplementation = async (
    adminKey: PrivateKey = clientsInfo.adminKey,
    client: Client = clientsInfo.operatorClient
  ) => {
    const { result } = await this.execute(
      "implementation",
      client,
      undefined,
      adminKey
    );
    const impAddress = result.getAddress(0);
    console.log(
      `- Base#implementation(): proxyId = ${this.contractId}, implementation =  ${impAddress}\n`
    );
    return impAddress;
  };

  execute = async (
    functionName: string,
    client: Client,
    functionParams: ContractFunctionParameters | undefined = undefined,
    keys: PrivateKey | PrivateKey[] | undefined = undefined,
    amount: BigNumber | number = 0
  ) => {
    const txn = new ContractExecuteTransaction()
      .setContractId(this.contractId)
      .setGas(9500000)
      .setFunction(functionName, functionParams)
      .setPayableAmount(amount);
    const txnToExecute = await this.signTxnIfNeeded(txn, keys, client);
    const txnResponse = await txnToExecute.execute(client);
    const txnReceipt = await txnResponse.getReceipt(client);
    const txnRecord = await txnResponse.getRecord(client);
    return {
      receipt: txnReceipt,
      record: txnRecord,
      result: txnRecord.contractFunctionResult!,
    };
  };

  private signTxnIfNeeded = async (
    txn: Transaction,
    keys: PrivateKey | PrivateKey[] | undefined = undefined,
    client: Client
  ) => {
    if (!keys) return txn;

    if (!Array.isArray(keys)) keys = [keys];

    txn.freezeWith(client);
    for (const key of keys) {
      txn = await txn.sign(key);
    }
    return txn;
  };

  private getBaseHTSContractAddress(): string {
    return this.csDev.getContract(this.csDev.baseContractName).address;
  }
}
