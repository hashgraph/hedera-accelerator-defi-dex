import Base from "./Base";

import { clientsInfo } from "../../utils/ClientManagement";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";

const UPDATE_NAME = "updateName";
const ADD_WEB_LINK = "addWebLink";
const UPDATE_LOGO_URL = "updateLogoURL";
const GET_DAO_DETAILS = "getDaoDetail";

export default class BaseDAO extends Base {
  addWebLink = async (
    webLinkName: string = "GIT",
    webLink: string = "git_url",
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addString(webLinkName)
      .addString(webLink);
    await this.execute(2_00_000, ADD_WEB_LINK, client, args);
    console.log(
      `- BaseDAO#${ADD_WEB_LINK}(): done, name = ${webLinkName}, link = ${webLink}\n`
    );
  };

  getDaoDetail = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(2_00_000, GET_DAO_DETAILS, client);
    const name = result.getString(0);
    const logoUrl = result.getString(1);
    const links = result.getString(2);
    console.log(`- BaseDAO#${GET_DAO_DETAILS}():`);
    console.table({ name, logoUrl, links });
    console.log("");
  };

  updateName = async (
    name: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addString(name);
    await this.execute(75_000, UPDATE_NAME, client, args);
    console.log(`- BaseDAO#${UPDATE_NAME}(): done, name = ${name}\n`);
  };

  updateLogoURL = async (
    logoUrl: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addString(logoUrl);
    await this.execute(75_000, UPDATE_LOGO_URL, client, args);
    console.log(`- BaseDAO#${UPDATE_LOGO_URL}(): done, url =  ${logoUrl}\n`);
  };
}
