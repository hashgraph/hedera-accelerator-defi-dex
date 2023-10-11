import dex from "../../deployment/model/dex";
import { clientsInfo } from "../../utils/ClientManagement";
import { FeeConfigDetails } from "./types";

export const DEFAULT_FEE_CONFIG: FeeConfigDetails = {
  receiver: clientsInfo.operatorId.toSolidityAddress(),
  tokenAddress: dex.ZERO_TOKEN_ID.toSolidityAddress(),
  amountOrId: dex.DAO_FEE,
};

export const DEFAULT_PROPOSAL_CREATION_FEE_CONFIG: FeeConfigDetails = {
  ...DEFAULT_FEE_CONFIG,
};
