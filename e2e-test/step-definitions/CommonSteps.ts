import BigNumber from "bignumber.js";
import GodHolder from "../business/GodHolder";
import NFTHolder from "../business/NFTHolder";
import HederaGovernor, { ProposalInfo } from "../business/HederaGovernor";

import { Deployment } from "../../utils/deployContractOnTestnet";
import { VotingPeriodInfo } from "../../deployment/model/VotingPeriodInfo";
import { Client, AccountId, PrivateKey } from "@hashgraph/sdk";

export interface TokenInfo {
  id: string;
  address: string;
  name: string;
  isNFT: boolean;
  symbol: string;
  treasuryAccountId: string;
  decimals: number;
}
export class CommonSteps {
  static DEFAULT_QUORUM_THRESHOLD_IN_BSP = 1;
  static DEFAULT_NFT_QUORUM_THRESHOLD_IN_BSP = 500;
  static DEFAULT_VOTING_DELAY = 0;
  static DEFAULT_VOTING_PERIOD = 30;
  static withPrecision = 1e8;

  public async deploy(contracts: string) {
    const items = contracts.split(",");
    if (items.length === 0) {
      throw new Error("No contracts given");
    }
    console.log(`- Contracts for deployment are :=`, items, "\n");
    const deployment = new Deployment();
    await Promise.all(
      items.map(async (item: string) => {
        await deployment.deployProxyAndSave(item);
      }),
    );
  }

  public static async setupAllowanceForLocking(
    tokenHolder: GodHolder | NFTHolder,
    amountOrId: number,
    voterId: AccountId,
    voterPK: PrivateKey,
    voterClient: Client,
  ) {
    if (tokenHolder instanceof GodHolder)
      await tokenHolder.setupAllowanceForTokenLocking(
        amountOrId,
        voterId,
        voterPK,
        voterClient,
      );
    else {
      await tokenHolder.setupAllowanceForTokenLocking(
        voterId,
        voterPK,
        voterClient,
      );
    }
  }

  public static async waitForRequiredState(
    stateString: string,
    maxWaitInSeconds: number,
    governor: HederaGovernor,
    proposalInfo: ProposalInfo,
    eachIterationDelayInMs: number = 500,
  ) {
    const requiredState = await governor.getProposalNumericState(stateString);
    await governor.getStateWithTimeout(
      proposalInfo.proposalId,
      requiredState,
      maxWaitInSeconds * 1000,
      eachIterationDelayInMs,
    );
  }

  public static async vote(
    voteString: string,
    governor: HederaGovernor,
    proposalId: string,
    client: Client,
  ) {
    const vote = await governor.getProposalVoteNumeric(voteString);
    await governor.state(proposalId);
    await governor.vote(proposalId, vote, client);
    await governor.getVotingInformation(proposalId, client);
  }

  public static async setupProposalCreationAllowance(
    isNFT: boolean,
    governor: HederaGovernor,
    creatorAccountId: AccountId,
    creatorPrivateKey: PrivateKey,
    creatorClient: Client,
  ) {
    if (isNFT) {
      await governor.setupNFTAllowanceForProposalCreation(
        creatorClient,
        creatorAccountId,
        creatorPrivateKey,
      );
    } else {
      await governor.setupAllowanceForProposalCreation(
        creatorClient,
        creatorAccountId,
        creatorPrivateKey,
      );
    }
  }

  public static async lockTokensForVoting(
    tokenHolder: GodHolder | NFTHolder,
    amountOrId: number,
    voterAccountId: AccountId,
    voterClient: Client,
  ) {
    const lockedAmount = await tokenHolder.balanceOfVoter(
      voterAccountId,
      voterClient,
    );
    if (tokenHolder instanceof GodHolder) {
      if (lockedAmount < amountOrId) {
        await tokenHolder.lock(amountOrId, voterClient);
      }
    } else {
      if (lockedAmount < 1) {
        await tokenHolder.grabTokensForVoter(amountOrId, voterClient);
      }
    }
  }

  static getVotingPeriodInfo(
    message: string,
    governorContractId: string,
    proposalInfo: ProposalInfo,
  ) {
    const createdAt = new Date(Number(proposalInfo.createdAt) * 1e3);
    const voteStart = new Date(Number(proposalInfo.voteStart) * 1e3);
    const voteEnd = new Date(Number(proposalInfo.voteEnd) * 1e3);
    const currentDate = new Date();

    const adjustTime = (first: number, second: number) =>
      Math.round(first - second) / 1e3;

    const info: VotingPeriodInfo = {
      createdAt: createdAt.toString(),
      voteStart: voteStart.toString(),
      voteEnd: voteEnd.toString(),
      currentTime: currentDate.toString(),
      votingPeriod: adjustTime(voteEnd.getTime(), voteStart.getTime()),
      votingDelay: adjustTime(voteStart.getTime(), createdAt.getTime()),
      isVotingStarted: currentDate.getTime() > voteStart.getTime(),
      isVotingEnded: currentDate.getTime() > voteEnd.getTime(),
      votingStartsIn:
        currentDate.getTime() < voteStart.getTime()
          ? adjustTime(voteStart.getTime(), currentDate.getTime())
          : -1,
      votingEndsIn:
        currentDate.getTime() < voteEnd.getTime()
          ? adjustTime(voteEnd.getTime(), currentDate.getTime())
          : -1,
    };
    console.log(message);
    console.table({
      ...info,
      proposalId: proposalInfo.proposalId,
      governorContractId,
    });
    return info;
  }

  public static normalizeAmountOrId(amountOrId: string) {
    return BigNumber(amountOrId).toNumber();
  }
}
