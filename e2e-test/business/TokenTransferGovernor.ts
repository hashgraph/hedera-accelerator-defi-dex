import Governor from "./Governor";

import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";

const CREATE_TOKEN_ASSOCIATE_PROPOSAL = "createTokenAssociateProposal";
export default class TokenTransferGovernor extends Governor {
  protected getContractName() {
    return ContractService.GOVERNOR_TT;
  }

  createTokenTransferProposal = async (
    title: string,
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

  public createTokenAssociateProposal = async (
    title: string,
    tokenAddress: string,
    client: Client = clientsInfo.operatorClient,
    description: string = this.DEFAULT_DESCRIPTION,
    link: string = this.DEFAULT_LINK,
    nftTokenSerialId: number = this.DEFAULT_NFT_TOKEN_SERIAL_NO,
    creator: string = clientsInfo.operatorId.toSolidityAddress()
  ) => {
    const args = new ContractFunctionParameters()
      .addString(title)
      .addString(description)
      .addString(link)
      .addAddress(tokenAddress)
      .addAddress(creator)
      .addUint256(nftTokenSerialId);
    const { result } = await this.execute(
      1_000_000,
      CREATE_TOKEN_ASSOCIATE_PROPOSAL,
      client,
      args
    );
    const proposalId = result.getUint256(0).toFixed();
    console.log(
      `- TokenTransferGovernor#${CREATE_TOKEN_ASSOCIATE_PROPOSAL}(): proposal-id = ${proposalId}\n`
    );
    return proposalId;
  };
}
