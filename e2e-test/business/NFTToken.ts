import Token from "./Token";

import { clientsInfo } from "../../utils/ClientManagement";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";

const OWNER_OF = "ownerOf";

export default class NFTToken extends Token {
  protected getContractName() {
    return "NFTToken";
  }

  public ownerOf = async (
    serialId: number,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = new ContractFunctionParameters().addUint256(serialId);
    const { result } = await this.execute(50_000, OWNER_OF, client, args);
    const owner = result.getAddress(0);
    console.log(
      `- NFTToken#${OWNER_OF}(): TokenId = ${this.contractId}, serialId = ${serialId}, owner = ${owner}\n`,
    );
    return owner;
  };
}
