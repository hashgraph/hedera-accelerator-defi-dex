import Base from "../Base";

import { Helper } from "../../../utils/Helper";
import { Deployment } from "../../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../../utils/ClientManagement";
import { TokenId } from "@hashgraph/sdk";
import { ContractService } from "../../../deployment/service/ContractService";
import NFTTokenHolderFactory from "./NFTTokenHolderFactory";
import NFTHolder from "../NFTHolder";
import DAOFactory from "./DAOFactory";

export default class NFTDAOFactory extends DAOFactory {
  protected getContractName() {
    return ContractService.NFT_DAO_FACTORY;
  }

  protected getPrefix(): string {
    return "NFT";
  }

  protected getTokenHolderInstance = async (tokenId: TokenId) => {
    const factoryProxyId = await this.getTokenHolderFactoryAddress();
    const nftGodFactory = new NFTTokenHolderFactory(factoryProxyId);
    return new NFTHolder(
      await nftGodFactory.getTokenHolder(tokenId.toSolidityAddress())
    );
  };
}
