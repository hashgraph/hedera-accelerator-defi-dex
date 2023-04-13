import dex from "../../deployment/model/dex";
import Base from "./Base";
import GodHolder from "../../e2e-test/business/GodHolder";

import { Helper } from "../../utils/Helper";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";

import {
  Client,
  TokenId,
  PublicKey,
  AccountId,
  PrivateKey,
  ContractId,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import NFTHolder from "./NFTHolder";

const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
const DEFAULT_QUORUM_THRESHOLD_IN_BSP = 500;
const DEFAULT_VOTING_DELAY = 0; // blocks
const DEFAULT_VOTING_PERIOD = 100; // blocks means 3 minutes as per test
const DEFAULT_MAX_WAITING_TIME = DEFAULT_VOTING_PERIOD * 12 * 300;
const EACH_ITERATION_DELAY = DEFAULT_VOTING_PERIOD * 0.3 * 1000;
const DEFAULT_DESCRIPTION = "description";
const DEFAULT_LINK = "https://defi-ui.hedera.com/governance";

const INITIALIZE = "initialize";
const STATE = "state";
const CAST_VOTE = "castVotePublic";

const QUORUM_REACHED = "quorumReached";
const VOTE_SUCCEEDED = "voteSucceeded";
const PROPOSAL_VOTES = "proposalVotes";

const CREATE_PROPOSAL = "createProposal";
const CANCEL_PROPOSAL = "cancelProposal";
const EXECUTE_PROPOSAL = "executeProposal";
const PROPOSAL_DETAILS = "getProposalDetails";

const GET_CONTRACT_ADDRESSES = "getContractAddresses";
const GET_TOKEN_ADDRESSES = "getTokenAddress";
const GET_GOD_TOKEN_ADDRESSES = "getGODTokenAddress";

enum ProposalState {
  Pending,
  Active,
  Canceled,
  Defeated,
  Succeeded,
  Queued,
  Expired,
  Executed,
}

enum VoteType {
  Against,
  For,
  Abstain,
}

export default class Governor extends Base {
  async initialize(
    tokenHolder: GodHolder | NFTHolder,
    client: Client = clientsInfo.operatorClient,
    defaultQuorumThresholdValue: number = DEFAULT_QUORUM_THRESHOLD_IN_BSP,
    votingDelay: number = DEFAULT_VOTING_DELAY,
    votingPeriod: number = DEFAULT_VOTING_PERIOD,
    tokenId: TokenId = GOD_TOKEN_ID
  ) {
    await tokenHolder.initialize(client, tokenId.toSolidityAddress());

    const godHolderContractId = tokenHolder.contractId;
    const godHolderProxyAddress =
      ContractId.fromString(godHolderContractId).toSolidityAddress();

    if (await this.isInitializationPending("GovernorCountingSimpleInternal")) {
      const args = new ContractFunctionParameters()
        .addAddress(tokenId.toSolidityAddress())
        .addUint256(votingDelay)
        .addUint256(votingPeriod)
        .addAddress(this.htsAddress)
        .addAddress(godHolderProxyAddress)
        .addUint256(defaultQuorumThresholdValue);
      await this.execute(1_000_000, INITIALIZE, client, args);
      console.log(`- Governor#${INITIALIZE}(): done\n`);
      return;
    }
    console.log(`- Governor#${INITIALIZE}(): already done\n`);
  }

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
      9000000,
      CREATE_PROPOSAL,
      client,
      args
    );
    const proposalId = result.getUint256(0).toFixed();
    console.log(
      `- Governor#${CREATE_PROPOSAL}(): proposal-id = ${proposalId}  proposal-title = ${title}\n`
    );
    return proposalId;
  };

  createTokenTransferProposal = async (
    title: string,
    fromAddress: string,
    toAddress: string,
    tokenId: string,
    tokenAmount: number,
    client: Client = clientsInfo.operatorClient,
    description: string = DEFAULT_DESCRIPTION,
    link: string = DEFAULT_LINK,
    creater: string = clientsInfo.operatorId.toSolidityAddress()
  ) => {
    const args = new ContractFunctionParameters()
      .addString(title)
      .addString(description)
      .addString(link)
      .addAddress(fromAddress) // from
      .addAddress(toAddress) // to
      .addAddress(tokenId) // tokenToTransfer
      .addInt256(BigNumber(tokenAmount)) // amountToTransfer
      .addAddress(creater); // proposal creater
    const { result } = await this.execute(
      9000000,
      CREATE_PROPOSAL,
      client,
      args
    );
    const proposalId = result.getUint256(0).toFixed();
    console.log(
      `- Governor#${CREATE_PROPOSAL}(): proposal-id = ${proposalId}\n`
    );
    return proposalId;
  };

  createContractUpgradeProposal = async (
    targetProxyId: ContractId,
    targetLogicId: ContractId,
    title: string,
    client: Client = clientsInfo.operatorClient,
    description: string = DEFAULT_DESCRIPTION,
    link: string = DEFAULT_LINK
  ) => {
    const args = new ContractFunctionParameters()
      .addString(title)
      .addString(description)
      .addString(link)
      .addAddress(targetProxyId.toSolidityAddress())
      .addAddress(targetLogicId.toSolidityAddress());

    const { result, receipt } = await this.execute(
      9000000,
      CREATE_PROPOSAL,
      client,
      args
    );
    const proposalId = result.getUint256(0).toFixed();
    const success = receipt.status.toString().toLowerCase() === "success";
    console.log(
      `- Governor#${CREATE_PROPOSAL}(): proposal-id = ${proposalId}\n`
    );
    return {
      proposalId,
      success,
    };
  };

  againstVote = async (
    proposalId: string,
    tokenId: number,
    client: Client = clientsInfo.operatorClient
  ) => await this.vote(proposalId, 0, tokenId, client);

  forVote = async (
    proposalId: string,
    tokenId: number,
    client: Client = clientsInfo.operatorClient
  ) => await this.vote(proposalId, 1, tokenId, client);

  abstainVote = async (
    proposalId: string,
    tokenId: number,
    client: Client = clientsInfo.operatorClient
  ) => await this.vote(proposalId, 2, tokenId, client);

  vote = async (
    proposalId: string,
    support: number,
    tokenId: number,
    client: Client
  ) => {
    const args = this.createParams(proposalId)
      .addUint256(BigNumber(tokenId))
      .addUint8(support);
    await this.execute(9900000, CAST_VOTE, client, args);
    console.log(
      `- Governor#${CAST_VOTE}(): proposal-id = ${proposalId}, support = ${support}\n`
    );
  };

  getGODTokenAddress = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(
      200000,
      GET_GOD_TOKEN_ADDRESSES,
      client
    );
    const address = result.getAddress(0);
    console.log(
      `- Governor#${GET_GOD_TOKEN_ADDRESSES}(): GOD token address = ${address}\n`
    );
    return TokenId.fromSolidityAddress(address);
  };

  isQuorumReached = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = this.createParams(proposalId);
    const { result } = await this.execute(500000, QUORUM_REACHED, client, args);
    const isQuorumReached = result.getBool(0);
    console.log(
      `- Governor#${QUORUM_REACHED}(): proposal-id = ${proposalId}, isQuorumReached = ${isQuorumReached}\n`
    );
    return isQuorumReached;
  };

  isVoteSucceeded = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = this.createParams(proposalId);
    const { result } = await this.execute(500000, VOTE_SUCCEEDED, client, args);
    const isVoteSucceeded = result.getBool(0);
    console.log(
      `- Governor#${VOTE_SUCCEEDED}(): proposal-id = ${proposalId}, isVoteSucceeded = ${isVoteSucceeded}\n`
    );
    return isVoteSucceeded;
  };

  proposalVotes = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = this.createParams(proposalId);
    const { result } = await this.execute(500000, PROPOSAL_VOTES, client, args);
    const against = result.getInt256(0);
    const forVote = result.getInt256(1);
    const abstain = result.getInt256(2);
    console.log(
      `- Governor#${PROPOSAL_VOTES}(): proposal-id = ${proposalId}, against = ${against}, forVote = ${forVote}, abstain = ${abstain}\n`
    );
    return { against, forVote, abstain };
  };

  state = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = this.createParams(proposalId);
    const { result } = await this.execute(500000, STATE, client, args);
    const state = result.getInt256(0);
    console.log(
      `- Governor#${STATE}(): proposal-id = ${proposalId}, state = ${state}\n`
    );
    return state;
  };

  isSucceeded = async (proposalId: string, requiredState: number = 4) => {
    const state = await this.getStateWithTimeout(proposalId, requiredState);
    return requiredState === state;
  };

  executeProposal = async (
    title: string,
    fromPrivateKey: PrivateKey | PrivateKey[] | undefined = undefined,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addString(title);
    const { receipt, result } = await this.execute(
      999999,
      EXECUTE_PROPOSAL,
      client,
      args,
      fromPrivateKey,
      70
    );
    const proposalId = result.getUint256(0).toFixed();
    console.log(
      `- Governor#${EXECUTE_PROPOSAL}(): proposal-id = ${proposalId}, status = ${receipt.status}\n`
    );
    return receipt.status.toString() === "SUCCESS";
  };

  cancelProposal = async (title: string, client: Client) => {
    const args = new ContractFunctionParameters().addString(title);
    const { result } = await this.execute(
      900000,
      CANCEL_PROPOSAL,
      client,
      args
    );
    const proposalId = result.getUint256(0).toFixed();
    console.log(
      `- Governor#${CANCEL_PROPOSAL}(): proposal-id = ${proposalId}\n`
    );
  };

  getProposalDetails = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = this.createParams(proposalId);
    const { result } = await this.execute(
      500000,
      PROPOSAL_DETAILS,
      client,
      args
    );
    const quorumValue = result.getUint256(0).toFixed();
    const isQuorumReached = result.getBool(1);
    const proposalState = result.getUint256(2).toFixed();
    const voted = result.getBool(3);
    const againstVotes = result.getUint256(4).toFixed();
    const forVotes = result.getUint256(5).toFixed();
    const abstainVotes = result.getUint256(6).toFixed();
    const creator = result.getAddress(7);
    const title = result.getString(8);
    const description = result.getString(9);
    const link = result.getString(10);

    const info = {
      proposalId,
      quorumValue,
      isQuorumReached,
      proposalState,
      voted,
      againstVotes,
      forVotes,
      abstainVotes,
      creator,
      title,
      description,
      link,
    };
    console.log(`- Governor#${PROPOSAL_DETAILS}():`);
    console.table(info);
    return info;
  };

  getContractAddressesFromGovernorUpgradeContract = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = this.createParams(proposalId);
    const { result } = await this.execute(
      500000,
      GET_CONTRACT_ADDRESSES,
      client,
      args
    );
    const proxyAddress = result.getAddress(0);
    const logicAddress = result.getAddress(1);
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
      `- Governor#${GET_CONTRACT_ADDRESSES}(): proxyAddress = ${proxyAddress}, logicAddress = ${logicAddress}\n`
    );
    return response;
  };

  createTokenProposal = async (
    title: string,
    tokenName: string,
    tokenSymbol: string,
    tokenTreasureId: AccountId,
    tokenTreasurePublicKey: PublicKey,
    tokenAdminId: AccountId,
    tokenAdminPublicKey: PublicKey,
    client: Client = clientsInfo.operatorClient,
    description: string = DEFAULT_DESCRIPTION,
    link: string = DEFAULT_LINK
  ) => {
    const args = new ContractFunctionParameters()
      .addString(title)
      .addString(description)
      .addString(link)
      .addAddress(tokenTreasureId.toSolidityAddress())
      .addBytes(tokenTreasurePublicKey.toBytes())
      .addAddress(tokenAdminId.toSolidityAddress())
      .addBytes(tokenAdminPublicKey.toBytes())
      .addString(tokenName)
      .addString(tokenSymbol);

    const { result } = await this.execute(
      9000000,
      CREATE_PROPOSAL,
      client,
      args
    );
    const proposalId = result.getUint256(0).toFixed();
    console.log(
      `- GovernorTokenCreate#${CREATE_PROPOSAL}(): proposal-id = ${proposalId}\n`
    );
    return proposalId;
  };

  getTokenAddressFromGovernorTokenCreate = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = this.createParams(proposalId);
    const { result } = await this.execute(
      500000,
      GET_TOKEN_ADDRESSES,
      client,
      args
    );
    const tokenAddress = result.getAddress(0);
    console.log(
      `- GovernorTokenCreate#${GET_TOKEN_ADDRESSES}(): token-address = ${tokenAddress}\n`
    );
    return TokenId.fromSolidityAddress(tokenAddress);
  };

  private createParams(proposalId: string) {
    return new ContractFunctionParameters().addUint256(BigNumber(proposalId));
  }

  public getStateWithTimeout = async (
    proposalId: string,
    requiredState: number,
    maxWaitInMs: number = DEFAULT_MAX_WAITING_TIME,
    eachIterationDelayInMS: number = EACH_ITERATION_DELAY,
    client: Client = clientsInfo.operatorClient
  ): Promise<number> => {
    console.log(
      `- Governor#getStateWithTimeout(): called with maxWaitInMs = ${maxWaitInMs}, eachIterationDelayInMS = ${eachIterationDelayInMS}, requiredState = ${requiredState}, proposal-id = ${proposalId}\n`
    );
    let currentState = -1;
    const maxWaitInMsInternally = maxWaitInMs;
    while (maxWaitInMs > 0) {
      try {
        currentState = Number(await this.state(proposalId, client));
        if (currentState === requiredState) {
          console.log(
            `- Governor#getStateWithTimeout(): succeeded where total waiting time = ${maxWaitInMsInternally - maxWaitInMs
            } ms\n`
          );
          break;
        }
        if (currentState === ProposalState.Defeated) {
          console.log(
            `- Governor#getStateWithTimeout(): defeated where total waiting time = ${
              maxWaitInMsInternally - maxWaitInMs
            } ms\n`
          );
          break;
        }
      } catch (e: any) {
        console.log(
          `- Governor#getStateWithTimeout(): failed and ms left = ${maxWaitInMs}`,
          e
        );
      }
      await Helper.delay(eachIterationDelayInMS);
      maxWaitInMs -= eachIterationDelayInMS;
    }
    console.log(`- Governor#getStateWithTimeout(): done\n`);
    return currentState;
  };

  getProposalNumericState = async (proposalState: string) => {
    return Object.values(ProposalState).indexOf(proposalState);
  };

  getProposalVoteNumeric = async (vote: string): Promise<number> => {
    return Object.values(VoteType).indexOf(vote);
  };
}
