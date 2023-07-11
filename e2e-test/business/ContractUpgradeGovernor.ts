import {
  Client,
  AccountId,
  ContractFunctionParameters,
  TokenId,
  ContractId,
} from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";
import { clientsInfo } from "../../utils/ClientManagement";
import Governor from "./Governor";
import { BigNumber } from "bignumber.js";

export default class ContractUpgradeGovernor extends Governor {
  protected getContractName() {
    return ContractService.GOVERNOR_UPGRADE;
  }

  createContractUpgradeProposal = async (
    targetProxyId: ContractId,
    targetLogicId: ContractId,
    title: string,
    client: Client = clientsInfo.operatorClient,
    description: string = this.DEFAULT_DESCRIPTION,
    link: string = this.DEFAULT_LINK,
    nftTokenSerialId: number = this.DEFAULT_NFT_TOKEN_SERIAL_NO
  ) => {
    const args = new ContractFunctionParameters()
      .addString(title)
      .addString(description)
      .addString(link)
      .addAddress(targetProxyId.toSolidityAddress())
      .addAddress(targetLogicId.toSolidityAddress())
      .addAddress(clientsInfo.operatorId.toSolidityAddress())
      .addUint256(nftTokenSerialId);

    const { result, receipt } = await this.execute(
      1_000_000,
      this.CREATE_PROPOSAL,
      client,
      args
    );
    const proposalId = result.getUint256(0).toFixed();
    const success = receipt.status.toString().toLowerCase() === "success";
    console.log(
      `- ContractUpgradeGovernor#${this.CREATE_PROPOSAL}(): proposal-id = ${proposalId}\n`
    );
    return {
      proposalId,
      success,
    };
  };

  getContractAddressesFromGovernorUpgradeContract = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = this.createParams(proposalId);
    const { result } = await this.execute(
      5_00_000,
      this.GET_CONTRACT_ADDRESSES,
      client,
      args
    );
    const proxyAddress = "0x" + result.getAddress(0);
    const logicAddress = "0x" + result.getAddress(1);
    const proxyId = ContractId.fromSolidityAddress(proxyAddress);
    const logicId = ContractId.fromSolidityAddress(logicAddress);
    const proxyIdString = proxyId.toString();
    const logicIdString = logicId.toString();
    const response = {
      proxyId,
      proxyIdString,
      proxyAddress,
      logicId,
      logicIdString,
      logicAddress,
    };
    console.log(
      `- ContractUpgradeGovernor#${this.GET_CONTRACT_ADDRESSES}(): proxyAddress = ${proxyAddress}, logicAddress = ${logicAddress}\n`
    );
    return response;
  };
}
