import dex from "../../deployment/model/dex";
import Base from "./Base";
import Common from "./Common";
import NFTHolder from "./NFTHolder";
import GodHolder from "../../e2e-test/business/GodHolder";

import { Helper } from "../../utils/Helper";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import { AddressHelper } from "../../utils/AddressHelper";

import {
  Client,
  TokenId,
  AccountId,
  PrivateKey,
  ContractFunctionParameters,
} from "@hashgraph/sdk";

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
  TXN_FEE_FOR_TOKEN_CREATE = 75;
  protected GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
  protected DEFAULT_QUORUM_THRESHOLD_IN_BSP = 500;
  protected DEFAULT_VOTING_DELAY = 0; // blocks
  protected DEFAULT_VOTING_PERIOD = 100; // blocks means 3 minutes as per test
  protected DEFAULT_MAX_WAITING_TIME = this.DEFAULT_VOTING_PERIOD * 12 * 300;
  protected EACH_ITERATION_DELAY = this.DEFAULT_VOTING_PERIOD * 0.3 * 1000;
  DEFAULT_META_DATA = "metadata";
  DEFAULT_DESCRIPTION = "description";
  DEFAULT_LINK = "https://defi-ui.hedera.com/governance";

  protected INITIALIZE = "initialize";
  protected STATE = "state";
  protected CAST_VOTE = "castVotePublic";

  protected QUORUM_REACHED = "quorumReached";
  protected VOTE_SUCCEEDED = "voteSucceeded";
  protected PROPOSAL_VOTES = "proposalVotes";

  protected CREATE_PROPOSAL = "createProposal";
  protected CANCEL_PROPOSAL = "cancelProposal";
  protected EXECUTE_PROPOSAL = "executeProposal";
  protected PROPOSAL_DETAILS = "getProposalDetails";

  protected GET_CONTRACT_ADDRESSES = "getContractAddresses";
  protected GET_TOKEN_ADDRESSES = "getTokenAddress";
  protected GET_GOD_TOKEN_ADDRESSES = "getGODTokenAddress";
  protected MINT_TOKEN = "mintToken";
  protected BURN_TOKEN = "burnToken";
  protected TRANSFER_TOKEN = "transferToken";
  protected QUORUM = "quorum";
  DEFAULT_NFT_TOKEN_FOR_TRANSFER = 18;
  DEFAULT_NFT_TOKEN_SERIAL_NO = 19;
  DEFAULT_NFT_TOKEN_SERIAL_NO_FOR_VOTING = 20;

  async initialize(
    tokenHolder: GodHolder | NFTHolder,
    client: Client = clientsInfo.operatorClient,
    defaultQuorumThresholdValue: number = this.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
    votingDelay: number = this.DEFAULT_VOTING_DELAY,
    votingPeriod: number = this.DEFAULT_VOTING_PERIOD,
    governorTokenId: TokenId = this.GOD_TOKEN_ID,
    holderTokenId: TokenId = this.GOD_TOKEN_ID,
  ) {
    await tokenHolder.initialize(client, holderTokenId.toSolidityAddress());

    const godHolderProxyAddress = await AddressHelper.idToEvmAddress(
      tokenHolder.contractId,
    );

    if (await this.isInitializationPending()) {
      const args = new ContractFunctionParameters()
        .addAddress(governorTokenId.toSolidityAddress())
        .addUint256(votingDelay)
        .addUint256(votingPeriod)
        .addAddress(this.htsAddress)
        .addAddress(godHolderProxyAddress)
        .addUint256(defaultQuorumThresholdValue)
        .addAddress(this.getSystemBasedRoleAccessContractAddress());
      await this.execute(1_500_000, this.INITIALIZE, client, args);
      console.log(`- Governor#${this.INITIALIZE}(): done\n`);
      return;
    }
    console.log(`- Governor#${this.INITIALIZE}(): already done\n`);
  }

  protected getContractName() {
    return "Governor";
  }

  againstVote = async (
    proposalId: string,
    tokenId: number,
    client: Client = clientsInfo.operatorClient,
  ) => await this.vote(proposalId, 0, tokenId, client);

  forVote = async (
    proposalId: string,
    tokenId: number,
    client: Client = clientsInfo.operatorClient,
  ) => await this.vote(proposalId, 1, tokenId, client);

  abstainVote = async (
    proposalId: string,
    tokenId: number,
    client: Client = clientsInfo.operatorClient,
  ) => await this.vote(proposalId, 2, tokenId, client);

  vote = async (
    proposalId: string,
    support: number,
    tokenId: number,
    client: Client,
  ) => {
    const args = this.createParams(proposalId)
      .addUint256(BigNumber(tokenId))
      .addUint8(support);
    await this.execute(5_00_000, this.CAST_VOTE, client, args);
    console.log(
      `- Governor#${this.CAST_VOTE}(): proposal-id = ${proposalId}, support = ${support}\n`,
    );
  };

  public quorum = async (client: Client = clientsInfo.operatorClient) => {
    const args = new ContractFunctionParameters().addUint256(0);
    const { result } = await this.execute(80_000, this.QUORUM, client, args);
    const quorum = result.getUint256(0);
    console.log(`- Governor#${this.QUORUM}(): quorum = ${quorum}\n`);
    return quorum.toNumber();
  };

  getGODTokenAddress = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(
      2_00_000,
      this.GET_GOD_TOKEN_ADDRESSES,
      client,
    );
    const address = result.getAddress(0);
    console.log(
      `- Governor#${this.GET_GOD_TOKEN_ADDRESSES}(): GOD token address = ${address}\n`,
    );
    return TokenId.fromSolidityAddress(address);
  };

  isQuorumReached = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = this.createParams(proposalId);
    const { result } = await this.execute(
      5_00_000,
      this.QUORUM_REACHED,
      client,
      args,
    );
    const isQuorumReached = result.getBool(0);
    console.log(
      `- Governor#${this.QUORUM_REACHED}(): proposal-id = ${proposalId}, isQuorumReached = ${isQuorumReached}\n`,
    );
    return isQuorumReached;
  };

  isVoteSucceeded = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = this.createParams(proposalId);
    const { result } = await this.execute(
      5_00_000,
      this.VOTE_SUCCEEDED,
      client,
      args,
    );
    const isVoteSucceeded = result.getBool(0);
    console.log(
      `- Governor#${this.VOTE_SUCCEEDED}(): proposal-id = ${proposalId}, isVoteSucceeded = ${isVoteSucceeded}\n`,
    );
    return isVoteSucceeded;
  };

  proposalVotes = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = this.createParams(proposalId);
    const { result } = await this.execute(
      5_00_000,
      this.PROPOSAL_VOTES,
      client,
      args,
    );
    const against = result.getInt256(0);
    const forVote = result.getInt256(1);
    const abstain = result.getInt256(2);
    console.log(
      `- Governor#${this.PROPOSAL_VOTES}(): proposal-id = ${proposalId}, against = ${against}, forVote = ${forVote}, abstain = ${abstain}\n`,
    );
    return { against, forVote, abstain };
  };

  state = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = this.createParams(proposalId);
    const { result } = await this.execute(5_00_000, this.STATE, client, args);
    const state = result.getInt256(0);
    console.log(
      `- Governor#${this.STATE}(): proposal-id = ${proposalId}, state = ${state}\n`,
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
    client: Client = clientsInfo.operatorClient,
    fee: number = 0,
  ) => {
    const args = new ContractFunctionParameters().addString(title);
    const { receipt, result, record } = await this.execute(
      1_000_000,
      this.EXECUTE_PROPOSAL,
      client,
      args,
      fromPrivateKey,
      fee,
    );
    const proposalId = result.getUint256(0).toFixed();
    const txnId = record.transactionId.toString();
    console.log(
      `- Governor#${this.EXECUTE_PROPOSAL}(): proposal-id = ${proposalId}, status = ${receipt.status}, TxnId = ${txnId}\n`,
    );
    return receipt.status.toString() === "SUCCESS";
  };

  cancelProposal = async (title: string, client: Client) => {
    const args = new ContractFunctionParameters().addString(title);
    const { result } = await this.execute(
      9_00_000,
      this.CANCEL_PROPOSAL,
      client,
      args,
    );
    const proposalId = result.getUint256(0).toFixed();
    console.log(
      `- Governor#${this.CANCEL_PROPOSAL}(): proposal-id = ${proposalId}\n`,
    );
  };

  getProposalDetails = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = this.createParams(proposalId);
    const { result } = await this.execute(
      5_00_000,
      this.PROPOSAL_DETAILS,
      client,
      args,
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
    console.log(`- Governor#${this.PROPOSAL_DETAILS}():`);
    console.table(info);
    console.log("");
    return info;
  };

  getVotes = async (client: Client = clientsInfo.operatorClient) => {
    const args = new ContractFunctionParameters()
      .addAddress(clientsInfo.operatorId.toSolidityAddress())
      .addUint256(0);

    const { result } = await this.execute(5_00_000, "getVotes", client, args);
    const votingPower = result.getUint256(0);
    console.log(
      `- GovernorTokenCreate#${this.GET_TOKEN_ADDRESSES}(): votingPower = ${votingPower}\n`,
    );
    return votingPower;
  };

  protected createParams(proposalId: string) {
    return new ContractFunctionParameters().addUint256(BigNumber(proposalId));
  }

  async setupAllowanceForProposalCreation(
    creatorClient: Client,
    creatorAccountId: AccountId,
    creatorPrivateKey: PrivateKey,
  ) {
    const godTokenId = await this.getGODTokenAddress();
    await Common.setTokenAllowance(
      godTokenId,
      this.contractId,
      1e8,
      creatorAccountId,
      creatorPrivateKey,
      creatorClient,
    );
  }

  async setupNFTAllowanceForProposalCreation(
    creatorClient: Client,
    creatorAccountId: AccountId,
    creatorPrivateKey: PrivateKey,
  ) {
    const godTokenId = await this.getGODTokenAddress();
    await Common.setNFTTokenAllowance(
      godTokenId,
      this.contractId,
      creatorAccountId,
      creatorPrivateKey,
      creatorClient,
    );
  }

  async setAllowanceForTransferTokenProposal(
    tokenId: TokenId,
    tokenAmount: number,
    spenderAccountId: string | AccountId,
    tokenSenderAccountId: string | AccountId,
    tokenSenderPrivateKey: PrivateKey,
    client: Client = clientsInfo.operatorClient,
  ) {
    await Common.setTokenAllowance(
      tokenId,
      spenderAccountId,
      tokenAmount,
      tokenSenderAccountId,
      tokenSenderPrivateKey,
      client,
    );
  }

  public getStateWithTimeout = async (
    proposalId: string,
    requiredState: number,
    maxWaitInMs: number = this.DEFAULT_MAX_WAITING_TIME,
    eachIterationDelayInMS: number = this.EACH_ITERATION_DELAY,
    client: Client = clientsInfo.operatorClient,
  ): Promise<number> => {
    console.log(
      `- Governor#getStateWithTimeout(): called with maxWaitInMs = ${maxWaitInMs}, eachIterationDelayInMS = ${eachIterationDelayInMS}, requiredState = ${requiredState}, proposal-id = ${proposalId}\n`,
    );
    let currentState = -1;
    const maxWaitInMsInternally = maxWaitInMs;
    while (maxWaitInMs > 0) {
      try {
        currentState = Number(await this.state(proposalId, client));
        if (currentState === requiredState) {
          console.log(
            `- Governor#getStateWithTimeout(): succeeded where total waiting time = ${
              maxWaitInMsInternally - maxWaitInMs
            } ms\n`,
          );
          break;
        }
        if (currentState === ProposalState.Defeated) {
          console.log(
            `- Governor#getStateWithTimeout(): defeated where total waiting time = ${
              maxWaitInMsInternally - maxWaitInMs
            } ms\n`,
          );
          break;
        }
      } catch (e: any) {
        console.log(
          `- Governor#getStateWithTimeout(): failed and ms left = ${maxWaitInMs}`,
          e,
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
