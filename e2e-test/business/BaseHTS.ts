import Base from "./Base";
import { clientsInfo } from "../../utils/ClientManagement";
import {
  Client,
  PrivateKey,
  ContractFunctionParameters,
  TokenId,
  AccountId,
  ContractId,
} from "@hashgraph/sdk";

const ASSOCIATE_TOKEN_PUBLIC = "associateTokenPublic";

export default class BaseHTS extends Base {
  associateTokenPublic = async (
    tokenId: TokenId,
    accountId: AccountId | ContractId,
    accountOwnerPrivateKey: PrivateKey,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(accountId.toSolidityAddress())
      .addAddress(tokenId.toSolidityAddress());
    const { result } = await this.execute(
      3000000,
      ASSOCIATE_TOKEN_PUBLIC,
      client,
      args,
      accountOwnerPrivateKey
    );
    const responseCode = result.getUint256(0);
    console.log(
      `- BaseHTS#${ASSOCIATE_TOKEN_PUBLIC}(): done with code = ${responseCode}\n`
    );
  };
}
