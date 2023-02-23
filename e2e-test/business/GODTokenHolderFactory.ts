import Base from "./Base";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";

const ADD_GOD_HOLDER = "addGODHolder";
const GET_GOD_TOKEN_HOLDER = "getGODTokenHolder";

export default class GODTokenHolderFactory extends Base {
  addGODHolder = async (godHolderAddress: string, client: Client) => {
    const args = new ContractFunctionParameters().addAddress(godHolderAddress);

    await this.execute(2000000, ADD_GOD_HOLDER, client, args, undefined);

    console.log(
      `- GODTokenFactory#${ADD_GOD_HOLDER} done for token ${godHolderAddress} \n`
    );
  };

  getGodTokenHolder = async (tokenAddress: string, client: Client) => {
    const args = new ContractFunctionParameters().addAddress(tokenAddress);

    const { result } = await this.execute(
      2000000,
      GET_GOD_TOKEN_HOLDER,
      client,
      args,
      undefined
    );

    console.log(
      `- GODTokenFactory#${GET_GOD_TOKEN_HOLDER} GOD token holder address ${result.getAddress(
        0
      )} \n`
    );
  };
}
