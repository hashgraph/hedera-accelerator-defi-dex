import Base from "../Base";

import { Helper } from "../../../utils/Helper";
import { BigNumber } from "bignumber.js";
import { Deployment } from "../../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../../utils/ClientManagement";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";
import { ContractService } from "../../../deployment/service/ContractService";

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
      const proxyAdmin = clientsInfo.dexOwnerId.toSolidityAddress();
      const deployedItems = await deployment.deployContracts([
        ContractService.SAFE_FACTORY,
        ContractService.SAFE,
        ContractService.MULTI_SIG,
      ]);
      const gnosisFactory = deployedItems.get(ContractService.SAFE_FACTORY);
      const gnosisLogic = deployedItems.get(ContractService.SAFE);
      const multiSigDao = deployedItems.get(ContractService.MULTI_SIG);
      const args = new ContractFunctionParameters()
        .addAddress(proxyAdmin)
        .addAddress(multiSigDao.address)
        .addAddress(gnosisLogic.address)
        .addAddress(gnosisFactory.address)
        .addAddress(this.htsAddress);
      await this.execute(9_00_000, INITIALIZE, client, args);
      console.log(`- MultiSigDAOFactory#${INITIALIZE}(): done\n`);
      return;
    }
    console.log(`- MultiSigDAOFactory#${INITIALIZE}(): already done\n`);
  };

  createDAO = async (
    name: string,
    logoUrl: string,
    owners: string[],
    threshold: number,
    isPrivate: boolean,
    admin: string = clientsInfo.uiUserId.toSolidityAddress(),
    client: Client = clientsInfo.uiUserClient
  ) => {
    const params = {
      admin,
      name,
      logoUrl,
      owners: owners.toString(),
      threshold,
      isPrivate,
    };
    const args = new ContractFunctionParameters()
      .addAddress(admin)
      .addString(name)
      .addString(logoUrl)
      .addAddressArray(owners)
      .addUint256(BigNumber(threshold))
      .addBool(isPrivate);
    const { result } = await this.execute(7_00_000, CREATE_DAO, client, args);
    const address = result.getAddress(0);
    console.log(`- MultiSigDAOFactory#${CREATE_DAO}(): done`);
    console.table({
      ...params,
      daoAddress: address,
      daoFactoryId: this.contractId,
    });
    console.log("");
    return address;
  };

  getDAOs = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(1_00_000, GET_DAOS, client);
    const addresses = Helper.getAddressArray(result);
    console.log(
      `- MultiSigDAOFactory#${GET_DAOS}(): count = ${addresses.length}, dao's = [${addresses}]\n`
    );
    return addresses;
  };

  upgradeSafeLogicAddress = async (
    newImpl: string,
    client: Client = clientsInfo.dexOwnerClient
  ) => {
    const args = new ContractFunctionParameters().addAddress(newImpl);
    await this.execute(35_000, UPGRADE_SAFE_LOGIC_IMPL, client, args);
    console.log(`- MultiSigDAOFactory#${UPGRADE_SAFE_LOGIC_IMPL}(): done\n`);
  };

  upgradeSafeFactoryAddress = async (
    newImpl: string,
    client: Client = clientsInfo.dexOwnerClient
  ) => {
    const args = new ContractFunctionParameters().addAddress(newImpl);
    await this.execute(35_000, UPGRADE_SAFE_FACTORY_LOGIC_IMPL, client, args);
    console.log(
      `- MultiSigDAOFactory#${UPGRADE_SAFE_FACTORY_LOGIC_IMPL}(): done\n`
    );
  };

  upgradeDaoLogicAddress = async (
    newImpl: string,
    client: Client = clientsInfo.uiUserClient
  ) => {
    const args = new ContractFunctionParameters().addAddress(newImpl);
    await this.execute(35_000, UPGRADE_DAO_LOGIC_IMPL, client, args);
    console.log(`- MultiSigDAOFactory#${UPGRADE_DAO_LOGIC_IMPL}(): done\n`);
  };
}
