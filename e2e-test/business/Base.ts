import ContractMetadata from "../../utils/ContractMetadata";

import { ethers } from "ethers";
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
  ContractId,
} from "@hashgraph/sdk";
import assert from "assert";

export default abstract class Base {
  protected csDev: ContractService = new ContractService();
  protected htsAddress: string;
  protected configuration: string;
  contractId: string;
  contractName: string;
  private UPGRADE_HEDERA_SERVICE = "upgradeHederaService";
  private OWNER = "owner";

  constructor(_contractId: ContractId | null = null) {
    this.htsAddress = this.getHederaServiceContractAddress();
    this.configuration = this.getConfigurationContractAddress();
    this.contractName = this.getContractName() ?? "Base";
    this.contractId = this.getLatestContractIdIfMissingInArgument(_contractId);
    this.printContractInformation();
  }

  protected getBusinessClassName = (): string => this.constructor.name;

  protected abstract getContractName(): string;

  private getLatestContractIdIfMissingInArgument = (
    _contractId: ContractId | null = null
  ): string => {
    const transparentProxyId =
      _contractId?.toString() ??
      this.csDev.getContractWithProxy(this.contractName).transparentProxyId;
    assert(transparentProxyId !== undefined, "Contract Id is must");
    return transparentProxyId;
  };

  private printContractInformation = () => {
    const businessClassName = this.getBusinessClassName();
    console.log(
      `\n Using business class[${businessClassName}], contract-id [${this.contractId}], and contract-name [${this.contractName}] \n`
    );
  };

  getCurrentImplementation = async (
    adminKey: PrivateKey = clientsInfo.proxyAdminKey,
    client: Client = clientsInfo.proxyAdminClient
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

  public upgradeHederaService = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addAddress(this.htsAddress);
    const { receipt } = await this.execute(
      20_00_000,
      this.UPGRADE_HEDERA_SERVICE,
      client,
      args
    );
    console.log(
      `- Base#${this.UPGRADE_HEDERA_SERVICE}(): tx status ${receipt.status}\n`
    );
  };

  public owner = async () => {
    const { result } = await this.execute(
      2_00_000,
      this.OWNER,
      clientsInfo.operatorClient
    );
    console.log(
      `- Base#${this.OWNER}(): owner address  ${result.getAddress(0)}\n`
    );
  };

  private getHederaServiceContractAddress(): string {
    return this.csDev.getContract(this.csDev.hederaServiceContractName).address;
  }

  private getConfigurationContractAddress(): string {
    return this.csDev.getContractWithProxy(this.csDev.configuration)
      .transparentProxyAddress!!;
  }

  protected getMultiSendContractAddress(): string {
    return this.csDev.getContract(ContractService.MULTI_SEND).address;
  }

  public async encodeFunctionData(
    contractName: string,
    functionName: string,
    data: any[]
  ): Promise<{ bytes: Uint8Array; hex: string }> {
    const contractInterface = await ContractMetadata.getContractInterface(
      contractName
    );
    const hex = contractInterface.encodeFunctionData(functionName, data);
    return { bytes: ethers.utils.arrayify(hex), hex };
  }

  protected async decodeFunctionResult(
    contractName: string,
    functionName: string,
    data: Uint8Array
  ) {
    const contractInterface = await ContractMetadata.getContractInterface(
      contractName
    );
    return contractInterface.decodeFunctionResult(functionName, data);
  }
}
