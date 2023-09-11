import Governor from "./Governor";

import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";

export default class TextGovernor extends Governor {
  protected getContractName() {
    return ContractService.GOVERNOR_TEXT;
  }

  createTextProposal = async (
    title: string,
    client: Client = clientsInfo.operatorClient,
    description: string = this.DEFAULT_DESCRIPTION,
    link: string = this.DEFAULT_LINK,
    nftTokenSerialId: number = this.DEFAULT_NFT_TOKEN_SERIAL_NO,
  ) => {
    const args = new ContractFunctionParameters()
      .addString(title)
      .addString(description)
      .addString(link)
      .addUint256(nftTokenSerialId);

    const { result } = await this.execute(
      1_000_000,
      this.CREATE_PROPOSAL,
      client,
      args,
    );
    const proposalId = result.getUint256(0).toFixed();
    console.log(
      `- TextGovernor#${this.CREATE_PROPOSAL}(): proposal-id = ${proposalId}  proposal-title = ${title}\n`,
    );
    return proposalId;
  };
}
