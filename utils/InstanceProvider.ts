import Vault from "../e2e-test/business/Vault";
import LpToken from "../e2e-test/business/LpToken";
import Factory from "../e2e-test/business/Factory";
import Governor from "../e2e-test/business/Governor";
import Splitter from "../e2e-test/business/Splitter";
import GodHolder from "../e2e-test/business/GodHolder";
import NFTHolder from "../e2e-test/business/NFTHolder";
import DAOFactory from "../e2e-test/business/factories/DAOFactory";
import ContractUpgradeDAOFactory from "../e2e-test/business/DAOFactory";
import MultiSigDao from "../e2e-test/business/MultiSigDao";
import Configuration from "../e2e-test/business/Configuration";
import GovernorTokenDao from "../e2e-test/business/GovernorTokenDao";

import MultiSigDAOFactory from "../e2e-test/business/factories/MultiSigDAOFactory";
import TokenHolderFactory from "../e2e-test/business/factories/TokenHolderFactory";

import { ContractService } from "../deployment/service/ContractService";
import ContractUpgradeDao from "../e2e-test/business/ContractUpgradeDao";

export class InstanceProvider {
  private static instance = new InstanceProvider();
  private csDev = new ContractService();

  private constructor() {}

  public static getInstance() {
    return InstanceProvider.instance;
  }

  private getProxyId(id: string | null = null, name: string) {
    return id ?? this.csDev.getContractWithProxy(name).transparentProxyId!;
  }

  public getFungibleTokenHolderFactory(id: string | null = null) {
    const _id = this.getProxyId(id, this.csDev.godTokenHolderFactory);
    return new TokenHolderFactory(_id, false);
  }

  public getNonFungibleTokenHolderFactory(id: string | null = null) {
    const _id = this.getProxyId(id, this.csDev.nftTokenHolderFactory);
    return new TokenHolderFactory(_id, true);
  }

  public getFungibleTokenDAOFactory(id: string | null = null) {
    const _id = this.getProxyId(id, ContractService.FT_DAO_FACTORY);
    return new DAOFactory(_id, false);
  }

  public getNonFungibleTokenDAOFactory(id: string | null = null) {
    const _id = this.getProxyId(id, ContractService.NFT_DAO_FACTORY);
    return new DAOFactory(_id, true);
  }

  public getMultiSigDAOFactory(id: string | null = null) {
    const _id = this.getProxyId(id, ContractService.MULTI_SIG_FACTORY);
    return new MultiSigDAOFactory(_id);
  }

  public getMultiSigDAO(id: string | null = null) {
    const _id = this.getProxyId(id, ContractService.MULTI_SIG);
    return new MultiSigDao(_id);
  }

  public getGovernorTokenDao(id: string | null = null) {
    const _id = this.getProxyId(id, this.csDev.tokenTransferDAO);
    return new GovernorTokenDao(_id);
  }

  public getContractUpgradeDao(id: string | null = null) {
    const _id = this.getProxyId(id, this.csDev.contractUpgradeDao);
    return new ContractUpgradeDao(_id);
  }

  public getContractUpgradeDaoFactory(
    id: string | null = null,
    isNFTType: Boolean
  ) {
    const _id = this.getProxyId(
      id,
      ContractService.CONTRACT_UPGRADE_DAO_FACTORY
    );
    return new ContractUpgradeDAOFactory(_id);
  }

  public getGovernor(name: string, id: string | null = null) {
    const _id = this.getProxyId(id, name);
    return new Governor(_id);
  }

  public getNonFungibleTokenHolder(id: string | null = null) {
    const _id = this.getProxyId(id, this.csDev.nftHolderContract);
    return new NFTHolder(_id);
  }

  public getFungibleTokenHolder(id: string | null = null) {
    const _id = this.getProxyId(id, this.csDev.godHolderContract);
    return new GodHolder(_id);
  }

  public getConfiguration(id: string | null = null) {
    const _id = this.getProxyId(id, this.csDev.configuration);
    return new Configuration(_id);
  }

  public getFactory(id: string | null = null) {
    const _id = this.getProxyId(id, this.csDev.factoryContractName);
    return new Factory(_id);
  }

  public getLpToken(id: string | null = null) {
    const _id = this.getProxyId(id, this.csDev.lpTokenContractName);
    return new LpToken(_id);
  }

  public getVault(id: string | null = null) {
    const _id = this.getProxyId(id, ContractService.VAULT);
    return new Vault(_id);
  }

  public getSplitter(id: string | null = null) {
    const _id = this.getProxyId(id, ContractService.SPLITTER);
    return new Splitter(_id);
  }
}
