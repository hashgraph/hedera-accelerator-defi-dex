import Base from "./Base";

import { clientsInfo } from "../../utils/ClientManagement";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";

const GET_DAO_INFO = "getDaoInfo";
const UPDATE_DAO_INFO = "updateDaoInfo";

export default class BaseDAO extends Base {
  updateDaoInfo = async (
    name: string,
    logoUrl: string,
    description: string,
    webLinks: string[],
    client: Client
  ) => {
    const info = {
      name,
      logoUrl,
      description,
      webLinks: webLinks.join(","),
    };
    const args = new ContractFunctionParameters()
      .addString(name)
      .addString(logoUrl)
      .addString(description)
      .addStringArray(webLinks);
    await this.execute(8_00_000, UPDATE_DAO_INFO, client, args);
    console.log(`- BaseDAO#${UPDATE_DAO_INFO}():`);
    console.table(info);
    console.log("\n");
  };

  getDaoInfo = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(3_00_000, GET_DAO_INFO, client);
    const output = (
      await this.decodeFunctionResult("BaseDAO", GET_DAO_INFO, result.asBytes())
    )[0];
    const info = {
      name: output.name,
      admin: output.admin,
      logoUrl: output.logoUrl,
      description: output.description,
      webLinks: output.webLinks.toString(),
    };
    console.log(`- BaseDAO#${GET_DAO_INFO}():`);
    console.table(info);
    console.log("\n");
  };
}
