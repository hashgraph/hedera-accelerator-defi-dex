import Base from "./Base";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";

const CREATE_GOD_HOLDER = "createGODHolder";
const GET_GOD_TOKEN_HOLDER = "getGODTokenHolder";

export default class GODTokenHolderFactory extends Base {
  createGODHolder = async (godHolderAddress: string, client: Client) => {
    const args = new ContractFunctionParameters().addAddress(godHolderAddress);

    await this.execute(2000000, CREATE_GOD_HOLDER, client, args, undefined);

    console.log(
      `- GODTokenFactory#${CREATE_GOD_HOLDER} done for token ${godHolderAddress} \n`
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
