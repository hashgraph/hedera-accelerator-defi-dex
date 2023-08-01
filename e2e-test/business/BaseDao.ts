import Base from "./Base";

import { Client } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";

const GET_DAO_INFO = "getDaoInfo";
const UPDATE_DAO_INFO = "updateDaoInfo";

export default abstract class BaseDAO extends Base {
  updateDaoInfo = async (
    name: string,
    logoUrl: string,
    description: string,
    webLinks: string[],
    client: Client
  ) => {
    const inputs = {
      _name: name,
      _logoUrl: logoUrl,
      _description: description,
      _webLinks: webLinks,
    };
    const data = await this.encodeFunctionData(
      ContractService.BASE_DAO,
      UPDATE_DAO_INFO,
      Object.values(inputs)
    );
    await this.execute(8_00_000, UPDATE_DAO_INFO, client, data.bytes);
    console.log(`- BaseDAO#${UPDATE_DAO_INFO}():`);
    console.table({ ...inputs, _webLinks: inputs._webLinks.toString() });
    console.log("");
  };

  getDaoInfo = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(3_00_000, GET_DAO_INFO, client);
    const output = (
      await this.decodeFunctionResult(
        ContractService.BASE_DAO,
        GET_DAO_INFO,
        result.asBytes()
      )
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
    console.log("");
  };
}
