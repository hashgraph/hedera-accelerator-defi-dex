import Base from "./Base";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";

const GET_GOD_TOKEN_HOLDER = "getGODTokenHolder";
const INITIALIZE = "initialize";

export default class GODTokenHolderFactory extends Base {
  initialize = async (
    godHolderLogic: string,
    admin: string,
    client: Client
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(this.htsAddress)
      .addAddress(godHolderLogic)
      .addAddress(admin);
    await this.execute(2000000, INITIALIZE, client, args, undefined);

    console.log(`- GODTokenHolderFactory#${INITIALIZE} done. \n`);
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
      `- GODTokenFactory#${GET_GOD_TOKEN_HOLDER} Token ${tokenAddress} has GOD token holder address ${result.getAddress(
        0
      )} \n`
    );
  };
}
