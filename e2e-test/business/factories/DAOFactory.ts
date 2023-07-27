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
import TokenHolderFactory from "./TokenHolderFactory";
import FTDAO from "../FTDAO";
import GodHolder from "../GodHolder";
import NFTHolder from "../NFTHolder";
import { AddressHelper } from "../../../utils/AddressHelper";

const deployment = new Deployment();

const GET_DAOS = "getDAOs";
const CREATE_DAO = "createDAO";
const INITIALIZE = "initialize";
const UPGRADE_TOKEN_HOLDER_FACTORY = "upgradeTokenHolderFactory";
const GET_TOKEN_HOLDER_FACTORY_ADDRESS = "getTokenHolderFactoryAddress";
const UPGRADE_TOKEN_DAO_LOGIC_IMPL = "upgradeFTDAOLogicImplementation";
const UPGRADE_GOVERNORS_IMPLEMENTATION = "upgradeGovernorsImplementation";

export default abstract class DAOFactory extends Base {
  protected abstract getPrefix(): string;

  initialize = async (
    client: Client = clientsInfo.operatorClient,
    tokenHolderFactory: TokenHolderFactory
  ) => {
    if (await this.isInitializationPending()) {
      const tokenHolderFactoryContractId = ContractId.fromString(
        tokenHolderFactory.contractId
      ).toSolidityAddress();
      const tokenHolderFactoryAddress = tokenHolderFactoryContractId;
      const deployedItems = await deployment.deployContracts([
        ContractService.FT_DAO,
        ContractService.GOVERNOR_TT,
        ContractService.GOVERNOR_TEXT,
        ContractService.GOVERNOR_UPGRADE,
        ContractService.GOVERNOR_TOKEN_CREATE,
      ]);
      const ftDao = deployedItems.get(ContractService.FT_DAO);

      const data = {
        _iSystemRoleBasedAccess: this.getSystemBasedRoleAccessContractAddress(),
        _hederaService: this.htsAddress,
        _daoLogic: ftDao.address,
        _tokenHolderFactory: tokenHolderFactoryAddress,
        _governors: Object.values({
          tokenTransferLogic: deployedItems.get(ContractService.GOVERNOR_TT)
            .address,
          textLogic: deployedItems.get(ContractService.GOVERNOR_TEXT).address,
          upgradeLogic: deployedItems.get(ContractService.GOVERNOR_UPGRADE)
            .address,
          createTokenLogic: deployedItems.get(
            ContractService.GOVERNOR_TOKEN_CREATE
          ).address,
        }),
      };

      const { bytes, hex } = await this.encodeFunctionData(
        ContractService.FT_DAO_FACTORY,
        INITIALIZE,
        Object.values(data)
      );

      await this.execute(800000, INITIALIZE, client, bytes);
      console.log(
        `- ${this.getPrefix()}DAOFactory#${INITIALIZE}(): done with hex-data = ${hex}\n`
      );
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
      tokenTransferLogic,
      textProposalLogic,
      contractUpgrade,
      tokenCreateLogic,
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

  public getTokenHolderFactoryAddress = async () => {
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

  public getGovernorTokenDaoInstance = async (daoProxyAddress: string) => {
    const contractId = await AddressHelper.addressToIdObject(daoProxyAddress);
    return new FTDAO(contractId);
  };

  protected abstract getTokenHolderInstance(
    tokenId: TokenId
  ): Promise<NFTHolder> | Promise<GodHolder>;
}
