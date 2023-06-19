import Base from "../Base";

import { Helper } from "../../../utils/Helper";
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
  "upgradeGovernorLogicImplementation";

export default class DAOFactory extends Base {
  private _isNFTType: Boolean;
  private _provider = InstanceProvider.getInstance();

  constructor(contractId: string, isNFTType: Boolean) {
    super(contractId);
    this._isNFTType = isNFTType;
  }

  private getTokenHolderFactoryAddressFromJson() {
    const holderFactoryName = this._isNFTType
      ? csDev.nftTokenHolderFactory
      : csDev.godTokenHolderFactory;
    return csDev.getContractWithProxy(holderFactoryName)
      .transparentProxyAddress!;
  }

  private getPrefix() {
    return this._isNFTType ? "NFT" : "GOD";
  }

  initialize = async (client: Client = clientsInfo.operatorClient) => {
    if (await this.isInitializationPending()) {
      const proxyAdmin = clientsInfo.dexOwnerId.toSolidityAddress();
      const deployedItems = await deployment.deployContracts([
        csDev.tokenTransferDAO,
        csDev.governorTTContractName,
      ]);
      const tokenTransferDAO = deployedItems.get(csDev.tokenTransferDAO);
      const governorTT = deployedItems.get(csDev.governorTTContractName);
      const args = new ContractFunctionParameters()
        .addAddress(proxyAdmin)
        .addAddress(this.htsAddress)
        .addAddress(tokenTransferDAO.address)
        .addAddress(this.getTokenHolderFactoryAddressFromJson())
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
    desc: string,
    webLinks: string[],
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
      [Object.values(params)]
    );
    const { result, record } = await this.execute(
      3_500_000,
      CREATE_DAO,
      client,
      bytes
    );
    const address = result.getAddress(0);
    console.log(
      `- ${this.getPrefix()}DAOFactory#${CREATE_DAO}(): with input data = ${hex}`
    );
    console.table({
      ...params,
      webLinks: webLinks.toString(),
      daoAddress: address,
      daoFactoryId: this.contractId,
      txnId: record.transactionId.toString(),
    });
    return address;
  };

  getDAOs = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(1_000_000, GET_DAOS, client);
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
    const tokenTransferDAOProxyId =
      ContractId.fromSolidityAddress(daoProxyAddress).toString();
    return this._provider.getGovernorTokenDao(tokenTransferDAOProxyId);
  };

  getGovernorTokenTransferInstance = async (
    tokenTransferDAO: GovernorTokenDao
  ) => {
    const governorTTId =
      await tokenTransferDAO.getGovernorTokenTransferContractAddress();
    return this._provider.getGovernor("", governorTTId.toString());
  };

  getTokenHolderInstance = async (governor: Governor) => {
    const tokenId = await governor.getGODTokenAddress();
    const factoryProxyId = (
      await this.getTokenHolderFactoryAddress()
    ).toString();

    return await (this._isNFTType
      ? this._provider.getNFTTokenHolderFromFactory(tokenId, factoryProxyId)
      : this._provider.getGODTokenHolderFromFactory(tokenId, factoryProxyId));
  };
}
