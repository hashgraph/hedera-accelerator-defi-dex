import dex from "../../deployment/model/dex";
import BaseDao from "./BaseDao";
import Governor from "./Governor";
import GodHolder from "./GodHolder";
import NFTHolder from "./NFTHolder";

import { clientsInfo } from "../../utils/ClientManagement";
import {
  Client,
  TokenId,
  ContractId,
  ContractFunctionParameters,
  ContractExecuteTransaction,
} from "@hashgraph/sdk";
import { Helper } from "../../utils/Helper";

const INITIALIZE = "initialize";
const CREATE_PROPOSAL = "createProposal";
const GET_ALL_PROPOSALS = "getAllProposals";
const GET_GOVERNOR_ADDRESS = "getGovernorContractAddress";

export const DEFAULT_DESCRIPTION = "description";
export const DEFAULT_LINK = "https://defi-ui.hedera.com/governance";
export const DEFAULT_QUORUM_THRESHOLD_IN_BSP = 500;
export const DEFAULT_VOTING_DELAY = 0; // blocks
export const DEFAULT_VOTING_PERIOD = 100; // blocks means 3 minutes as per test
export const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
export const NFT_TOKEN_ID = TokenId.fromString(dex.NFT_TOKEN_ID);

export default class ContractUpgradeDao extends BaseDao {
  async initialize(
    admin: string,
    name: string,
    url: string,
    desc: string,
    webLinks: string[],
    contractUpgradeGovernor: Governor,
    tokenHolder: GodHolder | NFTHolder,
    client: Client = clientsInfo.operatorClient,
    defaultQuorumThresholdValue: number = DEFAULT_QUORUM_THRESHOLD_IN_BSP,
    votingDelay: number = DEFAULT_VOTING_DELAY,
    votingPeriod: number = DEFAULT_VOTING_PERIOD,
    tokenId: TokenId = GOD_TOKEN_ID,
    holderTokenId: TokenId = GOD_TOKEN_ID
  ) {
    console.log(
      `contractUpgradeGovernor ${contractUpgradeGovernor.contractId}`
    );
    await contractUpgradeGovernor.initialize(
      tokenHolder,
      client,
      defaultQuorumThresholdValue,
      votingDelay,
      votingPeriod,
      tokenId,
      holderTokenId
    );
    await this.initializeDAO(
      admin,
      name,
      url,
      desc,
      webLinks,
      contractUpgradeGovernor,
      client
    );
  }

  async initializeDAO(
    admin: string,
    name: string,
    url: string,
    desc: string,
    webLinks: string[],
    governor: Governor,
    client: Client = clientsInfo.operatorClient
  ) {
    if (await this.isInitializationPending()) {
      const governorId = governor.contractId;
      const governorAddress =
        ContractId.fromString(governorId).toSolidityAddress();
      console.log(`governorAddress ${governorAddress}`);
      const args = new ContractFunctionParameters()
        .addAddress(admin)
        .addString(name)
        .addString(url)
        .addString(desc)
        .addStringArray(webLinks)
        .addAddress(governorAddress);
      await this.execute(9_00_000, INITIALIZE, client, args);
      console.log(`- ContractUpgradeDao#${INITIALIZE}(): done\n`);
      return;
    }
    console.log(`- ContractUpgradeDao#${INITIALIZE}(): already done\n`);
  }

  createContractUpgradeProposal = async (
    title: string,
    proxyContract: string,
    contractToUpgrade: string,
    client: Client = clientsInfo.operatorClient,
    description: string = DEFAULT_DESCRIPTION,
    link: string = DEFAULT_LINK,
    governor: ContractId
  ) => {
    const args = new ContractFunctionParameters()
      .addString(title)
      .addString(description)
      .addString(link)
      .addAddress(proxyContract)
      .addAddress(contractToUpgrade);

    const { result } = await this.execute(
      1_000_000,
      CREATE_PROPOSAL,
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

  getAllProposals = async (client: Client = clientsInfo.operatorClient) => {
    const args = new ContractFunctionParameters();
    const { result } = await this.execute(
      9000000,
      GET_ALL_PROPOSALS,
      client,
      args
    );
    const proposalId = result.getUint256(0).toFixed();
    console.log(
      `- ContractUpgradeDao#${GET_ALL_PROPOSALS}(): proposal-id = ${proposalId}\n`
    );
  };

  getGovernorAddress = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(
      2000000,
      GET_GOVERNOR_ADDRESS,
      client
    );
    const address = result.getAddress(0);
    console.log(
      `- ContractUpgradeDao#${GET_GOVERNOR_ADDRESS}(): address = ${address}\n`
    );
    return ContractId.fromSolidityAddress(address);
  };
}
