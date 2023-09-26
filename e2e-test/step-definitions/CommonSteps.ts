import GodHolder from "../business/GodHolder";
import NFTHolder from "../business/NFTHolder";
import HederaGovernor from "../business/HederaGovernor";

import { Deployment } from "../../utils/deployContractOnTestnet";
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
  static DEFAULT_VOTING_DELAY = 0;
  static DEFAULT_VOTING_PERIOD = 10;
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
    proposalId: string,
    eachIterationDelayInMs: number = 500,
  ) {
    const requiredState = await governor.getProposalNumericState(stateString);
    await governor.getStateWithTimeout(
      proposalId,
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
}
