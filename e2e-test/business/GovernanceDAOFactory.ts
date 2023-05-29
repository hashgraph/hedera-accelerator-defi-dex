import Base from "./Base";

import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { Client, ContractId, ContractFunctionParameters } from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";

import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";
import GovernorTokenDao from "../../e2e-test/business/GovernorTokenDao";
import GODTokenHolderFactory from "../../e2e-test/business/GODTokenHolderFactory";

const deployment = new Deployment();
const csDev = new ContractService();

const INITIALIZE = "initialize";
const CREATE_DAO = "createDAO";
const GET_DAOS = "getDAOs";
const UPGRADE_GOVERNOR_TOKEN_DAO_LOGIC_IMPL =
  "upgradeTokenDaoLogicImplementation";

const UPGRADE_GOVERNOR_TOKEN_TRANSFER_LOGIC_IMPL =
  "upgradeTokenTransferLogicImplementation";

const UPGRADE_GOD_TOKEN_HOLDER_FACTORY = "upgradeTokenHolderFactory";

const GET_GOD_TOKEN_HOLDER_FACTORY_ADDRESS = "getTokenHolderFactoryAddress";

export default class GovernanceDAOFactory extends Base {
  initialize = async (client: Client = clientsInfo.operatorClient) => {
    if (await this.isInitializationPending()) {
      const proxyAdmin = clientsInfo.dexOwnerId.toSolidityAddress();
      const godHolderFactoryAddress = csDev.getContractWithProxy(
        csDev.godTokenHolderFactory
      ).transparentProxyAddress!;
      const deployedItems = await deployment.deployContracts([
        csDev.governorTokenDao,
        csDev.governorTTContractName,
      ]);
      const governorTokenDao = deployedItems.get(csDev.governorTokenDao);
      const governorTT = deployedItems.get(csDev.governorTTContractName);
      const args = new ContractFunctionParameters()
        .addAddress(proxyAdmin)
        .addAddress(this.htsAddress)
        .addAddress(governorTokenDao.address)
        .addAddress(godHolderFactoryAddress)
        .addAddress(governorTT.address);
      await this.execute(8_00_000, INITIALIZE, client, args);
      console.log(`- GovernanceDAOFactory#${INITIALIZE}(): done\n`);
      return;
    }
    console.log(`- GovernanceDAOFactory#${INITIALIZE}(): already done\n`);
  };

  createDAO = async (
    name: string,
    logoUrl: string,
    desc: string,
    webLinks: string[],
    tokenAddress: string,
    quorumThreshold: number,
    votingDelay: number,
    votingPeriod: number,
    isPrivate: boolean,
    admin: string = clientsInfo.operatorId.toSolidityAddress(),
    client: Client = clientsInfo.operatorClient
  ) => {
    const createDAOInputs = {
      admin,
      name,
      logoUrl,
      tokenAddress,
      quorumThreshold,
      votingDelay,
      votingPeriod,
      isPrivate,
      desc,
      webLinks,
    };
    const { bytes, hex } = await this.encodeFunctionData(
      ContractService.FT_DAO_FACTORY,
      CREATE_DAO,
      [Object.values(createDAOInputs)]
    );
    const { result, record } = await this.execute(
      3_500_000,
      CREATE_DAO,
      client,
      bytes
    );
    const address = result.getAddress(0);
    console.log(
      `- GovernanceDAOFactory#${CREATE_DAO}(): with input data = ${hex}`
    );
    console.table({
      ...createDAOInputs,
      webLinks: webLinks.toString(),
      daoAddress: address,
      daoFactoryId: this.contractId,
      txnId: record.transactionId.toString(),
    });
    return address;
  };

  getDAOs = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(4_00_000, GET_DAOS, client);
    const addresses = Helper.getAddressArray(result);
    console.log(
      `- GovernanceDAOFactory#${GET_DAOS}(): count = ${addresses.length}, dao's = [${addresses}]\n`
    );
    return addresses;
  };

  upgradeGovernorTokenTransferLogicImplementation = async (
    _newImpl: string
  ) => {
    const args = new ContractFunctionParameters().addAddress(_newImpl);
    await this.execute(
      2_00_000,
      UPGRADE_GOVERNOR_TOKEN_TRANSFER_LOGIC_IMPL,
      clientsInfo.dexOwnerClient,
      args
    );
    console.log(
      `- GovernanceDAOFactory#${UPGRADE_GOVERNOR_TOKEN_TRANSFER_LOGIC_IMPL}(): done\n`
    );
  };

  upgradeGovernorTokenDaoLogicImplementation = async (_newImpl: string) => {
    const args = new ContractFunctionParameters().addAddress(_newImpl);
    await this.execute(
      2_00_000,
      UPGRADE_GOVERNOR_TOKEN_DAO_LOGIC_IMPL,
      clientsInfo.dexOwnerClient,
      args
    );
    console.log(
      `- GovernanceDAOFactory#${UPGRADE_GOVERNOR_TOKEN_DAO_LOGIC_IMPL}(): done\n`
    );
  };

  upgradeGODTokenHolderFactory = async (_newImpl: string) => {
    const args = new ContractFunctionParameters().addAddress(_newImpl);
    await this.execute(
      2_00_000,
      UPGRADE_GOD_TOKEN_HOLDER_FACTORY,
      clientsInfo.dexOwnerClient,
      args
    );
    console.log(
      `- GovernanceDAOFactory#${UPGRADE_GOD_TOKEN_HOLDER_FACTORY}(): done\n`
    );
  };

  getGODTokenHolderFactoryAddress = async () => {
    const { result } = await this.execute(
      2_00_000,
      GET_GOD_TOKEN_HOLDER_FACTORY_ADDRESS,
      clientsInfo.dexOwnerClient
    );
    const address = result.getAddress(0);
    console.log(
      `- GovernanceDAOFactory#${GET_GOD_TOKEN_HOLDER_FACTORY_ADDRESS}(): address = ${address}\n`
    );
    return ContractId.fromSolidityAddress(address);
  };

  getGovernorTokenDaoInstance = (daoProxyAddress: string) => {
    const governorTokenDaoProxyId =
      ContractId.fromSolidityAddress(daoProxyAddress).toString();
    return new GovernorTokenDao(governorTokenDaoProxyId);
  };

  getGovernorTokenTransferInstance = async (
    governorTokenDao: GovernorTokenDao
  ) => {
    const governorTokenTransferProxyContractId =
      await governorTokenDao.getGovernorTokenTransferContractAddress();
    return new Governor(governorTokenTransferProxyContractId.toString());
  };

  getGodHolderInstance = async (governor: Governor) => {
    const godTokenHolderFactoryProxyContractId =
      await this.getGODTokenHolderFactoryAddress();
    const godHolderFactory = new GODTokenHolderFactory(
      godTokenHolderFactoryProxyContractId.toString()
    );
    const godTokenId = await governor.getGODTokenAddress();
    const godTokenAddress = godTokenId.toSolidityAddress();
    const godHolderProxyContractId = await godHolderFactory.getTokenHolder(
      godTokenAddress
    );
    return new GodHolder(godHolderProxyContractId.toString());
  };
}
