import { clientsInfo } from "../../utils/ClientManagement";

import { Client, AccountId, ContractFunctionParameters } from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";
import Governor from "./Governor";
import { BigNumber } from "bignumber.js";

export default class TokenTransferGovernor extends Governor {
  protected getContractName() {
    return ContractService.GOVERNOR_TT;
  }

  createTokenTransferProposal = async (
    title: string,
    fromAddress: string,
    toAddress: string,
    tokenId: string,
    tokenAmount: number,
    client: Client = clientsInfo.operatorClient,
    nftTokenSerialId: number = this.DEFAULT_NFT_TOKEN_SERIAL_NO,
    description: string = this.DEFAULT_DESCRIPTION,
    link: string = this.DEFAULT_LINK,
    creator: string = clientsInfo.operatorId.toSolidityAddress()
  ) => {
    const args = new ContractFunctionParameters()
      .addString(title)
      .addString(description)
      .addString(link)
      .addAddress(fromAddress) // from
      .addAddress(toAddress) // to
      .addAddress(tokenId) // tokenToTransfer
      .addUint256(BigNumber(tokenAmount)) // amountToTransfer
      .addAddress(creator) // proposal creator
      .addUint256(nftTokenSerialId);

    const { result } = await this.execute(
      1_000_000,
      this.CREATE_PROPOSAL,
      client,
      args
    );
    const proposalId = result.getUint256(0).toFixed();
    console.log(
      `- TokenTransferGovernor#${this.CREATE_PROPOSAL}(): proposal-id = ${proposalId}\n`
    );
    return proposalId;
  };
}
