import Base from "./Base";

import { clientsInfo } from "../../utils/ClientManagement";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { Client, ContractId, ContractFunctionParameters } from "@hashgraph/sdk";

const deployment = new Deployment();

const INITIALIZE = "initialize";
const GET_TOKEN_HOLDER = "getTokenHolder";

export default class GODTokenHolderFactory extends Base {
  initialize = async (client: Client = clientsInfo.operatorClient) => {
    if (await this.isInitializationPending()) {
      const godHolderLogic = await deployment.deploy("GodHolder");
      const proxyAdmin = clientsInfo.dexOwnerId.toSolidityAddress();
      const args = new ContractFunctionParameters()
        .addAddress(this.htsAddress)
        .addAddress(godHolderLogic.address)
        .addAddress(proxyAdmin);
      await this.execute(4_00_000, INITIALIZE, client, args);
      console.log(`- GODTokenHolderFactory#${INITIALIZE}(): done. \n`);
      return;
    }
    console.log(`- GODTokenHolderFactory#${INITIALIZE}(): already done. \n`);
  };

  getTokenHolder = async (
    tokenAddress: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addAddress(tokenAddress);

    const { result } = await this.execute(
      20_00_000,
      GET_TOKEN_HOLDER,
      client,
      args
    );

    const address = result.getAddress(0);
    console.log(
      `- GODTokenFactory#${GET_TOKEN_HOLDER}(): Token = ${tokenAddress}, Holder address =  ${address}\n`
    );
    return ContractId.fromSolidityAddress(address);
  };
}
