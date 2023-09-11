import {
  Client,
  AccountId,
  ContractFunctionParameters,
  TokenId,
} from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";
import { clientsInfo } from "../../utils/ClientManagement";
import Governor from "./Governor";
import { BigNumber } from "bignumber.js";

export default class TokenCreateGovernor extends Governor {
  protected getContractName() {
    return ContractService.GOVERNOR_TOKEN_CREATE;
  }

  createTokenProposal = async (
    title: string,
    tokenName: string,
    tokenSymbol: string,
    tokenTreasureId: AccountId,
    client: Client = clientsInfo.operatorClient,
    description: string = this.DEFAULT_DESCRIPTION,
    link: string = this.DEFAULT_LINK,
    nftTokenSerialId: number = this.DEFAULT_NFT_TOKEN_SERIAL_NO,
  ) => {
    const args = new ContractFunctionParameters()
      .addString(title)
      .addString(description)
      .addString(link)
      .addAddress(tokenTreasureId.toSolidityAddress())
      .addString(tokenName)
      .addString(tokenSymbol)
      .addUint256(nftTokenSerialId);

    const { result } = await this.execute(
      1_000_000,
      this.CREATE_PROPOSAL,
      client,
      args,
    );
    const proposalId = result.getUint256(0).toFixed();
    console.log(
      `- TokenCreateGovernor#${this.CREATE_PROPOSAL}(): proposal-id = ${proposalId}\n`,
    );
    return proposalId;
  };

  getTokenAddressFromGovernorTokenCreate = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = this.createParams(proposalId);
    const { result } = await this.execute(
      5_00_000,
      this.GET_TOKEN_ADDRESSES,
      client,
      args,
    );
    const tokenAddress = result.getAddress(0);
    console.log(
      `- TokenCreateGovernor#${this.GET_TOKEN_ADDRESSES}(): token-address = ${tokenAddress}\n`,
    );
    return TokenId.fromSolidityAddress(tokenAddress);
  };

  async mintToken(
    proposalId: string,
    amount: BigNumber,
    client: Client = clientsInfo.operatorClient,
  ) {
    const args = new ContractFunctionParameters()
      .addUint256(BigNumber(proposalId))
      .addUint256(amount);

    const { result } = await this.execute(
      3000000,
      this.MINT_TOKEN,
      client,
      args,
    );

    const newTokenSupply = result.getInt64(0).toFixed();
    console.log(
      `- TokenCreateGovernor#${this.MINT_TOKEN}(): new token supply = ${newTokenSupply}\n`,
    );

    return newTokenSupply;
  }

  async burnToken(
    proposalId: string,
    amount: BigNumber,
    client: Client = clientsInfo.operatorClient,
  ) {
    const args = new ContractFunctionParameters()
      .addUint256(BigNumber(proposalId))
      .addUint256(amount);

    const { result } = await this.execute(
      3000000,
      this.BURN_TOKEN,
      client,
      args,
    );

    const newTokenSupply = result.getInt64(0).toFixed();
    console.log(
      `- TokenCreateGovernor#${this.BURN_TOKEN}(): new token supply = ${newTokenSupply}\n`,
    );

    return newTokenSupply;
  }

  async transferToken(
    proposalId: string,
    to: string,
    amount: BigNumber,
    client: Client = clientsInfo.operatorClient,
  ) {
    const args = new ContractFunctionParameters()
      .addUint256(BigNumber(proposalId))
      .addAddress(to)
      .addUint256(amount);

    const { receipt } = await this.execute(
      3000000,
      this.TRANSFER_TOKEN,
      client,
      args,
      clientsInfo.treasureKey,
    );

    console.log(
      `- TokenCreateGovernor#${this.TRANSFER_TOKEN}(): token transfer tx status = ${receipt.status}\n`,
    );
  }
}
