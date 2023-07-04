import dex from "../../deployment/model/dex";
import BaseDao from "./BaseDao";
import GodHolder from "./GodHolder";
import NFTHolder from "./NFTHolder";

import { clientsInfo } from "../../utils/ClientManagement";
import { BigNumber } from "bignumber.js";
import {
  Client,
  TokenId,
  ContractId,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";
import { Helper } from "../../utils/Helper";

const INITIALIZE = "initialize";
const CREATE_PROPOSAL = "createTokenTransferProposal";
const CREATE_TEXT_PROPOSAL = "createTextProposal";
const CREATE_CONTRACT_UPGRADE_PROPOSAL = "createContractUpgradeProposal";
const GET_TOKEN_TRANSFER_PROPOSALS = "getTokenTransferProposals";
const GET_GOVERNOR_TOKEN_TRANSFER_CONTRACT_ADDRESSES =
  "getGovernorContractAddresses";

export const DEFAULT_DESCRIPTION = "description";
export const DEFAULT_LINK = "https://defi-ui.hedera.com/governance";
export const DEFAULT_QUORUM_THRESHOLD_IN_BSP = 500;
export const DEFAULT_VOTING_DELAY = 0; // blocks
export const DEFAULT_VOTING_PERIOD = 100; // blocks means 3 minutes as per test
export const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
export const NFT_TOKEN_ID = TokenId.fromString(dex.NFT_TOKEN_ID);

export default class FTDAO extends BaseDao {
  async initialize(
    admin: string,
    name: string,
    url: string,
    desc: string,
    webLinks: string[],
    tokenHolder: GodHolder | NFTHolder,
    client: Client = clientsInfo.operatorClient,
    defaultQuorumThresholdValue: number = DEFAULT_QUORUM_THRESHOLD_IN_BSP,
    votingDelay: number = DEFAULT_VOTING_DELAY,
    votingPeriod: number = DEFAULT_VOTING_PERIOD,
    tokenId: TokenId = GOD_TOKEN_ID,
    holderTokenId: TokenId = GOD_TOKEN_ID
  ) {
    await tokenHolder.initialize(client, holderTokenId.toSolidityAddress());
    const godHolderContractId = tokenHolder.contractId;
    const godHolderProxyAddress =
      ContractId.fromString(godHolderContractId).toSolidityAddress();

    const contractService = new ContractService();

    const inputs = {
      admin,
      name,
      url,
      tokenAddress: tokenId.toSolidityAddress(),
      quorumThreshold: defaultQuorumThresholdValue,
      votingDelay,
      votingPeriod,
      isPrivate: false,
      description: desc,
      webLinks,
    };

    const governance = {
      tokenTransferLogic: contractService.getContract(
        ContractService.GOVERNOR_TT
      ).address,
      textLogic: contractService.getContract(ContractService.GOVERNOR_TEXT)
        .address,
      contractUpgradeLogic: contractService.getContract(
        ContractService.GOVERNOR_UPGRADE
      ).address,
      createTokenLogic: contractService.getContract(
        ContractService.GOVERNOR_TOKEN_CREATE
      ).address,
    };

    const common = {
      hederaService: this.htsAddress,
      iTokenHolder: godHolderProxyAddress,
      proxyAdmin: clientsInfo.childProxyAdminId.toSolidityAddress(),
      systemUser: clientsInfo.operatorId.toSolidityAddress(),
    };

    const { hex, bytes } = await this.encodeFunctionData(
      ContractService.FT_DAO,
      INITIALIZE,
      [Object.values(inputs), Object.values(governance), Object.values(common)]
    );

    const { receipt } = await this.execute(
      70_00_000,
      INITIALIZE,
      client,
      bytes
    );

    console.log(`- FTDAO#${INITIALIZE}(): ${receipt.status} \n`);
  }

  createTokenTransferProposal = async (
    title: string,
    fromAddress: string,
    toAddress: string,
    tokenId: string,
    tokenAmount: number,
    client: Client = clientsInfo.operatorClient,
    description: string = DEFAULT_DESCRIPTION,
    link: string = DEFAULT_LINK
  ) => {
    const args = new ContractFunctionParameters()
      .addString(title)
      .addString(description)
      .addString(link)
      .addAddress(fromAddress) // from
      .addAddress(toAddress) // to
      .addAddress(tokenId) // tokenToTransfer
      .addUint256(BigNumber(tokenAmount)); // amountToTransfer
    const { result } = await this.execute(
      1_000_000,
      CREATE_PROPOSAL,
      client,
      args,
      clientsInfo.operatorKey
    );
    const proposalId = result.getUint256(0).toFixed();
    console.log(`- FTDAO#${CREATE_PROPOSAL}(): proposal-id = ${proposalId}\n`);
    return proposalId;
  };

  createTextProposal = async (
    title: string,
    client: Client = clientsInfo.operatorClient,
    description: string = DEFAULT_DESCRIPTION,
    link: string = DEFAULT_LINK
  ) => {
    const args = new ContractFunctionParameters()
      .addString(title)
      .addString(description)
      .addString(link);

    const { result } = await this.execute(
      1_000_000,
      CREATE_TEXT_PROPOSAL,
      client,
      args,
      clientsInfo.operatorKey
    );

    const proposalId = result.getUint256(0).toFixed();

    console.log(
      `- TextDao#${CREATE_PROPOSAL}(): proposal-id = ${proposalId}\n`
    );

    return proposalId;
  };

  createContractUpgradeProposal = async (
    title: string,
    proxyContract: string,
    contractToUpgrade: string,
    client: Client = clientsInfo.operatorClient,
    description: string = DEFAULT_DESCRIPTION,
    link: string = DEFAULT_LINK
  ) => {
    const args = new ContractFunctionParameters()
      .addString(title)
      .addString(description)
      .addString(link)
      .addAddress(proxyContract)
      .addAddress(contractToUpgrade);

    const { result } = await this.execute(
      1_000_000,
      CREATE_CONTRACT_UPGRADE_PROPOSAL,
      client,
      args,
      clientsInfo.operatorKey
    );

    const proposalId = result.getUint256(0).toFixed();

    console.log(
      `- ContractUpgradeDao#${CREATE_PROPOSAL}(): proposal-id = ${proposalId}\n`
    );

    return proposalId;
  };

  getTokenTransferProposals = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters();
    const { result } = await this.execute(
      9000000,
      GET_TOKEN_TRANSFER_PROPOSALS,
      client,
      args
    );
    const proposalIds = Helper.getUint256Array(result);
    console.log(
      `- FTDAO#${GET_TOKEN_TRANSFER_PROPOSALS}(): proposal-id = ${proposalIds} length = ${proposalIds.length}}\n`
    );
  };

  getGovernorTokenTransferContractAddresses = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    const { result } = await this.execute(
      2000000,
      GET_GOVERNOR_TOKEN_TRANSFER_CONTRACT_ADDRESSES,
      client
    );
    const addresses = {
      governorTokenTransferProxy: result.getAddress(0),
      governorTextProposalProxy: result.getAddress(1),
      governorUpgradeProxy: result.getAddress(2),
      governorTokenCreateProxy: result.getAddress(3),
      governorTokenTransferProxyId: ContractId.fromSolidityAddress(
        result.getAddress(0)
      ).toString(),
      governorTextProposalProxyId: ContractId.fromSolidityAddress(
        result.getAddress(1)
      ).toString(),
      governorUpgradeProxyId: ContractId.fromSolidityAddress(
        result.getAddress(2)
      ).toString(),
      governorTokenCreateProxyId: ContractId.fromSolidityAddress(
        result.getAddress(3)
      ).toString(),
    };
    console.table(addresses);
    return addresses;
  };
}
