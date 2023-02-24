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

const DEFAULT_DESCRIPTION = "description";
const DEFAULT_LINK = "https://defi-ui.hedera.com/governance";

export default class GovernorTokenDao extends Base {
  async initialize(
    admin: string,
    name: string,
    url: string,
    governor: Governor,
    godHolder: GodHolder,
    client: Client = clientsInfo.operatorClient
  ) {
    try {
      await governor.initialize(godHolder);
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
      `- GovernorTokenDap#${CREATE_PROPOSAL}(): proposal-id = ${proposalId}\n`
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
      `- GovernorTokenDap#${GET_ALL_PROPOSALS}(): proposal-id = ${proposalId}\n`
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
    console.log(`- GovernorTokenDap#${ADD_WEB_LINK}()\n`);
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
      `- GovernorTokenDap#${GET_DAO_DETAILS}(): name = ${name}\nlogoUrls: ${logoUrl}`
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
    console.log(`- GovernorTokenDap#${GET_WEB_LINKS}(): link = ${link}\n`);
  };
}
