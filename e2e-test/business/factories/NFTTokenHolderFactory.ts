import Base from "../Base";
import NFTHolder from "../NFTHolder";

import { ContractService } from "../../../deployment/service/ContractService";
import { ContractId } from "@hashgraph/sdk";
import TokenHolderFactory from "./TokenHolderFactory";

export default class NFTTokenHolderFactory extends TokenHolderFactory {
  protected getContractName() {
    return this.csDev.nftTokenHolderFactory;
  }

  protected getPrefix(): string {
    return "NFT";
  }

  protected getHolderInstance(contractId: ContractId) {
    return new NFTHolder(contractId);
  }

  protected getHolderLogic() {
    return ContractService.NFT_HOLDER;
  }
}
