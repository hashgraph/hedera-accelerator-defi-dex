import FTDAO from "../FTDAO";
import GodHolder from "../GodHolder";
import NFTHolder from "../NFTHolder";
import FeeConfig from "../FeeConfig";
import TokenHolderFactory from "./TokenHolderFactory";

import { Helper } from "../../../utils/Helper";
import { Deployment } from "../../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../../utils/ClientManagement";
import { AddressHelper } from "../../../utils/AddressHelper";
import { ContractService } from "../../../deployment/service/ContractService";
import { FeeConfigDetails } from "../../../e2e-test/business/types";
import { DEFAULT_FEE_CONFIG } from "../../../e2e-test/business/constants";
import {
  Client,
  TokenId,
  ContractId,
  ContractFunctionParameters,
} from "@hashgraph/sdk";

const deployment = new Deployment();

const GET_DAOS = "getDAOs";
const CREATE_DAO = "createDAO";
const INITIALIZE = "initialize";
const UPGRADE_TOKEN_HOLDER_FACTORY = "upgradeTokenHolderFactory";
const GET_TOKEN_HOLDER_FACTORY_ADDRESS = "getTokenHolderFactoryAddress";

export default abstract class DAOFactory extends FeeConfig {
  protected abstract getPrefix(): string;

  initialize = async (
    client: Client = clientsInfo.operatorClient,
    tokenHolderFactory: TokenHolderFactory,
    feeConfigDetails: FeeConfigDetails = DEFAULT_FEE_CONFIG,
  ) => {
    if (await this.isInitializationPending()) {
      const tokenHolderFactoryAddress = ContractId.fromString(
        tokenHolderFactory.contractId,
      ).toSolidityAddress();
      const deployedItems = await deployment.deployContracts([
        ContractService.FT_DAO,
        ContractService.ASSET_HOLDER,
        ContractService.HEDERA_GOVERNOR,
      ]);
      const ftDao = deployedItems.get(ContractService.FT_DAO);
      const governor = deployedItems.get(ContractService.HEDERA_GOVERNOR);
      const assetsHolder = deployedItems.get(ContractService.ASSET_HOLDER);

      const data = {
        _daoLogic: ftDao.address,
        _governorLogic: governor.address,
        _assetsHolderLogic: assetsHolder.address,
        _hederaService: this.htsAddress,
        _feeConfigDetails: feeConfigDetails,
        _tokenHolderFactory: tokenHolderFactoryAddress,
        _iSystemRoleBasedAccess: this.getSystemBasedRoleAccessContractAddress(),
      };

      const { bytes } = await this.encodeFunctionData(
        ContractService.FT_DAO_FACTORY,
        INITIALIZE,
        Object.values(data),
      );

      await this.execute(7_00_000, INITIALIZE, client, bytes);
      console.log(`- ${this.getPrefix()}DAOFactory#${INITIALIZE}(): done\n`);
      console.table(data);
      console.log();
      return;
    }
    console.log(
      `- ${this.getPrefix()}DAOFactory#${INITIALIZE}(): already done\n`,
    );
  };

  public createDAO = async (
    name: string,
    logoUrl: string,
    infoUrl: string,
    desc: string,
    webLinks: string[],
    tokenAddress: string,
    quorumThreshold: number,
    votingDelay: number,
    votingPeriod: number,
    isPrivate: boolean,
    proposalFeeConfig: FeeConfigDetails,
    daoCreationFeeInHBar: number,
    admin: string,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const params = {
      admin,
      name,
      logoUrl,
      infoUrl,
      tokenAddress,
      quorumThreshold,
      votingDelay,
      votingPeriod,
      isPrivate,
      desc,
      webLinks,
      feeConfig: Object.values(proposalFeeConfig),
    };
    const { bytes, hex } = await this.encodeFunctionData(
      ContractService.FT_DAO_FACTORY,
      CREATE_DAO,
      [Object.values(params)],
    );
    const { result, record } = await this.execute(
      9_000_000,
      CREATE_DAO,
      client,
      bytes,
      undefined,
      daoCreationFeeInHBar,
    );
    const tokenHolderAddress = result.getAddress(0);
    const assetsHolderAddress = result.getAddress(1);
    const governorAddress = result.getAddress(2);
    const daoAddress = result.getAddress(3);
    console.log(
      `- ${this.getPrefix()}DAOFactory#${CREATE_DAO}(): with input data = ${hex}`,
    );
    console.table({
      ...params,
      webLinks: webLinks.toString(),
      daoAddress,
      tokenHolderAddress,
      assetsHolderAddress,
      governorAddress,
      daoFactoryId: this.contractId,
      txnId: record.transactionId.toString(),
    });
    return {
      tokenHolderAddress,
      assetsHolderAddress,
      governorAddress,
      daoAddress,
    };
  };

  public getDAOs = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(1_000_000, GET_DAOS, client);
    const addresses = Helper.getAddressArray(result);
    console.log(
      `- ${this.getPrefix()}DAOFactory#${GET_DAOS}(): count = ${
        addresses.length
      }, dao's = [${addresses}]\n`,
    );
    return addresses;
  };

  public upgradeTokenHolderFactory = async (_newImpl: string) => {
    const args = new ContractFunctionParameters().addAddress(_newImpl);
    await this.execute(
      200000,
      UPGRADE_TOKEN_HOLDER_FACTORY,
      clientsInfo.childProxyAdminClient,
      args,
    );
    console.log(
      `- ${this.getPrefix()}DAOFactory#${UPGRADE_TOKEN_HOLDER_FACTORY}(): done\n`,
    );
  };

  public getTokenHolderFactoryAddress = async () => {
    const { result } = await this.execute(
      200000,
      GET_TOKEN_HOLDER_FACTORY_ADDRESS,
      clientsInfo.childProxyAdminClient,
    );
    const address = result.getAddress(0);
    console.log(
      `- ${this.getPrefix()}DAOFactory#${GET_TOKEN_HOLDER_FACTORY_ADDRESS}(): address = ${address}\n`,
    );
    return ContractId.fromSolidityAddress(address);
  };

  public getGovernorTokenDaoInstance = async (daoProxyAddress: string) => {
    const contractId = await AddressHelper.addressToIdObject(daoProxyAddress);
    return new FTDAO(contractId);
  };

  protected abstract getTokenHolderInstance(
    tokenId: TokenId,
  ): Promise<NFTHolder> | Promise<GodHolder>;
}
