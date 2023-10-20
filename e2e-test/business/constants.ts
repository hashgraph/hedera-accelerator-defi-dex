import dex from "../../deployment/model/dex";
import { clientsInfo } from "../../utils/ClientManagement";
import { FeeConfigDetails } from "./types";

export const DEFAULT_FEE_CONFIG: FeeConfigDetails = {
  receiver: clientsInfo.uiUserId.toSolidityAddress(),
  tokenAddress: dex.ZERO_TOKEN_ID.toSolidityAddress(),
  amountOrId: dex.DAO_FEE,
};
