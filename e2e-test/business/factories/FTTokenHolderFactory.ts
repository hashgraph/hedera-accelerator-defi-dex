import Base from "../Base";
import GodHolder from "../GodHolder";
import { ContractService } from "../../../deployment/service/ContractService";
import { ContractId } from "@hashgraph/sdk";
import TokenHolderFactory from "./TokenHolderFactory";

export default class FTTokenHolderFactory extends TokenHolderFactory {
  protected getContractName() {
    return this.csDev.godTokenHolderFactory;
  }

  protected getPrefix() {
    return "GOD";
  }

  protected getHolderInstance(contractId: ContractId) {
    return new GodHolder(contractId);
  }

  protected getHolderLogic() {
    return ContractService.NFT_HOLDER;
  }
}
