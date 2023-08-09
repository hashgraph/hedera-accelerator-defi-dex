import Governor from "../business/Governor";
import {
  Client,
  PrivateKey,
  AccountId,
  ContractId,
  TokenId,
} from "@hashgraph/sdk";
import { Deployment } from "../../utils/deployContractOnTestnet";
import GodHolder from "../business/GodHolder";
import Common from "../business/Common";
import NFTHolder from "../business/NFTHolder";

export class CommonSteps {
  static DEFAULT_QUORUM_THRESHOLD_IN_BSP = 1;
  static DEFAULT_VOTING_DELAY = 2;
  static DEFAULT_VOTING_PERIOD = 9;
  static withPrecision = 1e8;

  public async initializeGovernorContract(
    governor: Governor,
    tokenHolder: GodHolder | NFTHolder,
    client: Client,
    governorTokenId: TokenId,
    holderTokenId: TokenId
  ) {
    await governor.initialize(
      tokenHolder,
      client,
      CommonSteps.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
      CommonSteps.DEFAULT_VOTING_DELAY,
      CommonSteps.DEFAULT_VOTING_PERIOD,
      governorTokenId,
      holderTokenId
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
    client: Client,
    fee: number = 0
  ) {
    await governor.executeProposal(title, fromPrivateKey, client, fee);
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
    if (qty.isGreaterThan(0.0)) {
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

  public async setupNFTAllowanceForProposalCreation(
    governor: Governor,
    creatorClient: Client,
    creatorAccountId: AccountId,
    creatorPrivateKey: PrivateKey
  ) {
    await governor.setupNFTAllowanceForProposalCreation(
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

  public async setupAllowanceForNFTToken(
    nftHolder: NFTHolder,
    voterAccountId: AccountId,
    voterAccountPrivateKey: PrivateKey,
    voterClient: Client
  ) {
    await nftHolder.setupAllowanceForTokenLocking(
      voterAccountId,
      voterAccountPrivateKey,
      voterClient
    );
  }

  public async grabNFTTokensForAllowance(
    nftHolder: NFTHolder,
    tokenSerial: number,
    voterAccountId: AccountId,
    voterAccountPrivateKey: PrivateKey,
    voterClient: Client
  ) {
    await nftHolder.grabTokensForVoter(
      tokenSerial,
      voterAccountId,
      voterAccountPrivateKey,
      voterClient
    );
  }

  public async revertNFTs(
    fromEvmAddress: string,
    fromAccountKey: PrivateKey,
    toAccountId: string | AccountId,
    tokenId: TokenId,
    tokenSerialNumber: number,
    client: Client
  ) {
    await Common.transferNFTToken(
      tokenId,
      tokenSerialNumber,
      fromEvmAddress,
      fromAccountKey,
      toAccountId,
      client
    );
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
      })
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
