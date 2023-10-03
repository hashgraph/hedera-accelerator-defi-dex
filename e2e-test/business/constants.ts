import dex from "../../deployment/model/dex";
import { clientsInfo } from "../../utils/ClientManagement";
import { CommonSteps } from "../step-definitions/CommonSteps";

export const DEFAULT_DAO_CONFIG = {
  daoTreasurer: clientsInfo.treasureId.toSolidityAddress(),
  tokenAddress: dex.ZERO_TOKEN_ID.toSolidityAddress(),
  daoFee: CommonSteps.withPrecision * dex.DAO_FEE,
};
