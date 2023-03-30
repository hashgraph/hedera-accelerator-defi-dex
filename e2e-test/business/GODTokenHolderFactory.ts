import Base from "./Base";
import { clientsInfo } from "../../utils/ClientManagement";
import { Client, ContractId, ContractFunctionParameters } from "@hashgraph/sdk";

import { Deployment } from "../../utils/deployContractOnTestnet";
const deployment = new Deployment();

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

  initializeNew = async (client: Client = clientsInfo.operatorClient) => {
    if (await this.isInitializationPending("godtokenholderfactory")) {
      const proxyAdmin = clientsInfo.dexOwnerId.toSolidityAddress();
      const godHolderLogic = await deployment.deploy(
        "godholder",
        clientsInfo.e2eOperatorKey.publicKey,
        clientsInfo.e2eOperatorClient
      );
      const args = new ContractFunctionParameters()
        .addAddress(this.htsAddress)
        .addAddress(godHolderLogic.address)
        .addAddress(proxyAdmin);
      await this.execute(2000000, INITIALIZE, client, args, undefined);
      console.log(`- GODTokenHolderFactory#${INITIALIZE} done. \n`);
      return;
    }

    console.log(`- GODTokenHolderFactory#${INITIALIZE} already done. \n`);
  };

  getGodTokenHolder = async (
    tokenAddress: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addAddress(tokenAddress);

    const { result } = await this.execute(
      2000000,
      GET_GOD_TOKEN_HOLDER,
      client,
      args,
      undefined
    );

    const address = result.getAddress(0);
    console.log(
      `- GODTokenFactory#${GET_GOD_TOKEN_HOLDER} Token ${tokenAddress} has GOD token holder address ${address} \n`
    );
    return ContractId.fromSolidityAddress(address);
  };
}
