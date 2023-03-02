import Base from "./Base";

import { Helper } from "../../utils/Helper";
import { BigNumber } from "bignumber.js";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";

const deployment = new Deployment();
const csDev = new ContractService();

const INITIALIZE = "initialize";
const CREATE_DAO = "createDAO";
const GET_DAOS = "getDAOs";
const UPGRADE_GOVERNOR_TOKEN_DAO_LOGIC_IMPL =
  "upgradeGovernorTokenDaoLogicImplementation";

const UPGRADE_GOVERNOR_TOKEN_TRANSFER_LOGIC_IMPL =
  "upgradeGovernorTokenTransferLogicImplementation";

const UPGRADE_GOD_TOKEN_HOLDER_FACTORY = "upgradeGODTokenHolderFactory";

export default class GovernanceDAOFactory extends Base {
  initialize = async (
    contractName: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    if (await this.isInitializationPending(contractName)) {
      const proxyAdmin = clientsInfo.dexOwnerId.toSolidityAddress();
      const godHolderFactoryAddress = csDev.getContractWithProxy(
        csDev.godTokenHolderFactory
      ).transparentProxyAddress!;
      const governorTokenDao = await deployment.deploy(csDev.governorTokenDao);
      const governorTT = await deployment.deploy(csDev.governorTTContractName);
      const args = new ContractFunctionParameters()
        .addAddress(proxyAdmin)
        .addAddress(this.htsAddress)
        .addAddress(governorTokenDao.address)
        .addAddress(godHolderFactoryAddress)
        .addAddress(governorTT.address);
      await this.execute(800000, INITIALIZE, client, args);
      console.log(`- GovernanceDAOFactory#${INITIALIZE}(): done\n`);
      return;
    }
    console.log(`- GovernanceDAOFactory#${INITIALIZE}(): already done\n`);
  };

  createDAO = async (
    admin: string,
    name: string,
    logoUrl: string,
    tokenAddress: string,
    quorumThreshold: number,
    votingDelay: number,
    votingPeriod: number,
    isPrivate: boolean,
    client: Client = clientsInfo.operatorClient
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
    const { result } = await this.execute(900000, CREATE_DAO, client, args);
    const address = result.getAddress(0);
    console.log(`- GovernanceDAOFactory#${CREATE_DAO}(): done`);
    console.table({ ...params, "dao-address": address });
    return address;
  };

  getDAOs = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(9999999, GET_DAOS, client);
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
      200000,
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
      200000,
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
      200000,
      UPGRADE_GOD_TOKEN_HOLDER_FACTORY,
      clientsInfo.dexOwnerClient,
      args
    );
    console.log(
      `- GovernanceDAOFactory#${UPGRADE_GOD_TOKEN_HOLDER_FACTORY}(): done\n`
    );
  };
}
