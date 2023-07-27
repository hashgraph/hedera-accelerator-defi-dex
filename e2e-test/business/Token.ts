import Base from "./Base";
import BigNumber from "bignumber.js";

import { clientsInfo } from "../../utils/ClientManagement";
import {
  Client,
  AccountId,
  ContractFunctionParameters,
  ContractId,
} from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";

const BALANCE_OF = "balanceOf";

export default class Token extends Base {
  protected getContractName() {
    return "Token";
  }

  getBalance = async (
    user: AccountId | ContractId | string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const address = typeof user === "string" ? user : user.toSolidityAddress();
    const args = new ContractFunctionParameters().addAddress(address);
    const { result } = await this.execute(50_000, BALANCE_OF, client, args);
    const balance = result.getUint256(0);
    console.log(
      `- Token#${BALANCE_OF}(): token ${this.contractId}, address = ${address}, balance = ${balance}\n`
    );
    return balance;
  };
}
