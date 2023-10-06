import Token from "./Token";

import { clientsInfo } from "../../utils/ClientManagement";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";

const OWNER_OF = "ownerOf";
const SET_APPROVAL_FOR_ALL = "setApprovalForAll";
const IS_APPROVED_FOR_ALL = "isApprovedForAll";

export default class NFTToken extends Token {
  protected getContractName() {
    return "NFTToken";
  }

  public ownerOf = async (
    serialId: number,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = new ContractFunctionParameters().addUint256(serialId);
    const { result } = await this.execute(50_000, OWNER_OF, client, args);
    const owner = result.getAddress(0);
    console.log(
      `- NFTToken#${OWNER_OF}(): TokenId = ${this.contractId}, serialId = ${serialId}, owner = ${owner}\n`,
    );
    return owner;
  };

  public setApprovalForAll = async (
    spenderAddress: string,
    approved: boolean,
    ownerClient: Client,
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(spenderAddress)
      .addBool(approved);
    const { record } = await this.execute(
      9_00_000,
      SET_APPROVAL_FOR_ALL,
      ownerClient,
      args,
    );
    console.log(
      `- NFTToken#${SET_APPROVAL_FOR_ALL}(): spender-address = ${spenderAddress}, approved = ${approved}, TxnId = ${record.transactionId}\n`,
    );
  };

  public isApprovedForAll = async (
    spenderAddress: string,
    ownerAddress: string,
    ownerClient: Client,
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(ownerAddress)
      .addAddress(spenderAddress);
    const { record, result } = await this.execute(
      1_00_000,
      IS_APPROVED_FOR_ALL,
      ownerClient,
      args,
    );
    const approved = result.getBool(0);
    console.log(
      `- NFTToken#${IS_APPROVED_FOR_ALL}(): owner-address = ${ownerAddress}, spender-address = ${spenderAddress}, approved = ${approved}, TxnId = ${record.transactionId}\n`,
    );
  };
}
