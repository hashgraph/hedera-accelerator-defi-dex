import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import { Client } from "@hashgraph/sdk";
import BaseDAO from "./BaseDao";

const GET_FEE_CONFIG = "feeConfig";

export default abstract class FeeConfig extends BaseDAO {
  getFeeConfig = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(50000, GET_FEE_CONFIG, client);
    const feeConfigData = await this.decodeFunctionResult(
      this.getContractName(),
      GET_FEE_CONFIG,
      result.asBytes(),
    );
    console.log(
      `- FeeConfig#${GET_FEE_CONFIG}() = ${JSON.stringify(feeConfigData)}\n`,
    );
    const feeConfig = {
      receiver: feeConfigData.receiver,
      tokenAddress: feeConfigData.tokenAddress,
      amountOrId: feeConfigData.amountOrId,
    };
    return feeConfig;
  };
}
