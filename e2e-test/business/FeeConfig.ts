import Common from "./Common";
import BaseDAO from "./BaseDao";

import { clientsInfo } from "../../utils/ClientManagement";
import { FeeConfigDetails } from "./types";
import {
  Hbar,
  Client,
  TokenId,
  ContractFunctionParameters,
} from "@hashgraph/sdk";

const FEE_CONFIG = "feeConfig";
const CHANGE_FEE_CONFIG_CONTROLLER = "changeFeeConfigController";

export default abstract class FeeConfig extends BaseDAO {
  protected UPDATE_FEE_CONFIG = "updateFeeConfig";

  public feeConfig = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(50_000, FEE_CONFIG, client);
    const feeConfigDataFromContract = await this.decodeFunctionResult(
      this.getContractName(),
      FEE_CONFIG,
      result.asBytes(),
    );
    const feeConfig: FeeConfigDetails = {
      receiver: feeConfigDataFromContract.receiver,
      tokenAddress: feeConfigDataFromContract.tokenAddress,
      amountOrId: feeConfigDataFromContract.amountOrId.toNumber(),
    };
    let hBarPayable = 0;
    let proposalFee = feeConfig.amountOrId;
    if (Common.isHBAR(TokenId.fromSolidityAddress(feeConfig.tokenAddress))) {
      proposalFee = Hbar.fromTinybars(proposalFee).toBigNumber().toNumber();
      hBarPayable = proposalFee;
    }
    const info = {
      ...feeConfig,
      proposalFee,
      hBarPayable,
    };
    console.log(`- FeeConfig#${FEE_CONFIG}():`);
    console.table(info);
    console.log("");
    return info;
  };

  public changeFeeConfigController = async (
    newOwnerAddress: string,
    currentOwnerClient: Client,
  ) => {
    const args = new ContractFunctionParameters().addAddress(newOwnerAddress);
    await this.execute(
      80_000,
      CHANGE_FEE_CONFIG_CONTROLLER,
      currentOwnerClient,
      args,
    );
    console.log(
      `- FeeConfig#${CHANGE_FEE_CONFIG_CONTROLLER}(): new-controller address = ${newOwnerAddress}`,
    );
  };
}
