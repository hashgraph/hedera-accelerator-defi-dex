import Common from "../business/Common";
import Governor from "../business/Governor";
import GodHolder from "../business/GodHolder";
import NFTHolder from "../business/NFTHolder";
import HederaGovernor from "../business/HederaGovernor";

import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { AddressHelper } from "../../utils/AddressHelper";
import {
  Client,
  TokenId,
  AccountId,
  PrivateKey,
  ContractId,
} from "@hashgraph/sdk";

export class CommonSteps {
  static DEFAULT_QUORUM_THRESHOLD_IN_BSP = 1;
  static DEFAULT_VOTING_DELAY = 0;
  static DEFAULT_VOTING_PERIOD = 10;
  static withPrecision = 1e8;

  public async initializeGovernorContract(
    governor: Governor,
    tokenHolder: GodHolder | NFTHolder,
    client: Client,
    governorTokenId: TokenId,
    holderTokenId: TokenId,
  ) {
    await governor.initialize(
      tokenHolder,
      client,
      CommonSteps.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
      CommonSteps.DEFAULT_VOTING_DELAY,
      CommonSteps.DEFAULT_VOTING_PERIOD,
      governorTokenId,
      holderTokenId,
    );
  }

  public async waitForProposalState(
    governor: Governor,
    state: string,
    proposalId: string,
    seconds: number,
  ) {
    const requiredState = await governor.getProposalNumericState(state);
    await governor.getStateWithTimeout(
      proposalId,
      requiredState,
      seconds * 1000,
      1000,
    );
  }

  public async vote(
    governor: Governor,
    vote: string,
    proposalId: string,
    client: Client,
    tokenSerialIdOrAmt: number = 0,
  ) {
    const voteVal = await governor.getProposalVoteNumeric(vote);
    await governor.vote(proposalId, voteVal, tokenSerialIdOrAmt, client);
    await governor.getProposalDetails(proposalId);
  }

  public async executeProposal(
    governor: Governor,
    title: string,
    fromPrivateKey: PrivateKey,
    client: Client,
    fee: number = 0,
  ) {
    await governor.executeProposal(title, fromPrivateKey, client, fee);
  }

  public async getProposalState(
    governor: Governor,
    proposalId: string,
    client: Client,
    proposalState: string,
  ) {
    const currentState = await governor.state(proposalId, client);
    const proposalStateNumeric =
      await governor.getProposalNumericState(proposalState);

    return {
      currentState,
      proposalStateNumeric,
    };
  }

  public async revertTokens(
    id: AccountId | ContractId,
    receiverAccountId: AccountId,
    senderAccountId: AccountId,
    senderPrivateKey: PrivateKey,
    tokenId: TokenId,
    client: Client,
  ) {
    const qty = await this.getTokenBal(id, tokenId, client);
    if (qty.isGreaterThan(0.0)) {
      await Common.transferAssets(
        tokenId,
        Number(qty),
        receiverAccountId,
        senderAccountId,
        senderPrivateKey,
        client,
      );
    }
  }

  private async getTokenBal(
    id: AccountId | ContractId,
    tokenId: TokenId,
    client: Client,
  ) {
    return await Common.getTokenBalance(id, tokenId, client);
  }

  public async lockTokens(
    godHolder: GodHolder,
    tokenAmt: number,
    client: Client,
  ) {
    await godHolder.lock(tokenAmt, client);
  }

  public async setupAllowanceForTokenLocking(
    godHolder: GodHolder,
    allowanceAmount: number,
    accountId: AccountId,
    accountPrivateKey: PrivateKey,
    client: Client,
  ) {
    await godHolder.setupAllowanceForTokenLocking(
      allowanceAmount,
      accountId,
      accountPrivateKey,
      client,
    );
  }

  public async setupAllowanceForProposalCreation(
    governor: Governor,
    creatorClient: Client,
    creatorAccountId: AccountId,
    creatorPrivateKey: PrivateKey,
  ) {
    await governor.setupAllowanceForProposalCreation(
      creatorClient,
      creatorAccountId,
      creatorPrivateKey,
    );
  }

  public async setupNFTAllowanceForProposalCreation(
    governor: Governor,
    creatorClient: Client,
    creatorAccountId: AccountId,
    creatorPrivateKey: PrivateKey,
  ) {
    await governor.setupNFTAllowanceForProposalCreation(
      creatorClient,
      creatorAccountId,
      creatorPrivateKey,
    );
  }

  public async setupAllowanceForToken(
    governor: Governor,
    tokenId: TokenId,
    tokenAmount: number,
    spenderAccountId: string | AccountId,
    tokenSenderAccountId: string | AccountId,
    tokenSenderPrivateKey: PrivateKey,
    client: Client,
  ) {
    await governor.setAllowanceForTransferTokenProposal(
      tokenId,
      tokenAmount,
      spenderAccountId,
      tokenSenderAccountId,
      tokenSenderPrivateKey,
    );
  }

  public async setupAllowanceForNFTToken(
    nftHolder: NFTHolder,
    voterAccountId: AccountId,
    voterAccountPrivateKey: PrivateKey,
    voterClient: Client,
  ) {
    await nftHolder.setupAllowanceForTokenLocking(
      voterAccountId,
      voterAccountPrivateKey,
      voterClient,
    );
  }

  public async grabNFTTokensForAllowance(
    nftHolder: NFTHolder,
    tokenSerial: number,
    voterClient: Client,
  ) {
    await nftHolder.grabTokensForVoter(tokenSerial, voterClient);
  }

  public async revertNFTs(
    fromEvmAddress: string,
    fromAccountKey: PrivateKey,
    toAccountId: string | AccountId,
    tokenId: TokenId,
    tokenSerialNumber: number,
    client: Client,
  ) {
    const balance = await Common.getTokenBalance(
      fromEvmAddress,
      tokenId,
      client,
    );
    const fromAccountId = await AddressHelper.addressToId(fromEvmAddress);
    if (balance.toNumber() > 0) {
      await Common.transferAssets(
        tokenId,
        tokenSerialNumber,
        toAccountId,
        fromAccountId,
        fromAccountKey,
        client,
      );
    }
  }

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

  public static async transferLockedAssetsFromContract(
    tokenId: string | TokenId,
    senderId: ContractId,
    receiverId: AccountId,
  ) {
    const balance = await Common.getTokenBalance(
      senderId,
      tokenId,
      clientsInfo.operatorClient,
    );
    balance.isGreaterThan(0) &&
      (await Common.transferAssets(
        tokenId,
        Number(balance),
        receiverId,
        senderId.toString(),
        clientsInfo.operatorKey,
        clientsInfo.operatorClient,
      ));
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

  static async lockTokensForVoting(
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
