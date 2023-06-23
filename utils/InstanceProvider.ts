import Vault from "../e2e-test/business/Vault";
import LpToken from "../e2e-test/business/LpToken";
import Factory from "../e2e-test/business/Factory";
import Governor from "../e2e-test/business/Governor";
import Splitter from "../e2e-test/business/Splitter";
import Configuration from "../e2e-test/business/Configuration";

import GodHolder from "../e2e-test/business/GodHolder";
import NFTHolder from "../e2e-test/business/NFTHolder";
import TokenHolderFactory from "../e2e-test/business/factories/TokenHolderFactory";

import MultiSigDao from "../e2e-test/business/MultiSigDao";
import GovernorTokenDao from "../e2e-test/business/GovernorTokenDao";

import DAOFactory from "../e2e-test/business/factories/DAOFactory";
import MultiSigDAOFactory from "../e2e-test/business/factories/MultiSigDAOFactory";

import { TokenId } from "@hashgraph/sdk";
import { ContractId } from "@hashgraph/sdk";
import { ContractService } from "../deployment/service/ContractService";

export class InstanceProvider {
  private static instance = new InstanceProvider();
  private csDev = new ContractService();

  private constructor() {}

  public static getInstance() {
    return InstanceProvider.instance;
  }

  private getProxyId(id: string | null = null, name: string) {
    const idOrAddress =
      id ?? this.csDev.getContractWithProxy(name).transparentProxyId!;
    return idOrAddress.length >= 40
      ? ContractId.fromSolidityAddress(idOrAddress).toString()
      : idOrAddress;
  }

  public getGODTokenHolderFactory(id: string | null = null) {
    const _id = this.getProxyId(id, this.csDev.godTokenHolderFactory);
    return new TokenHolderFactory(_id, false);
  }

  public getNFTTokenHolderFactory(id: string | null = null) {
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
    const _id = this.getProxyId(id, ContractService.FT_DAO);
    return new GovernorTokenDao(_id);
  }

  public getGovernor(name: string, id: string | null = null) {
    const _id = this.getProxyId(id, name);
    return new Governor(_id);
  }

  public getNonFungibleTokenHolder(id: string | null = null) {
    const _id = this.getProxyId(id, this.csDev.nftHolderContract);
    return new NFTHolder(_id);
  }

  public async getNFTTokenHolderFromFactory(
    tokenId: TokenId,
    id: string | null = null
  ) {
    const factory = this.getNFTTokenHolderFactory(id);
    const cId = await factory.getTokenHolder(tokenId.toSolidityAddress());
    return new NFTHolder(cId.toString());
  }

  public async getGODTokenHolderFromFactory(
    tokenId: TokenId,
    id: string | null = null
  ) {
    const factory = this.getGODTokenHolderFactory(id);
    const cId = await factory.getTokenHolder(tokenId.toSolidityAddress());
    return new GodHolder(cId.toString());
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
