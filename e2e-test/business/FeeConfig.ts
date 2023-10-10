import { BigNumber } from "ethers";
import { clientsInfo } from "../../utils/ClientManagement";
import { Client, Hbar, TokenId } from "@hashgraph/sdk";
import BaseDAO from "./BaseDao";
import Common from "./Common";

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

    const amount = BigNumber.from(feeConfigData.amountOrId).toNumber();
    const isHBAR = Common.isHBAR(
      TokenId.fromSolidityAddress(feeConfigData.receiver),
    );
    const proposalFee = isHBAR
      ? Hbar.fromTinybars(amount).toBigNumber().toNumber()
      : amount;
    const hBarPayable = isHBAR ? proposalFee : 0;

    return {
      tokenAddress: feeConfigData.tokenAddress,
      proposalFee,
      hBarPayable,
    };
  };
}
