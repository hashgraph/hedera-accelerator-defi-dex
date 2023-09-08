import GodHolder from "../GodHolder";
import TokenHolderFactory from "./TokenHolderFactory";

import { ContractId } from "@hashgraph/sdk";
import { ContractService } from "../../../deployment/service/ContractService";

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
    return ContractService.GOD_HOLDER;
  }
}
