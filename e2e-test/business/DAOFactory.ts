import Base from "./Base";

import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { Client, ContractId, ContractFunctionParameters } from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";
import { InstanceProvider } from "../../utils/InstanceProvider";

import Governor from "../../e2e-test/business/Governor";
import GovernorTokenDao from "../../e2e-test/business/GovernorTokenDao";
import { TokenId } from "@hashgraph/sdk/lib/transaction/TransactionRecord";

const deployment = new Deployment();
const csDev = new ContractService();

const INITIALIZE = "initialize";
const CREATE_DAO = "createDAO";
const GET_DAOS = "getDAOs";
const UPGRADE_GOVERNORS_IMPLEMENTATION = "upgradeGovernorsImplementation";

const UPGRADE_GOD_TOKEN_HOLDER_FACTORY = "upgradeTokenHolderFactory";

const GET_GOD_TOKEN_HOLDER_FACTORY_ADDRESS = "getTokenHolderFactoryAddress";

export default class DAOFactory extends Base {
  initialize = async (client: Client = clientsInfo.operatorClient) => {
    if (await this.isInitializationPending()) {
      const contractService = new ContractService();
      const proxyAdmin = clientsInfo.dexOwnerId.toSolidityAddress();
      const godHolderFactoryAddress = csDev.getContractWithProxy(
        csDev.godTokenHolderFactory
      ).transparentProxyAddress!;
      const deployedItems = await deployment.deployContracts([
        csDev.tokenTransferDAO,
      ]);
      const tokenTransferDAO = deployedItems.get(csDev.tokenTransferDAO);

      const governance = {
        tokenTransferLogic: contractService.getContract(
          ContractService.GOVERNOR_TT
        ).address,
        textLogic: contractService.getContract(ContractService.GOVERNOR_TEXT)
          .address,
        upgradeLogic: contractService.getContract(
          ContractService.GOVERNOR_UPGRADE
        ).address,
        createTokenLogic: contractService.getContract(
          ContractService.GOVERNOR_TOKEN_CREATE
        ).address,
      };

      const { bytes } = await this.encodeFunctionData(
        ContractService.FT_DAO_FACTORY,
        INITIALIZE,
        [
          proxyAdmin,
          this.htsAddress,
          tokenTransferDAO.address,
          godHolderFactoryAddress,
          Object.values(governance),
        ]
      );

      await this.execute(8_00_000, INITIALIZE, client, bytes);

      console.log(`- DAOFactory#${INITIALIZE}(): done\n`);
      return;
    }
    console.log(`- DAOFactory#${INITIALIZE}(): already done\n`);
  };

  initializeWithContractUpgrade = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    if (await this.isInitializationPending()) {
      const proxyAdmin = clientsInfo.dexOwnerId.toSolidityAddress();
      const godHolderFactoryAddress = csDev.getContractWithProxy(
        csDev.godTokenHolderFactory
      ).transparentProxyAddress!;
      const deployedItems = await deployment.deployContracts([
        csDev.contractUpgradeDao,
        csDev.governorUpgradeContract,
      ]);
      const contractUpgradeDao = deployedItems.get(csDev.contractUpgradeDao);
      const governorUpgradeContract = deployedItems.get(
        csDev.governorUpgradeContract
      );
      const args = new ContractFunctionParameters()
        .addAddress(proxyAdmin)
        .addAddress(this.htsAddress)
        .addAddress(contractUpgradeDao.address)
        .addAddress(godHolderFactoryAddress)
        .addAddress(governorUpgradeContract.address);
      await this.execute(8_00_000, INITIALIZE, client, args);
      console.log(`- DAOFactory#${INITIALIZE}(): done\n`);
      return;
    }
    console.log(`- DAOFactory#${INITIALIZE}(): already done\n`);
  };

  initializeWithTextGovernance = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    if (await this.isInitializationPending()) {
      const proxyAdmin = clientsInfo.dexOwnerId.toSolidityAddress();
      const godHolderFactoryAddress = csDev.getContractWithProxy(
        csDev.godTokenHolderFactory
      ).transparentProxyAddress!;
      const deployedItems = await deployment.deployContracts([
        csDev.textDao,
        csDev.governorTextContractName,
      ]);
      const textDao = deployedItems.get(csDev.textDao);
      const governorTextContract = deployedItems.get(
        csDev.governorTextContractName
      );
      const args = new ContractFunctionParameters()
        .addAddress(proxyAdmin)
        .addAddress(this.htsAddress)
        .addAddress(textDao.address)
        .addAddress(godHolderFactoryAddress)
        .addAddress(governorTextContract.address);
      await this.execute(8_00_000, INITIALIZE, client, args);
      console.log(
        `- DAOFactory#${INITIALIZE}(): done contract-id = ${this.contractId}\n`
      );
      return;
    }
    console.log(
      `- DAOFactory#${INITIALIZE}(): done contract-id = ${this.contractId} already done\n`
    );
  };

  createTokenTransferDao = async (
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
      5_500_000,
      CREATE_DAO,
      client,
      bytes
    );
    const address = result.getAddress(0);
    console.log(`- DAOFactory#${CREATE_DAO}(): with input data = ${hex}`);
    console.table({
      ...createDAOInputs,
      webLinks: webLinks.toString(),
      daoAddress: address,
      daoFactoryId: this.contractId,
      txnId: record.transactionId.toString(),
    });
    return address;
  };

  createContractUpgradeDao = async (
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
      ContractService.CONTRACT_UPGRADE_DAO_FACTORY,
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
    console.log(`- DAOFactory#${CREATE_DAO}(): with input data = ${hex}`);
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
      `- DAOFactory#${GET_DAOS}(): count = ${addresses.length}, dao's = [${addresses}]\n`
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
      clientsInfo.dexOwnerClient,
      bytes
    );

    console.log(
      `- DAOFactory#${UPGRADE_GOVERNORS_IMPLEMENTATION}(): tx ${receipt.status}\n`
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
    console.log(`- DAOFactory#${UPGRADE_GOD_TOKEN_HOLDER_FACTORY}(): done\n`);
  };

  getGODTokenHolderFactoryAddress = async () => {
    const { result } = await this.execute(
      2_00_000,
      GET_GOD_TOKEN_HOLDER_FACTORY_ADDRESS,
      clientsInfo.dexOwnerClient
    );
    const address = result.getAddress(0);
    console.log(
      `- DAOFactory#${GET_GOD_TOKEN_HOLDER_FACTORY_ADDRESS}(): address = ${address}\n`
    );
    return ContractId.fromSolidityAddress(address);
  };

  getGovernorTokenDaoInstance = (daoProxyAddress: string) => {
    const tokenTransferDAOProxyId =
      ContractId.fromSolidityAddress(daoProxyAddress).toString();
    return new GovernorTokenDao(tokenTransferDAOProxyId);
  };

  getGovernorTokenTransferInstance = async (
    tokenTransferDAO: GovernorTokenDao
  ) => {
    const governorTokenTransferProxyContractId =
      await tokenTransferDAO.getGovernorTokenTransferContractAddresses();
    return new Governor(governorTokenTransferProxyContractId.toString());
  };

  getGodHolderInstance = async (tokenId: TokenId) => {
    const factoryId = await this.getGODTokenHolderFactoryAddress();
    return InstanceProvider.getInstance().getGODTokenHolderFromFactory(
      tokenId,
      factoryId.toString()
    );
  };
}
