import Base from "../Base";

import { Helper } from "../../../utils/Helper";
import { BigNumber } from "bignumber.js";
import { Deployment } from "../../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../../utils/ClientManagement";
import { Client, ContractId, ContractFunctionParameters } from "@hashgraph/sdk";
import { ContractService } from "../../../deployment/service/ContractService";
import { InstanceProvider } from "../../../utils/InstanceProvider";

import Governor from "../../../e2e-test/business/Governor";
import GovernorTokenDao from "../../../e2e-test/business/GovernorTokenDao";

const deployment = new Deployment();
const csDev = new ContractService();

const GET_DAOS = "getDAOs";
const CREATE_DAO = "createDAO";
const INITIALIZE = "initialize";
const UPGRADE_TOKEN_HOLDER_FACTORY = "upgradeTokenHolderFactory";
const GET_TOKEN_HOLDER_FACTORY_ADDRESS = "getTokenHolderFactoryAddress";
const UPGRADE_TOKEN_DAO_LOGIC_IMPL = "upgradeTokenDaoLogicImplementation";
const UPGRADE_GOVERNOR_TOKEN_TRANSFER_LOGIC_IMPL =
  "upgradeTokenTransferLogicImplementation";

export default class DAOFactory extends Base {
  private _isNFTType: Boolean;
  private _provider = InstanceProvider.getInstance();

  constructor(contractId: string, isNFTType: Boolean) {
    super(contractId);
    this._isNFTType = isNFTType;
  }

  private getDAOFactoryAddress() {
    const factoryName = this._isNFTType
      ? ContractService.NFT_DAO_FACTORY
      : ContractService.FT_DAO_FACTORY;
    return csDev.getContractWithProxy(factoryName).transparentProxyAddress!;
  }

  private getPrefix() {
    return this._isNFTType ? "NF" : "F";
  }

  initialize = async (client: Client = clientsInfo.operatorClient) => {
    if (await this.isInitializationPending()) {
      const proxyAdmin = clientsInfo.dexOwnerId.toSolidityAddress();
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
        .addAddress(this.getDAOFactoryAddress())
        .addAddress(governorTT.address);
      await this.execute(800000, INITIALIZE, client, args);
      console.log(`- ${this.getPrefix()}DAOFactory#${INITIALIZE}(): done\n`);
      return;
    }
    console.log(
      `- ${this.getPrefix()}DAOFactory#${INITIALIZE}(): already done\n`
    );
  };

  createDAO = async (
    name: string,
    logoUrl: string,
    tokenAddress: string,
    quorumThreshold: number,
    votingDelay: number,
    votingPeriod: number,
    isPrivate: boolean,
    admin: string = clientsInfo.uiUserId.toSolidityAddress(),
    client: Client = clientsInfo.uiUserClient
  ) => {
    const params = {
      admin,
      name,
      tokenAddress,
      quorumThreshold,
      votingDelay,
      votingPeriod,
      isPrivate,
    };
    const args = new ContractFunctionParameters()
      .addAddress(admin)
      .addString(name)
      .addString(logoUrl)
      .addAddress(tokenAddress)
      .addUint256(BigNumber(quorumThreshold))
      .addUint256(BigNumber(votingDelay))
      .addUint256(BigNumber(votingPeriod))
      .addBool(isPrivate);
    const { result } = await this.execute(9000000, CREATE_DAO, client, args);
    const address = result.getAddress(0);
    console.log(`- ${this.getPrefix()}DAOFactory#${CREATE_DAO}(): done`);
    console.table({
      ...params,
      daoAddress: address,
      daoFactoryId: this.contractId,
    });
    return address;
  };

  getDAOs = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(9999999, GET_DAOS, client);
    const addresses = Helper.getAddressArray(result);
    console.log(
      `- ${this.getPrefix()}DAOFactory#${GET_DAOS}(): count = ${
        addresses.length
      }, dao's = [${addresses}]\n`
    );
    return addresses;
  };

  upgradeGovernorTokenTransferLogicImplementation = async (
    _newImpl: string
  ) => {
    const args = new ContractFunctionParameters().addAddress(_newImpl);
    await this.execute(
      200000,
      UPGRADE_GOVERNOR_TOKEN_TRANSFER_LOGIC_IMPL,
      clientsInfo.dexOwnerClient,
      args
    );
    console.log(
      `- ${this.getPrefix()}DAOFactory#${UPGRADE_GOVERNOR_TOKEN_TRANSFER_LOGIC_IMPL}(): done\n`
    );
  };

  upgradeTokenDaoLogicImplementation = async (_newImpl: string) => {
    const args = new ContractFunctionParameters().addAddress(_newImpl);
    await this.execute(
      200000,
      UPGRADE_TOKEN_DAO_LOGIC_IMPL,
      clientsInfo.dexOwnerClient,
      args
    );
    console.log(
      `- ${this.getPrefix()}DAOFactory#${UPGRADE_TOKEN_DAO_LOGIC_IMPL}(): done\n`
    );
  };

  upgradeTokenHolderFactory = async (_newImpl: string) => {
    const args = new ContractFunctionParameters().addAddress(_newImpl);
    await this.execute(
      200000,
      UPGRADE_TOKEN_HOLDER_FACTORY,
      clientsInfo.dexOwnerClient,
      args
    );
    console.log(
      `- ${this.getPrefix()}DAOFactory#${UPGRADE_TOKEN_HOLDER_FACTORY}(): done\n`
    );
  };

  getTokenHolderFactoryAddress = async () => {
    const { result } = await this.execute(
      200000,
      GET_TOKEN_HOLDER_FACTORY_ADDRESS,
      clientsInfo.dexOwnerClient
    );
    const address = result.getAddress(0);
    console.log(
      `- ${this.getPrefix()}DAOFactory#${GET_TOKEN_HOLDER_FACTORY_ADDRESS}(): address = ${address}\n`
    );
    return ContractId.fromSolidityAddress(address);
  };

  getGovernorTokenDaoInstance = (daoProxyAddress: string) => {
    const governorTokenDaoProxyId =
      ContractId.fromSolidityAddress(daoProxyAddress).toString();
    return this._provider.getGovernorTokenDao(governorTokenDaoProxyId);
  };

  getGovernorTokenTransferInstance = async (
    governorTokenDao: GovernorTokenDao
  ) => {
    const governorTTId =
      await governorTokenDao.getGovernorTokenTransferContractAddress();
    return this._provider.getGovernor("", governorTTId.toString());
  };

  getTokenHolderInstance = async (governor: Governor) => {
    const tokenId = await governor.getGODTokenAddress();
    const tokenAddress = tokenId.toSolidityAddress();
    const factoryProxyId = (
      await this.getTokenHolderFactoryAddress()
    ).toString();

    const holderFactory = this._isNFTType
      ? this._provider.getNonFungibleTokenHolderFactory(factoryProxyId)
      : this._provider.getFungibleTokenHolderFactory(factoryProxyId);
    const tokenHolderProxyId = await holderFactory.getTokenHolder(tokenAddress);

    return this._isNFTType
      ? this._provider.getNonFungibleTokenHolder(tokenHolderProxyId.toString())
      : this._provider.getFungibleTokenHolder(tokenHolderProxyId.toString());
  };
}
