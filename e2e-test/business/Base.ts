import dex from "../../deployment/model/dex";
import ContractMetadata from "../../utils/ContractMetadata";

import { ethers } from "ethers";
import { Helper } from "../../utils/Helper";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { MirrorNodeService } from "../../utils/MirrorNodeService";
import {
  Client,
  AccountId,
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
  private GET_ROLE_ADMIN = "getRoleAdmin";
  private HAS_ROLE = "hasRole";
  private GRANT_ROLE = "grantRole";
  private REVOKE_ROLE = "revokeRole";
  private IMPLEMENTATION = "implementation";

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

  public getRoleAdmin = async (
    role: Uint8Array,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addBytes32(role);
    const { result } = await this.execute(
      2_00_000,
      this.GET_ROLE_ADMIN,
      client,
      args
    );
    const roleInfo = this.getRoleInfo(role);
    const roleAdminHex = ethers.utils.hexlify(result.getBytes32(0));
    console.log(
      `- Base#${this.GET_ROLE_ADMIN}(): done ${roleInfo}, roleAdmin = ${roleAdminHex}\n`
    );
  };

  public hasRole = async (
    role: Uint8Array,
    accountId: AccountId,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addBytes32(role)
      .addAddress(accountId.toSolidityAddress());
    const { result } = await this.execute(
      5_00_000,
      this.HAS_ROLE,
      client,
      args
    );
    const roleInfo = this.getRoleInfo(role);
    const hasRoleHex = ethers.utils.hexlify(result.asBytes());
    const hasRole = result.getBool(0);
    console.log(
      `- Base#${this.HAS_ROLE}(): done ${roleInfo}, hasRole = ${hasRole}, hasRoleHex = ${hasRoleHex}\n`
    );
    return hasRole;
  };

  public grantRole = async (
    role: Uint8Array,
    accountId: AccountId,
    superAdminClient: Client
  ) => {
    const args = new ContractFunctionParameters()
      .addBytes32(role)
      .addAddress(accountId.toSolidityAddress());
    await this.execute(5_00_000, this.GRANT_ROLE, superAdminClient, args);
    const roleInfo = this.getRoleInfo(role);
    console.log(
      `- Base#${
        this.GRANT_ROLE
      }(): done ${roleInfo}, account = ${accountId.toString()}\n`
    );
  };

  public revokeRole = async (
    role: Uint8Array,
    accountId: AccountId,
    superAdminClient: Client
  ) => {
    const args = new ContractFunctionParameters()
      .addBytes32(role)
      .addAddress(accountId.toSolidityAddress());
    await this.execute(5_00_000, this.REVOKE_ROLE, superAdminClient, args);
    const roleInfo = this.getRoleInfo(role);
    console.log(
      `- Base#${
        this.REVOKE_ROLE
      }(): done ${roleInfo}, account = ${accountId.toString()}\n`
    );
  };

  getCurrentImplementation = async (
    adminKey: PrivateKey = clientsInfo.proxyAdminKey,
    client: Client = clientsInfo.proxyAdminClient
  ) => {
    const { result } = await this.execute(
      2000000,
      this.IMPLEMENTATION,
      client,
      undefined,
      adminKey
    );
    const impAddress = result.getAddress(0);
    console.log(
      `- Base#${this.IMPLEMENTATION}(): proxyId = ${this.contractId}, implementation =  ${impAddress}\n`
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

  public async checkIfChildProxyAdminRoleGiven(
    accountId: AccountId = clientsInfo.childProxyAdminId
  ) {
    await this.getRoleAdmin(dex.ROLES.CHILD_PROXY_ADMIN_ROLE);
    return await this.hasRole(dex.ROLES.CHILD_PROXY_ADMIN_ROLE, accountId);
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

  protected getSystemUsersAddressArray() {
    return Object.values({
      superAdmin: clientsInfo.operatorId.toSolidityAddress(),
      proxyAdmin: clientsInfo.proxyAdminId.toSolidityAddress(),
      childProxyAdmin: clientsInfo.childProxyAdminId.toSolidityAddress(),
    });
  }

  private getRoleInfo(role: Uint8Array) {
    const roleIndex = Object.values(dex.ROLES).findIndex(
      (eachRole: Uint8Array) => role === eachRole
    );
    if (roleIndex !== -1) {
      const roleName = Object.keys(dex.ROLES)[roleIndex];
      const roleHex = ethers.utils.hexlify(role);
      return `role = ${roleHex}, roleName = ${roleName}`;
    }
    return "FAILED TO FIND ROLE INFO";
  }
}
