import ContractMetadata from "../../utils/ContractMetadata";

import { ethers } from "hardhat";
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
  private UPGRADE_HEDERA_SERVICE = "upgradeHederaService";

  constructor(_contractId: string) {
    this.htsAddress = this.getHederaServiceContractAddress();
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
    functionParams:
      | Uint8Array
      | ContractFunctionParameters
      | undefined = undefined,
    keys: PrivateKey | PrivateKey[] | undefined = undefined,
    amount: BigNumber | number = 0
  ) => {
    const txn = new ContractExecuteTransaction()
      .setContractId(this.contractId)
      .setGas(gas)
      .setPayableAmount(amount);
    if (functionParams instanceof Uint8Array) {
      txn.setFunctionParameters(functionParams);
    } else {
      txn.setFunction(functionName, functionParams);
    }
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

  public isInitializationPending = async () => {
    return await MirrorNodeService.getInstance().isInitializationPending(
      this.contractId
    );
  };

  public upgradeHederaService = async () => {
    const args = new ContractFunctionParameters().addAddress(this.htsAddress);
    this.execute(
      20_00_000,
      this.UPGRADE_HEDERA_SERVICE,
      clientsInfo.dexOwnerClient,
      args
    );
    console.log(`- Base#${this.UPGRADE_HEDERA_SERVICE}(): done\n`);
  };

  private getHederaServiceContractAddress(): string {
    return this.csDev.getContract(this.csDev.hederaServiceContractName).address;
  }

  private getConfigurationContractAddress(): string {
    return this.csDev.getContractWithProxy(this.csDev.configuration)
      .transparentProxyAddress!!;
  }

  protected async encodeFunctionData(
    contractName: string,
    functionName: string,
    data: any[]
  ) {
    const contractInterface = await new ContractMetadata().getContractInterface(
      contractName
    );
    const hex = contractInterface.encodeFunctionData(functionName, data);
    return { bytes: ethers.utils.arrayify(hex), hex };
  }
}
