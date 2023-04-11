import Base from "./Base";

import { clientsInfo } from "../../utils/ClientManagement";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";

const ADD_WEB_LINK = "addWebLink";
const GET_DAO_DETAILS = "getDaoDetail";
const GET_WEB_LINKS = "getWebLinks";

export default class BaseDAO extends Base {
  addWebLink = async (
    webLinkName: string = "GIT",
    webLink: string = "git_url",
    client: Client = clientsInfo.uiUserClient
  ) => {
    const args = new ContractFunctionParameters()
      .addString(webLinkName)
      .addString(webLink);

    await this.execute(9_00_000, ADD_WEB_LINK, client, args);
    console.log(`- BaseDAO#${ADD_WEB_LINK}(): done\n`);
  };

  getDaoDetail = async (client: Client = clientsInfo.operatorClient) => {
    const args = new ContractFunctionParameters();
    const { result } = await this.execute(
      9_00_000,
      GET_DAO_DETAILS,
      client,
      args
    );
    const name = result.getString(0);
    const logoUrl = result.getString(1);
    console.log(`- BaseDAO#${GET_DAO_DETAILS}(): done`);
    console.table({ name, logoUrl });
    console.log("");
  };

  getWebLinks = async (client: Client = clientsInfo.operatorClient) => {
    const args = new ContractFunctionParameters();
    const { result } = await this.execute(
      9_00_000,
      GET_WEB_LINKS,
      client,
      args
    );
    const link = result.getString(1);
    console.log(
      `${result.getString(0)}\n${result.getString(1)}\n${result.getString(
        2
      )}\n${result.getString(3)}\n${result.getString(4)}`
    );
    console.log(`- BaseDAO#${GET_WEB_LINKS}(): link = ${link}\n`);
  };
}
