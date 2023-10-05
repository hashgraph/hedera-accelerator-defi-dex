import dex from "../../deployment/model/dex";
import { clientsInfo } from "../../utils/ClientManagement";
import { CommonSteps } from "../step-definitions/CommonSteps";

export const DEFAULT_FEE_CONFIG = {
  receiver: clientsInfo.treasureId.toSolidityAddress(),
  tokenAddress: dex.TOKEN_LAB49_1_ID.toSolidityAddress(),
  amountOrId: CommonSteps.withPrecision * dex.DAO_FEE,
};
