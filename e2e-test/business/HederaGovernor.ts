import dex from "../../deployment/model/dex";
import Base from "./Base";
import Common from "./Common";
import NFTHolder from "../../e2e-test/business/NFTHolder";
import GodHolder from "../../e2e-test/business/GodHolder";
import * as AssetsHolderProps from "../../e2e-test/business/AssetsHolder";

import { ethers } from "ethers";
import { Helper } from "../../utils/Helper";
import { BigNumber } from "bignumber.js";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { AddressHelper } from "../../utils/AddressHelper";
import { ContractService } from "../../deployment/service/ContractService";
import { MirrorNodeService } from "../../utils/MirrorNodeService";
import {
  Client,
  TokenId,
  AccountId,
  PrivateKey,
  ContractFunctionResult,
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

export interface ProposalInfo {
  proposalId: string;
  creator: string;
  voteStart: string;
  voteEnd: string;
  blockedAmountOrId: string;

  proposalType: string;
  title: string;
  description: string;
  discussionLink: string;
  metadata: string;
  amountOrId: string;
  targets: string[];
  values: string[];
  calldatas: string[];
}

export default class HederaGovernor extends Base {
  DEFAULT_META_DATA = "metadata";
  DEFAULT_DESCRIPTION = "description";
  DEFAULT_LINK = "https://defi-ui.hedera.com/governance";
  TXN_FEE_FOR_TOKEN_CREATE = 20;
  DEFAULT_NFT_TOKEN_FOR_TRANSFER = 18;
  DEFAULT_NFT_TOKEN_SERIAL_NO = 19;
  DEFAULT_NFT_TOKEN_SERIAL_NO_FOR_VOTING = 20;

  protected GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
  protected DEFAULT_QUORUM_THRESHOLD_IN_BSP = 500;
  protected DEFAULT_VOTING_DELAY = 0; // seconds
  protected DEFAULT_VOTING_PERIOD = 50; // 50_000 ms  // 50 sec
  protected DEFAULT_MAX_WAITING_TIME = this.DEFAULT_VOTING_PERIOD * 2 * 1000; // 100_000 ms // 100 sec
  protected EACH_ITERATION_DELAY = this.DEFAULT_VOTING_PERIOD * 0.1 * 1000; // 10_000 ms // 5 sec

  protected INITIALIZE = "initialize";

  protected QUORUM = "quorum";
  protected STATE = "state";
  protected CAST_VOTE = "castVote";
  protected GET_VOTING_INFORMATION = "getVotingInformation";

  protected CREATE_PROPOSAL = "createProposal";
  protected CANCEL_PROPOSAL = "cancel";
  protected EXECUTE_PROPOSAL = "execute";

  protected HEDERA_SERVICE = "getHederaServiceVersion";
  protected GET_CONTRACT_ADDRESSES = "getContractAddresses";
  protected GET_TOKEN_ADDRESSES = "getTokenAddress";
  protected GET_GOD_TOKEN_ADDRESSES = "getGODTokenAddress";
  protected TOKEN_HOLDER_CONTRACT_ADDRESS = "getTokenHolderContractAddress";
  protected ASSET_HOLDER_CONTRACT_ADDRESS = "getAssetHolderContractAddress";

  protected getContractName() {
    return ContractService.HEDERA_GOVERNOR;
  }

  public async initialize(
    tokenHolder: GodHolder | NFTHolder,
    client: Client = clientsInfo.operatorClient,
    quorumThresholdValue: number = this.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
    votingDelay: number = this.DEFAULT_VOTING_DELAY,
    votingPeriod: number = this.DEFAULT_VOTING_PERIOD,
    holderTokenId: TokenId = this.GOD_TOKEN_ID,
  ) {
    await tokenHolder.initialize(client, holderTokenId.toSolidityAddress());

    const tokenHolderProxyAddress = await AddressHelper.idToEvmAddress(
      tokenHolder.contractId,
    );

    if (await this.isInitializationPending()) {
      const assetHolderInfo = await new Deployment().deployProxy(
        ContractService.ASSET_HOLDER,
      );
      const data = await this.encodeFunctionData(
        this.getContractName(),
        this.INITIALIZE,
        Object.values({
          _config: Object.values({
            votingDelay,
            votingPeriod,
            quorumThresholdInBsp: quorumThresholdValue,
          }),
          _iTokenHolder: tokenHolderProxyAddress,
          _iAssetsHolder: assetHolderInfo.transparentProxyAddress,
          _iHederaService: this.htsAddress,
          _iSystemRoleBasedAccess:
            this.getSystemBasedRoleAccessContractAddress(),
        }),
      );
      await this.execute(2_000_000, this.INITIALIZE, client, data.bytes);
      console.log(`- Governor#${this.INITIALIZE}(): done ${this.contractId}\n`);
      return;
    }
    console.log(
      `- Governor#${this.INITIALIZE}(): already done ${this.contractId}\n`,
    );
  }

  public quorum = async (client: Client = clientsInfo.operatorClient) => {
    const args = new ContractFunctionParameters().addUint256(0);
    const { result } = await this.execute(80_000, this.QUORUM, client, args);
    const quorum = result.getUint256(0);
    console.log(`- Governor#${this.QUORUM}(): quorum = ${quorum}\n`);
    return quorum.toNumber();
  };

  public getGODTokenAddress = async (
    client: Client = clientsInfo.operatorClient,
  ) => {
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

  public getAssetHolderContractAddressInfo = async (
    client: Client = clientsInfo.operatorClient,
  ) => {
    const { result } = await this.execute(
      1_00_000,
      this.ASSET_HOLDER_CONTRACT_ADDRESS,
      client,
    );
    const contractEvmAddress = result.getAddress(0);
    const contractId = await AddressHelper.addressToId(contractEvmAddress);
    console.log(
      `- Governor#${this.ASSET_HOLDER_CONTRACT_ADDRESS}(): id = ${contractId}, address = ${contractEvmAddress}\n`,
    );
    return { contractId, contractEvmAddress };
  };

  public getVotingInformation = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = this.createBaseParams(proposalId);
    const { result } = await this.execute(
      5_00_000,
      this.GET_VOTING_INFORMATION,
      client,
      args,
    );
    const quorumValue = result.getUint256(0).toFixed();
    const againstVotes = result.getUint256(1).toFixed();
    const forVotes = result.getUint256(2).toFixed();
    const abstainVotes = result.getUint256(3).toFixed();
    const isQuorumReached = result.getBool(4);
    const isVoteSucceeded = result.getBool(5);
    const voted = result.getBool(6);
    const proposalState = result.getUint256(7).toFixed();
    const info = {
      proposalId,
      proposalState,
      voted,
      isQuorumReached,
      isVoteSucceeded,
      quorumValue,
      forVotes,
      againstVotes,
      abstainVotes,
    };
    console.log(`- Governor#${this.GET_VOTING_INFORMATION}():`);
    console.table(info);
    console.log("");
    return info;
  };

  public state = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = this.createBaseParams(proposalId);
    const { result } = await this.execute(5_00_000, this.STATE, client, args);
    const state = result.getInt256(0);
    console.log(
      `- Governor#${this.STATE}(): proposal-id = ${proposalId}, state = ${state}\n`,
    );
    return state;
  };

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

  public createTokenAssociationProposal = async (
    tokenId: TokenId,
    title: string,
    client: Client = clientsInfo.operatorClient,
    description: string = this.DEFAULT_DESCRIPTION,
    discussionLink: string = this.DEFAULT_LINK,
    metadata: string = this.DEFAULT_META_DATA,
    amountOrId: number = this.DEFAULT_NFT_TOKEN_SERIAL_NO,
  ) => {
    const assetHolder = await this.getAssetHolderContractAddressInfo();
    const callData = await this.encodeFunctionData(
      ContractService.ASSET_HOLDER,
      AssetsHolderProps.ASSOCIATE,
      [tokenId.toSolidityAddress()],
    );
    return await this.createProposal(
      AssetsHolderProps.Type.ASSOCIATE,
      title,
      [assetHolder.contractEvmAddress],
      [0],
      [callData.bytes],
      client,
      description,
      discussionLink,
      metadata,
      amountOrId,
    );
  };

  public createAssetTransferProposal = async (
    receiverAddress: string,
    tokenAddress: string,
    amount: number,
    title: string,
    client: Client = clientsInfo.operatorClient,
    description: string = this.DEFAULT_DESCRIPTION,
    discussionLink: string = this.DEFAULT_LINK,
    metadata: string = this.DEFAULT_META_DATA,
    amountOrId: number = this.DEFAULT_NFT_TOKEN_SERIAL_NO,
  ) => {
    const assetHolder = await this.getAssetHolderContractAddressInfo();
    const callData = await this.encodeFunctionData(
      ContractService.ASSET_HOLDER,
      AssetsHolderProps.TRANSFER,
      [receiverAddress, tokenAddress, amount],
    );
    const proposalInfo = await this.createProposal(
      AssetsHolderProps.Type.TRANSFER,
      title,
      [assetHolder.contractEvmAddress],
      [0],
      [callData.bytes],
      client,
      description,
      discussionLink,
      metadata,
      amountOrId,
    );
    return { proposalInfo, assetHolder };
  };

  public createTextProposal = async (
    title: string,
    client: Client = clientsInfo.operatorClient,
    description: string = this.DEFAULT_DESCRIPTION,
    discussionLink: string = this.DEFAULT_LINK,
    metadata: string = this.DEFAULT_META_DATA,
    amountOrId: number = this.DEFAULT_NFT_TOKEN_SERIAL_NO,
  ) => {
    const assetHolder = await this.getAssetHolderContractAddressInfo();
    const callData = await this.encodeFunctionData(
      ContractService.ASSET_HOLDER,
      AssetsHolderProps.SET_TEXT,
      [],
    );
    const proposalInfo = await this.createProposal(
      AssetsHolderProps.Type.SET_TEXT,
      title,
      [assetHolder.contractEvmAddress],
      [0],
      [callData.bytes],
      client,
      description,
      discussionLink,
      metadata,
      amountOrId,
    );
    return { proposalInfo, assetHolder };
  };

  public createUpgradeProposal = async (
    targetProxyAddress: string,
    targetLogicAddress: string,
    proxyAdminAddress: string,
    title: string,
    client: Client = clientsInfo.operatorClient,
    description: string = this.DEFAULT_DESCRIPTION,
    discussionLink: string = this.DEFAULT_LINK,
    metadata: string = this.DEFAULT_META_DATA,
    amountOrId: number = this.DEFAULT_NFT_TOKEN_SERIAL_NO,
  ) => {
    const assetHolder = await this.getAssetHolderContractAddressInfo();
    const callData = await this.encodeFunctionData(
      ContractService.ASSET_HOLDER,
      AssetsHolderProps.UPGRADE_PROXY,
      [targetProxyAddress, targetLogicAddress, proxyAdminAddress],
    );
    const proposalInfo = await this.createProposal(
      AssetsHolderProps.Type.UPGRADE_PROXY,
      title,
      [assetHolder.contractEvmAddress],
      [0],
      [callData.bytes],
      client,
      description,
      discussionLink,
      metadata,
      amountOrId,
    );
    return { proposalInfo, assetHolder };
  };

  public createTokenProposal = async (
    name: string,
    symbol: string,
    initialSupply: number,
    createTokenFee: number,
    title: string,
    client: Client = clientsInfo.operatorClient,
    description: string = this.DEFAULT_DESCRIPTION,
    discussionLink: string = this.DEFAULT_LINK,
    metadata: string = this.DEFAULT_META_DATA,
    amountOrId: number = this.DEFAULT_NFT_TOKEN_SERIAL_NO,
  ) => {
    const assetHolder = await this.getAssetHolderContractAddressInfo();
    const callData = await this.encodeFunctionData(
      ContractService.ASSET_HOLDER,
      AssetsHolderProps.CREATE_TOKEN,
      [name, symbol, initialSupply],
    );
    const proposalInfo = await this.createProposal(
      AssetsHolderProps.Type.CREATE_TOKEN,
      title,
      [assetHolder.contractEvmAddress],
      [createTokenFee],
      [callData.bytes],
      client,
      description,
      discussionLink,
      metadata,
      amountOrId,
    );
    return { proposalInfo, assetHolder };
  };

  public createMintTokenProposal = async (
    tokenAddress: string,
    mintAmount: number,
    title: string,
    client: Client = clientsInfo.operatorClient,
    description: string = this.DEFAULT_DESCRIPTION,
    discussionLink: string = this.DEFAULT_LINK,
    metadata: string = this.DEFAULT_META_DATA,
    amountOrId: number = this.DEFAULT_NFT_TOKEN_SERIAL_NO,
  ) => {
    const assetHolder = await this.getAssetHolderContractAddressInfo();
    const callData = await this.encodeFunctionData(
      ContractService.ASSET_HOLDER,
      AssetsHolderProps.MINT_TOKEN,
      [tokenAddress, mintAmount],
    );
    const proposalInfo = await this.createProposal(
      AssetsHolderProps.Type.MINT_TOKEN,
      title,
      [assetHolder.contractEvmAddress],
      [0],
      [callData.bytes],
      client,
      description,
      discussionLink,
      metadata,
      amountOrId,
    );
    return { proposalInfo, assetHolder };
  };

  public createBurnTokenProposal = async (
    tokenAddress: string,
    burnAmount: number,
    title: string,
    client: Client = clientsInfo.operatorClient,
    description: string = this.DEFAULT_DESCRIPTION,
    discussionLink: string = this.DEFAULT_LINK,
    metadata: string = this.DEFAULT_META_DATA,
    amountOrId: number = this.DEFAULT_NFT_TOKEN_SERIAL_NO,
  ) => {
    const assetHolder = await this.getAssetHolderContractAddressInfo();
    const callData = await this.encodeFunctionData(
      ContractService.ASSET_HOLDER,
      AssetsHolderProps.BURN_TOKEN,
      [tokenAddress, burnAmount],
    );
    const proposalInfo = await this.createProposal(
      AssetsHolderProps.Type.BURN_TOKEN,
      title,
      [assetHolder.contractEvmAddress],
      [0],
      [callData.bytes],
      client,
      description,
      discussionLink,
      metadata,
      amountOrId,
    );
    return { proposalInfo, assetHolder };
  };

  public executeProposal = async (
    proposalInfo: ProposalInfo,
    client: Client = clientsInfo.operatorClient,
    fee: number = 0,
  ) => {
    const args = this.createExecuteOrCancelTransactionParams(proposalInfo);
    const { receipt, result, record } = await this.execute(
      1_000_000,
      this.EXECUTE_PROPOSAL,
      client,
      args,
      undefined,
      fee,
    );
    const proposalId = result.getUint256(0).toFixed();
    const txnId = record.transactionId.toString();
    console.log(
      `- Governor#${this.EXECUTE_PROPOSAL}(): proposal-id = ${proposalId}, status = ${receipt.status}, TxnId = ${txnId}\n`,
    );
    return receipt.status.toString() === "SUCCESS";
  };

  public cancelProposal = async (
    proposalInfo: ProposalInfo,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = this.createExecuteOrCancelTransactionParams(proposalInfo);
    const { receipt, result } = await this.execute(
      1_000_000,
      this.CANCEL_PROPOSAL,
      client,
      args,
    );
    const proposalId = result.getUint256(0).toFixed();
    console.log(
      `- Governor#${this.CANCEL_PROPOSAL}(): proposal-id = ${proposalId}\n`,
    );
    return receipt.status.toString() === "SUCCESS";
  };

  public async setupAllowanceForProposalCreation(
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

  public async setupNFTAllowanceForProposalCreation(
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

  public async setAllowanceForTransferTokenProposal(
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

  public getProposalNumericState = async (proposalState: string) => {
    return Object.values(ProposalState).indexOf(proposalState);
  };

  public getProposalVoteNumeric = async (vote: string): Promise<number> => {
    return Object.values(VoteType).indexOf(vote);
  };

  public isSucceeded = async (
    proposalId: string,
    requiredState: number = 4,
  ) => {
    const state = await this.getStateWithTimeout(proposalId, requiredState);
    return requiredState === state;
  };

  public getProposalInfoFromMirrorNode = async (
    proposalId: string,
    delayRequired: boolean = true,
  ): Promise<ProposalInfo> => {
    const events = await MirrorNodeService.getInstance().getEvents(
      this.contractId,
      delayRequired,
    );
    const proposalInfo = this.parseProposalCreatedEvent(proposalId, events);
    this.printProposalInfo(
      proposalInfo,
      `- Governor#getProposalInfoFromMirrorNode():`,
    );
    return proposalInfo;
  };

  public againstVote = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient,
  ) => await this.vote(proposalId, 0, client);

  public forVote = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient,
  ) => await this.vote(proposalId, 1, client);

  public abstainVote = async (
    proposalId: string,
    client: Client = clientsInfo.operatorClient,
  ) => await this.vote(proposalId, 2, client);

  private createProposal = async (
    proposalType: number,
    title: string,
    targets: string[],
    values: number[], // values must be passed here in a form of tinnybar
    calldatas: Uint8Array[],
    client: Client = clientsInfo.operatorClient,
    description: string = this.DEFAULT_DESCRIPTION,
    discussionLink: string = this.DEFAULT_LINK,
    metadata: string = this.DEFAULT_META_DATA,
    amountOrId: number = this.DEFAULT_NFT_TOKEN_SERIAL_NO,
  ) => {
    const createProposalInputs = {
      _inputs: Object.values({
        proposalType,
        title,
        description,
        discussionLink,
        metadata,
        amountOrId,
        targets,
        values,
        calldatas,
      }),
    };
    const createProposalInputsData = await this.encodeFunctionData(
      this.getContractName(),
      this.CREATE_PROPOSAL,
      Object.values(createProposalInputs),
    );
    const { result } = await this.execute(
      9_00_000,
      this.CREATE_PROPOSAL,
      client,
      createProposalInputsData.bytes,
    );
    const proposalInfo = await this.getProposalInfoFromResult(result);
    this.printProposalInfo(
      proposalInfo,
      `- Governor#${this.CREATE_PROPOSAL}():`,
    );
    return proposalInfo;
  };

  private vote = async (
    proposalId: string,
    support: number,
    client: Client,
  ) => {
    const args = this.createBaseParams(proposalId).addUint8(support);
    await this.execute(5_00_000, this.CAST_VOTE, client, args);
    console.log(
      `- Governor#${this.CAST_VOTE}(): proposal-id = ${proposalId}, support = ${support}\n`,
    );
  };

  private createBaseParams(proposalId: string) {
    return new ContractFunctionParameters().addUint256(BigNumber(proposalId));
  }

  private createExecuteOrCancelTransactionParams(proposalInfo: ProposalInfo) {
    return new ContractFunctionParameters()
      .addAddressArray(proposalInfo.targets)
      .addUint256Array(proposalInfo.values.map((item: string) => Number(item)))
      .addBytesArray(
        proposalInfo.calldatas.map((item: string) =>
          ethers.utils.arrayify(item),
        ),
      )
      .addBytes32(Helper.role(proposalInfo.title));
  }

  private async getProposalInfoFromResult(
    result: ContractFunctionResult,
  ): Promise<ProposalInfo> {
    const proposalId = result.getUint256(0).toFixed();
    const events = await MirrorNodeService.getInstance().decodeLog(result.logs);
    return this.parseProposalCreatedEvent(proposalId, events);
  }

  private parseProposalCreatedEvent(
    proposalId: string,
    events: Map<string, any[]>,
  ): ProposalInfo {
    const proposalCreatedEvents = events.get("ProposalCoreInformation") ?? [];
    const proposalCreatedEvent = proposalCreatedEvents.find(
      (item: any) =>
        item && item.proposalId && item.proposalId.toString() === proposalId,
    );
    const coreInformation = proposalCreatedEvent.coreInformation;
    const inputs = coreInformation.inputs;
    return {
      proposalId: proposalCreatedEvent.proposalId.toString(),

      creator: coreInformation.creator,
      voteStart: coreInformation.voteStart.toString(),
      voteEnd: coreInformation.voteEnd.toString(),
      blockedAmountOrId: coreInformation.blockedAmountOrId.toString(),

      proposalType: inputs.proposalType.toString(),
      title: inputs.title,
      description: inputs.description,
      discussionLink: inputs.discussionLink,
      metadata: inputs.metadata,
      amountOrId: inputs.amountOrId.toString(),
      targets: inputs.targets,
      values: inputs._values.map((item: any) => item.toString()),
      calldatas: inputs.calldatas,
    };
  }

  private printProposalInfo(proposalInfo: ProposalInfo, callerName: string) {
    console.log(callerName);
    console.table({
      ...proposalInfo,
      targets: proposalInfo.targets.toString(),
      values: proposalInfo.values.toString(),
      calldatas: proposalInfo.calldatas.toString(),
    });
    console.log();
  }
}
