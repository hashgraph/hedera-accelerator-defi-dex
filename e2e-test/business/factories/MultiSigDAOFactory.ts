import Base from "../Base";

import { Helper } from "../../../utils/Helper";
import { Deployment } from "../../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../../utils/ClientManagement";
import {
  Client,
  ContractFunctionParameters,
  ContractFunctionResult,
} from "@hashgraph/sdk";
import { ContractService } from "../../../deployment/service/ContractService";
import { MirrorNodeService } from "../../../utils/MirrorNodeService";

const deployment = new Deployment();

const GET_DAOS = "getDAOs";
const CREATE_DAO = "createDAO";
const INITIALIZE = "initialize";
const UPGRADE_SAFE_LOGIC_IMPL = "upgradeSafeLogicAddress";
const UPGRADE_DAO_LOGIC_IMPL = "upgradeDaoLogicAddress";
const UPGRADE_SAFE_FACTORY_LOGIC_IMPL = "upgradeSafeFactoryAddress";

export default class MultiSigDAOFactory extends Base {
  initialize = async (client: Client = clientsInfo.operatorClient) => {
    if (await this.isInitializationPending()) {
      const deployedItems = await deployment.deployContracts([
        ContractService.SAFE_FACTORY,
        ContractService.SAFE,
        ContractService.MULTI_SIG,
      ]);
      const gnosisFactory = deployedItems.get(ContractService.SAFE_FACTORY);
      const gnosisLogic = deployedItems.get(ContractService.SAFE);
      const multiSigDao = deployedItems.get(ContractService.MULTI_SIG);
      const data = {
        _systemUsers: this.getSystemUsersAddressArray(),
        _daoLogic: multiSigDao.address,
        _safeLogic: gnosisLogic.address,
        _safeFactory: gnosisFactory.address,
        _hederaService: this.htsAddress,
        _multiSend: this.getMultiSendContractAddress(),
      };
      const { bytes, hex } = await this.encodeFunctionData(
        ContractService.MULTI_SIG_FACTORY,
        INITIALIZE,
        Object.values(data)
      );
      await this.execute(9_00_000, INITIALIZE, client, bytes);
      console.log(
        `- MultiSigDAOFactory#${INITIALIZE}(): ${this.contractId} done with data = ${hex}\n`
      );
      return;
    }
    console.log(
      `- MultiSigDAOFactory#${INITIALIZE}(): ${this.contractId} already done\n`
    );
  };

  protected getContractName() {
    return ContractService.MULTI_SIG_FACTORY;
  }

  createDAO = async (
    name: string,
    logoUrl: string,
    desc: string,
    webLinks: string[],
    owners: string[],
    threshold: number,
    isPrivate: boolean,
    admin: string = clientsInfo.uiUserId.toSolidityAddress(),
    client: Client = clientsInfo.uiUserClient
  ) => {
    const createDAOInputs = {
      admin,
      name,
      logoUrl,
      owners,
      threshold,
      isPrivate,
      desc,
      webLinks,
    };
    const { hex, bytes } = await this.encodeFunctionData(
      ContractService.MULTI_SIG_FACTORY,
      CREATE_DAO,
      [Object.values(createDAOInputs)]
    );
    const { result, record } = await this.execute(
      70_00_000,
      CREATE_DAO,
      client,
      bytes
    );
    const address = result.getAddress(0);
    console.log(
      `- MultiSigDAOFactory#${CREATE_DAO}(): where input data = ${hex}`
    );
    console.table({
      ...createDAOInputs,
      owners: owners.toString(),
      webLinks: webLinks.toString(),
      daoAddress: address,
      daoFactoryId: this.contractId,
      txnId: record.transactionId.toString(),
    });
    console.log("");
    return address;
  };

  getDAOs = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(2_00_000, GET_DAOS, client);
    const addresses = Helper.getAddressArray(result);
    console.log(
      `- MultiSigDAOFactory#${GET_DAOS}(): count = ${addresses.length}, dao's = [${addresses}]\n`
    );
    return addresses;
  };

  upgradeSafeLogicAddress = async (
    newImpl: string,
    client: Client = clientsInfo.childProxyAdminClient
  ) => {
    const args = new ContractFunctionParameters().addAddress(newImpl);
    const { result } = await this.execute(
      90_000,
      UPGRADE_SAFE_LOGIC_IMPL,
      client,
      args
    );
    console.log(`- MultiSigDAOFactory#${UPGRADE_SAFE_LOGIC_IMPL}(): done\n`);
    return this.readEventData(result);
  };

  upgradeSafeFactoryAddress = async (
    newImpl: string,
    client: Client = clientsInfo.childProxyAdminClient
  ) => {
    const args = new ContractFunctionParameters().addAddress(newImpl);
    const { result } = await this.execute(
      90_000,
      UPGRADE_SAFE_FACTORY_LOGIC_IMPL,
      client,
      args
    );
    console.log(
      `- MultiSigDAOFactory#${UPGRADE_SAFE_FACTORY_LOGIC_IMPL}(): done\n`
    );
    return this.readEventData(result);
  };

  upgradeDaoLogicAddress = async (
    newImpl: string,
    client: Client = clientsInfo.childProxyAdminClient
  ) => {
    const args = new ContractFunctionParameters().addAddress(newImpl);
    const { result } = await this.execute(
      90_000,
      UPGRADE_DAO_LOGIC_IMPL,
      client,
      args
    );
    console.log(`- MultiSigDAOFactory#${UPGRADE_DAO_LOGIC_IMPL}(): done\n`);
    return this.readEventData(result);
  };

  readEventData = async (result: ContractFunctionResult) => {
    const map = await MirrorNodeService.getInstance().decodeLog(result.logs);
    return map.get("LogicUpdated")![0];
  };
}
