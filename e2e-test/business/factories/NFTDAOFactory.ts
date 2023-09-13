import NFTHolder from "../NFTHolder";
import DAOFactory from "./DAOFactory";
import NFTTokenHolderFactory from "./NFTTokenHolderFactory";

import { TokenId } from "@hashgraph/sdk";
import { ContractService } from "../../../deployment/service/ContractService";

export default class NFTDAOFactory extends DAOFactory {
  protected getContractName() {
    return ContractService.NFT_DAO_FACTORY;
  }

  protected getPrefix(): string {
    return "NFT";
  }

  public getTokenHolderInstance = async (tokenId: TokenId) => {
    const factoryProxyId = await this.getTokenHolderFactoryAddress();
    const nftGodFactory = new NFTTokenHolderFactory(factoryProxyId);
    return new NFTHolder(
      await nftGodFactory.getTokenHolder(tokenId.toSolidityAddress())
    );
  };
}
