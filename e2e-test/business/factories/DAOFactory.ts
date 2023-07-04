import Base from "../Base";

import { Helper } from "../../../utils/Helper";
import { Deployment } from "../../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../../utils/ClientManagement";
import {
  Client,
  ContractId,
  ContractFunctionParameters,
  TokenId,
} from "@hashgraph/sdk";
import { ContractService } from "../../../deployment/service/ContractService";
import { InstanceProvider } from "../../../utils/InstanceProvider";
import TokenHolderFactory from "./TokenHolderFactory";

const deployment = new Deployment();
const csDev = new ContractService();

const GET_DAOS = "getDAOs";
const CREATE_DAO = "createDAO";
const INITIALIZE = "initialize";
const UPGRADE_TOKEN_HOLDER_FACTORY = "upgradeTokenHolderFactory";
const GET_TOKEN_HOLDER_FACTORY_ADDRESS = "getTokenHolderFactoryAddress";
const UPGRADE_TOKEN_DAO_LOGIC_IMPL = "upgradeFTDAOLogicImplementation";
const UPGRADE_GOVERNORS_IMPLEMENTATION = "upgradeGovernorsImplementation";

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

  initialize = async (
    client: Client = clientsInfo.operatorClient,
    tokenHolderFactory: TokenHolderFactory
  ) => {
    if (await this.isInitializationPending()) {
      const tokenHolderFactoryContractId = ContractId.fromString(
        tokenHolderFactory.contractId
      ).toSolidityAddress();
      const tokenHolderFactoryAddress = tokenHolderFactoryContractId;
      const proxyAdmin = clientsInfo.childProxyAdminId.toSolidityAddress();
      const deployedItems = await deployment.deployContracts([
        ContractService.FT_DAO,
      ]);
      const ftDao = deployedItems.get(ContractService.FT_DAO);

      const governance = {
        tokenTransferLogic: csDev.getContract(ContractService.GOVERNOR_TT)
          .address,
        textLogic: csDev.getContract(ContractService.GOVERNOR_TEXT).address,
        upgradeLogic: csDev.getContract(ContractService.GOVERNOR_UPGRADE)
          .address,
        createTokenLogic: csDev.getContract(
          ContractService.GOVERNOR_TOKEN_CREATE
        ).address,
      };

      const { bytes } = await this.encodeFunctionData(
        ContractService.FT_DAO_FACTORY,
        INITIALIZE,
        [
          proxyAdmin,
          this.htsAddress,
          ftDao.address,
          tokenHolderFactoryAddress,
          Object.values(governance),
        ]
      );

      await this.execute(800000, INITIALIZE, client, bytes);
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
    admin: string = clientsInfo.operatorId.toSolidityAddress(),
    client: Client = clientsInfo.operatorClient
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
      8_500_000,
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

  upgradeGovernorsImplementation = async (
    tokenTransferLogic: string,
    tokenCreateLogic: string,
    textProposalLogic: string,
    contractUpgrade: string
  ) => {
    const args = {
      tokenTransferLogic: tokenTransferLogic,
      tokenCreateLogic: tokenCreateLogic,
      textProposalLogic: textProposalLogic,
      contractUpgrade: contractUpgrade,
    };

    const { bytes } = await this.encodeFunctionData(
      ContractService.FT_DAO_FACTORY,
      UPGRADE_GOVERNORS_IMPLEMENTATION,
      [Object.values(args)]
    );

    const { receipt } = await this.execute(
      2_00_000,
      UPGRADE_GOVERNORS_IMPLEMENTATION,
      clientsInfo.childProxyAdminClient,
      bytes
    );

    console.log(
      `- ${this.getPrefix()}DAOFactory#${UPGRADE_GOVERNORS_IMPLEMENTATION}(): tx status ${
        receipt.status
      }\n`
    );
  };

  upgradeFTDAOLogicImplementation = async (_newImpl: string) => {
    const args = new ContractFunctionParameters().addAddress(_newImpl);
    await this.execute(
      200000,
      UPGRADE_TOKEN_DAO_LOGIC_IMPL,
      clientsInfo.childProxyAdminClient,
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
      clientsInfo.childProxyAdminClient,
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
      clientsInfo.childProxyAdminClient
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

  getTokenHolderInstance = async (tokenId: TokenId) => {
    const factoryProxyId = (
      await this.getTokenHolderFactoryAddress()
    ).toString();

    return await (this._isNFTType
      ? this._provider.getNFTTokenHolderFromFactory(tokenId, factoryProxyId)
      : this._provider.getGODTokenHolderFromFactory(tokenId, factoryProxyId));
  };
}
