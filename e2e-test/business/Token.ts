import Base from "./Base";

import { clientsInfo } from "../../utils/ClientManagement";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";

const BALANCE_OF = "balanceOf";

export default class Token extends Base {
  protected getContractName() {
    return "Token";
  }

  getBalance = async (
    accountAddress: string,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = new ContractFunctionParameters().addAddress(accountAddress);
    const { result } = await this.execute(50_000, BALANCE_OF, client, args);
    const balance = result.getUint256(0);
    console.log(
      `- Token#${BALANCE_OF}(): token ${this.contractId}, address = ${accountAddress}, balance = ${balance}\n`,
    );
    return balance;
  };
}
