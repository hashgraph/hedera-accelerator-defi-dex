import { Helper } from "../../utils/Helper";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { MirrorNodeService } from "../../utils/MirrorNodeService";
import {
  Client,
  PrivateKey,
  ContractExecuteTransaction,
  ContractFunctionParameters,
} from "@hashgraph/sdk";

export default class Base {
  private csDev: ContractService = new ContractService();
  protected htsAddress: string;
  protected configuration: string;
  contractId: string;

  constructor(_contractId: string) {
    this.htsAddress = this.getBaseHTSContractAddress();
    this.configuration = this.getConfigurationContractAddress();
    this.contractId = _contractId;
  }

  getCurrentImplementation = async (
    adminKey: PrivateKey = clientsInfo.adminKey,
    client: Client = clientsInfo.adminClient
  ) => {
    const { result } = await this.execute(
      2000000,
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
    gas: number,
    functionName: string,
    client: Client,
    functionParams: ContractFunctionParameters | undefined = undefined,
    keys: PrivateKey | PrivateKey[] | undefined = undefined,
    amount: BigNumber | number = 0
  ) => {
    const txn = new ContractExecuteTransaction()
      .setContractId(this.contractId)
      .setGas(gas)
      .setFunction(functionName, functionParams)
      .setPayableAmount(amount);
    const txnToExecute = await Helper.signTxnIfNeeded(txn, keys, client);
    const txnResponse = await txnToExecute.execute(client);
    const txnReceipt = await txnResponse.getReceipt(client);
    const txnRecord = await txnResponse.getRecord(client);
    return {
      receipt: txnReceipt,
      record: txnRecord,
      result: txnRecord.contractFunctionResult!,
    };
  };

  protected isInitializationPending = async () => {
    return await MirrorNodeService.getInstance().isInitializationPending(
      this.contractId
    );
  };

  private getBaseHTSContractAddress(): string {
    return this.csDev.getContract(this.csDev.baseContractName).address;
  }

  private getConfigurationContractAddress(): string {
    return this.csDev.getContractWithProxy(this.csDev.configuration)
      .transparentProxyAddress!!;
  }
}
