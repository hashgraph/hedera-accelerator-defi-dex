import Base from "./Base";

import { clientsInfo } from "../../utils/ClientManagement";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";

const UPDATE_NAME = "updateName";
const ADD_WEB_LINK = "addWebLink";
const UPDATE_LOGO_URL = "updateLogoURL";
const UPDATE_DESCRIPTION = "updateDescription";
const GET_DAO_DETAILS = "getDaoDetail";

export default class BaseDAO extends Base {
  addWebLink = async (
    webLinkName: string = "GIT",
    webLink: string = "git_url",
    client: Client
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
    const desc = result.getString(3);
    const admin = result.getAddress(4);
    const info = { name, logoUrl, links, desc, admin };
    console.log(`- BaseDAO#${GET_DAO_DETAILS}(): ${JSON.stringify(info)} \n`);
  };

  updateName = async (name: string, client: Client) => {
    const args = new ContractFunctionParameters().addString(name);
    await this.execute(2_00_000, UPDATE_NAME, client, args);
    console.log(`- BaseDAO#${UPDATE_NAME}(): done, name = ${name}\n`);
  };

  updateLogoURL = async (logoUrl: string, client: Client) => {
    const args = new ContractFunctionParameters().addString(logoUrl);
    await this.execute(2_00_000, UPDATE_LOGO_URL, client, args);
    console.log(`- BaseDAO#${UPDATE_LOGO_URL}(): done, url =  ${logoUrl}\n`);
  };

  updateDescription = async (updatedDesc: string, client: Client) => {
    const args = new ContractFunctionParameters().addString(updatedDesc);
    await this.execute(2_00_000, UPDATE_DESCRIPTION, client, args);
    console.log(
      `- BaseDAO#${UPDATE_DESCRIPTION}(): done, description =  ${updatedDesc}\n`
    );
  };
}
