import BaseDao from "./BaseDao";
import HederaGovernor from "./HederaGovernor";

import { Client } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { AddressHelper } from "../../utils/AddressHelper";

const GET_GOVERNOR_ADDRESS = "governorAddress";

export default class FTDAO extends BaseDao {
  protected getContractName() {
    return ContractService.FT_DAO;
  }

  public getGovernorAddress = async (
    client: Client = clientsInfo.operatorClient,
  ) => {
    const { result } = await this.execute(
      2_00_000,
      GET_GOVERNOR_ADDRESS,
      client,
    );
    const contractId = await AddressHelper.addressToIdObject(
      result.getAddress(0),
    );
    return new HederaGovernor(contractId);
  };
}
