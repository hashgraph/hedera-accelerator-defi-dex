import Governor from "../business/Governor";
import {
  Client,
  PrivateKey,
  AccountId,
  ContractId,
  TokenId,
} from "@hashgraph/sdk";
import GodHolder from "../business/GodHolder";
import Common from "../business/Common";

export class CommonSteps {
  static DEFAULT_QUORUM_THRESHOLD_IN_BSP = 1;
  static DEFAULT_VOTING_DELAY = 2;
  static DEFAULT_VOTING_PERIOD = 12;
  static withPrecision = 1e8;

  public async initializeGovernorContract(
    governor: Governor,
    godHolder: GodHolder,
    client: Client
  ) {
    await governor.initialize(
      godHolder,
      client,
      CommonSteps.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
      CommonSteps.DEFAULT_VOTING_DELAY,
      CommonSteps.DEFAULT_VOTING_PERIOD
    );
  }

  public async waitForProposalState(
    governor: Governor,
    state: string,
    proposalId: string,
    seconds: number
  ) {
    const requiredState = await governor.getProposalNumericState(state);
    await governor.getStateWithTimeout(
      proposalId,
      requiredState,
      seconds * 1000,
      1000
    );
  }

  public async vote(
    governor: Governor,
    vote: string,
    proposalId: string,
    client: Client,
    tokenSerialIdOrAmt: number = 0
  ) {
    const voteVal = await governor.getProposalVoteNumeric(vote);
    await governor.vote(proposalId, voteVal, tokenSerialIdOrAmt, client);
    await governor.getProposalDetails(proposalId);
  }

  public async executeProposal(
    governor: Governor,
    title: string,
    fromPrivateKey: PrivateKey,
    client: Client
  ) {
    await governor.executeProposal(title, fromPrivateKey, client);
  }

  public async getProposalState(
    governor: Governor,
    proposalId: string,
    client: Client,
    proposalState: string
  ) {
    const currentState = await governor.state(proposalId, client);
    const proposalStateNumeric = await governor.getProposalNumericState(
      proposalState
    );

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
    client: Client
  ) {
    const qty = await this.getTokenBal(id, tokenId, client);
    if (qty.greaterThan(0.0)) {
      await this.transferTokens(
        receiverAccountId,
        senderAccountId,
        senderPrivateKey,
        tokenId,
        Number(qty),
        client
      );
    }
  }

  private async getTokenBal(
    id: AccountId | ContractId,
    tokenId: TokenId,
    client: Client
  ) {
    return await Common.getTokenBalance(id, tokenId, client);
  }

  public async lockTokens(
    godHolder: GodHolder,
    tokenAmt: number,
    voterAcctId: AccountId,
    voterAcctPvtKey: PrivateKey,
    client: Client
  ) {
    await godHolder.lock(tokenAmt, voterAcctId, voterAcctPvtKey, client);
  }

  public async setupAllowanceForTokenLocking(
    godHolder: GodHolder,
    allowanceAmount: number,
    accountId: AccountId,
    accountPrivateKey: PrivateKey,
    client: Client
  ) {
    await godHolder.setupAllowanceForTokenLocking(
      allowanceAmount,
      accountId,
      accountPrivateKey,
      client
    );
  }

  public async setupAllowanceForProposalCreation(
    governor: Governor,
    creatorClient: Client,
    creatorAccountId: AccountId,
    creatorPrivateKey: PrivateKey
  ) {
    await governor.setupAllowanceForProposalCreation(
      creatorClient,
      creatorAccountId,
      creatorPrivateKey
    );
  }

  public async setupAllowanceForToken(
    governor: Governor,
    tokenId: TokenId,
    tokenAmount: number,
    spenderAccountId: string | AccountId,
    tokenSenderAccountId: string | AccountId,
    tokenSenderPrivateKey: PrivateKey,
    client: Client
  ) {
    await governor.setAllowanceForTransferTokenProposal(
      tokenId,
      tokenAmount,
      spenderAccountId,
      tokenSenderAccountId,
      tokenSenderPrivateKey
    );
  }

  private async transferTokens(
    receiverAccountId: AccountId,
    senderAccountId: AccountId,
    senderPrivateKey: PrivateKey,
    tokenId: string | TokenId,
    tokenQty: number,
    client: Client
  ) {
    await Common.transferTokens(
      receiverAccountId,
      senderAccountId,
      senderPrivateKey,
      tokenId,
      tokenQty,
      client
    );
  }
}
