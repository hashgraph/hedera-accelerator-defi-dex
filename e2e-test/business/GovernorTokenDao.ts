import Base from "./Base";
import GodHolder from "../../e2e-test/business/GodHolder";
import { clientsInfo } from "../../utils/ClientManagement";
import { BigNumber } from "bignumber.js";

import { Client, ContractId, ContractFunctionParameters } from "@hashgraph/sdk";
import Governor from "./Governor";

const INITIALIZE = "initialize";
const CREATE_PROPOSAL = "createProposal";
const GET_ALL_PROPOSALS = "getAllProposals";
const ADD_WEB_LINK = "addWebLink";
const GET_DAO_DETAILS = "getDaoDetail";
const GET_WEB_LINKS = "getWebLinks";
const GET_GOVERNOR_TOKEN_TRANSFER_CONTRACT_ADDRESS =
  "getGovernorTokenTransferContractAddress";

const DEFAULT_DESCRIPTION = "description";
const DEFAULT_LINK = "https://defi-ui.hedera.com/governance";
const DEFAULT_QUORUM_THRESHOLD_IN_BSP = 500;
const DEFAULT_VOTING_DELAY = 0; // blocks
const DEFAULT_VOTING_PERIOD = 100; // blocks means 3 minutes as per test

export default class GovernorTokenDao extends Base {
  async initialize(
    admin: string,
    name: string,
    url: string,
    governor: Governor,
    godHolder: GodHolder,
    client: Client = clientsInfo.operatorClient,
    defaultQuorumThresholdValue: number = DEFAULT_QUORUM_THRESHOLD_IN_BSP,
    votingDelay: number = DEFAULT_VOTING_DELAY,
    votingPeriod: number = DEFAULT_VOTING_PERIOD
  ) {
    try {
      await governor.initialize(
        godHolder,
        client,
        defaultQuorumThresholdValue,
        votingDelay,
        votingPeriod
      );
    } catch (error) {}

    try {
      await this.initializeInternally(
        admin,
        name,
        url,
        ContractId.fromString(governor.contractId).toSolidityAddress(),
        client
      );
      console.log("Initialize done");
    } catch (error) {}
  }

  private initializeInternally = async (
    admin: string,
    name: string,
    url: string,
    governorTokenTransfer: string,
    client: Client
  ) => {
    const args = new ContractFunctionParameters()
      // token that define the voting weight, to vote user should have % of this token.
      .addAddress(admin)
      .addString(name)
      .addString(url)
      .addAddress(governorTokenTransfer);
    await this.execute(900000, INITIALIZE, client, args);
    console.log(`- GovernorTokenDao#${INITIALIZE}(): done\n`);
  };

  createTokenTransferProposal = async (
    title: string,
    fromAddress: string,
    toAddress: string,
    tokenId: string,
    tokenAmount: number,
    client: Client = clientsInfo.uiUserClient,
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
      .addInt256(BigNumber(tokenAmount)); // amountToTransfer
    const { result } = await this.execute(
      9999999,
      CREATE_PROPOSAL,
      client,
      args,
      clientsInfo.operatorKey
    );
    const proposalId = result.getUint256(0).toFixed();
    console.log(
      `- GovernorTokenDao#${CREATE_PROPOSAL}(): proposal-id = ${proposalId}\n`
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
      `- GovernorTokenDao#${GET_ALL_PROPOSALS}(): proposal-id = ${proposalId}\n`
    );
  };

  addWebLink = async (
    webLinkName: string = "GIT",
    webLink: string = "git_url",
    client: Client = clientsInfo.uiUserClient
  ) => {
    const args = new ContractFunctionParameters()
      .addString(webLinkName)
      .addString(webLink);

    const { result } = await this.execute(9000000, ADD_WEB_LINK, client, args);
    console.log(`- GovernorTokenDao#${ADD_WEB_LINK}()\n`);
  };

  getDaoDetail = async (client: Client = clientsInfo.operatorClient) => {
    const args = new ContractFunctionParameters();
    const { result } = await this.execute(
      9000000,
      GET_DAO_DETAILS,
      client,
      args
    );
    const name = result.getString(0);
    const logoUrl = result.getString(1);
    console.log(
      `- GovernorTokenDao#${GET_DAO_DETAILS}(): name = ${name}\nlogoUrls: ${logoUrl}`
    );
  };

  getWebLinks = async (client: Client = clientsInfo.operatorClient) => {
    const args = new ContractFunctionParameters();
    const { result } = await this.execute(9000000, GET_WEB_LINKS, client, args);
    const link = result.getString(1);
    console.log(
      `${result.getString(0)}\n${result.getString(1)}\n${result.getString(
        2
      )}\n${result.getString(3)}\n${result.getString(4)}`
    );
    console.log(`- GovernorTokenDao#${GET_WEB_LINKS}(): link = ${link}\n`);
  };

  getGovernorTokenTransferContractAddress = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    const { result } = await this.execute(
      2000000,
      GET_GOVERNOR_TOKEN_TRANSFER_CONTRACT_ADDRESS,
      client
    );
    const address = result.getAddress(0);
    console.log(
      `- GovernorTokenDao#${GET_GOVERNOR_TOKEN_TRANSFER_CONTRACT_ADDRESS}(): address = ${address}\n`
    );
    return ContractId.fromSolidityAddress(address);
  };
}
