import { TokenId } from "@hashgraph/sdk";
import { ContractService } from "../../../deployment/service/ContractService";
import GodHolder from "../GodHolder";
import DAOFactory from "./DAOFactory";
import FTTokenHolderFactory from "./FTTokenHolderFactory";

export default class FTDAOFactory extends DAOFactory {
  protected getContractName() {
    return ContractService.FT_DAO_FACTORY;
  }

  protected getPrefix(): string {
    return "GOD";
  }

  public getTokenHolderInstance = async (tokenId: TokenId) => {
    const factoryProxyId = await this.getTokenHolderFactoryAddress();
    const godFactory = new FTTokenHolderFactory(factoryProxyId);
    return new GodHolder(
      await godFactory.getTokenHolder(tokenId.toSolidityAddress())
    );
  };
}
