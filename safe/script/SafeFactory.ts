import Base from "../../e2e-test/business/Base";
import Pair from "./Pair";
import { BigNumber } from "bignumber.js";
import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractFunctionParameters, Client } from "@hashgraph/sdk";

const CREATE_PROXY = "createProxy";

export default class SafeFactory extends Base {
  createProxy = async (
    safeAddress: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    let proxyAddress = "";
    try {
      const args = new ContractFunctionParameters()
        .addAddress(safeAddress)
        .addBytes(new Uint8Array());

      const { result } = await this.execute(
        9000000,
        CREATE_PROXY,
        client,
        args,
        undefined
      );
      proxyAddress = result.getAddress(0);
      console.log(
        `- Factory#${CREATE_PROXY}(): Proxy address ${proxyAddress}\n`
      );
    } catch (error) {
      console.error(`- Factory#${CREATE_PROXY}(): error`, error, "\n");
    }
    return proxyAddress;
  };
}
