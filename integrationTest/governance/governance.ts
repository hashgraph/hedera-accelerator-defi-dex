import Common from "../../e2e-test/business/Common";
import GodHolder from "../../e2e-test/business/GodHolder";
import NFTHolder from "../../e2e-test/business/NFTHolder";

import Governor from "../../e2e-test/business/Governor";
import TextGovernor from "../../e2e-test/business/TextGovernor";
import TokenCreateGovernor from "../../e2e-test/business/TokenCreateGovernor";
import TokenTransferGovernor from "../../e2e-test/business/TokenTransferGovernor";
import ContractUpgradeGovernor from "../../e2e-test/business/ContractUpgradeGovernor";

import { Helper } from "../../utils/Helper";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import { AddressHelper } from "../../utils/AddressHelper";
import { Client, TokenId, AccountId, PrivateKey } from "@hashgraph/sdk";

export async function lockTokenForVotingIfNeeded(
  governor: Governor,
  tokenHolder: GodHolder | NFTHolder,
  txnFeePayerClient: Client,
  voterAccountId: AccountId,
  voterAccountKey: PrivateKey,
  voterClient: Client,
  nftTokenSerialIdForVoting: number
) {
  const quorum = await governor.quorum(txnFeePayerClient);
  const votingPowerAmount = await tokenHolder.balanceOfVoter(
    voterAccountId,
    txnFeePayerClient
  );

  // tokens locking required in token holder if not enough power locked
  if (votingPowerAmount < quorum) {
    if (tokenHolder instanceof GodHolder) {
      const lockAmount = quorum - votingPowerAmount;
      await tokenHolder.setupAllowanceForTokenLocking(
        lockAmount,
        voterAccountId,
        voterAccountKey,
        voterClient
      );
      await tokenHolder.lock(lockAmount, voterClient);
    } else {
      await tokenHolder.setupAllowanceForTokenLocking(
        voterAccountId,
        voterAccountKey,
        voterClient
      );
      await tokenHolder.grabTokensForVoter(
        nftTokenSerialIdForVoting,
        voterClient
      );
    }
  }
}

export async function createAndExecuteTextProposal(
  governor: TextGovernor,
  tokenHolder: GodHolder | NFTHolder,
  voterClient: Client,
  creatorId: AccountId,
  creatorPK: PrivateKey,
  creatorClient: Client,
  txnFee: number
) {
  await setupProposalCreationAllowance(
    governor,
    tokenHolder,
    creatorId,
    creatorPK,
    creatorClient
  );

  const title = Helper.createProposalTitle("Text Proposal");
  const proposalId = await governor.createTextProposal(
    title,
    creatorClient,
    "Text Proposal - Desc",
    "Text Proposal - LINK",
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO
  );
  await governor.getProposalDetails(proposalId, voterClient);
  await governor.forVote(proposalId, 0, voterClient);
  await governor.getProposalDetails(proposalId, voterClient);
  if (await governor.isSucceeded(proposalId)) {
    await governor.executeProposal(title, undefined, creatorClient, txnFee);
  } else {
    await governor.cancelProposal(title, creatorClient);
  }
}

export async function createAndExecuteAssetTransferProposal(
  governor: TokenTransferGovernor,
  tokenHolder: GodHolder | NFTHolder,
  tokenId: TokenId,
  amountOrId: number,
  receiverAccountId: AccountId,
  receiverAccountPK: PrivateKey,
  senderAccountId: AccountId,
  senderAccountPK: PrivateKey,
  voterClient: Client,
  creatorId: AccountId,
  creatorPK: PrivateKey,
  creatorClient: Client,
  txnFee: number
) {
  await setupProposalCreationAllowance(
    governor,
    tokenHolder,
    creatorId,
    creatorPK,
    creatorClient
  );

  const title = Helper.createProposalTitle("Asset Transfer Proposal");
  const proposalId = await governor.createTokenTransferProposal(
    title,
    receiverAccountId.toSolidityAddress(),
    tokenId.toSolidityAddress(),
    amountOrId,
    creatorClient,
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
    "Asset Transfer Proposal - Desc",
    "Asset Transfer Proposal - Link"
  );
  await governor.getProposalDetails(proposalId, voterClient);
  await governor.forVote(proposalId, 0, voterClient);
  await governor.getProposalDetails(proposalId, voterClient);
  if (await governor.isSucceeded(proposalId)) {
    // step - 1 transfer assets to governor contract
    await Common.transferAssets(
      tokenId,
      amountOrId,
      governor.contractId,
      senderAccountId,
      senderAccountPK,
      creatorClient
    );
    // step - 2 associate token to receiver
    await Common.associateTokensToAccount(
      receiverAccountId,
      [tokenId],
      creatorClient,
      receiverAccountPK
    );
    await governor.executeProposal(title, undefined, creatorClient, txnFee);
  } else {
    await governor.cancelProposal(title, creatorClient);
  }
}

export async function createAndExecuteContractUpgradeProposal(
  proxyAddress: string,
  proxyLogicAddress: string,
  governor: ContractUpgradeGovernor,
  tokenHolder: GodHolder | NFTHolder,
  voterClient: Client,
  creatorId: AccountId,
  creatorPK: PrivateKey,
  creatorClient: Client,
  txnFee: number
) {
  async function transferOwnershipToGovernance(
    proposalId: string,
    contractUpgradeGovernor: ContractUpgradeGovernor
  ) {
    const governorEvmAddress = await AddressHelper.idToEvmAddress(
      contractUpgradeGovernor.contractId
    );
    const { proxyId } =
      await contractUpgradeGovernor.getContractAddressesFromGovernorUpgradeContract(
        proposalId
      );
    await new Common(proxyId).changeAdmin(
      governorEvmAddress,
      clientsInfo.proxyAdminKey,
      clientsInfo.proxyAdminClient
    );
  }

  await setupProposalCreationAllowance(
    governor,
    tokenHolder,
    creatorId,
    creatorPK,
    creatorClient
  );

  const title = Helper.createProposalTitle("Contract Upgrade Proposal");
  const { proposalId } = await governor.createContractUpgradeProposal(
    proxyAddress,
    proxyLogicAddress,
    title,
    creatorClient,
    governor.DEFAULT_DESCRIPTION,
    governor.DEFAULT_LINK,
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO
  );

  await governor.getProposalDetails(proposalId, voterClient);
  await governor.forVote(proposalId, 0, voterClient);
  await governor.getProposalDetails(proposalId, voterClient);

  if (await governor.isSucceeded(proposalId)) {
    await transferOwnershipToGovernance(proposalId, governor);
    await governor.executeProposal(title, undefined, creatorClient, txnFee);
  } else {
    await governor.cancelProposal(title, creatorClient);
  }
}

export async function createAndExecuteTokenAssociationProposal(
  governor: TokenTransferGovernor,
  tokenHolder: GodHolder | NFTHolder,
  tokenId: TokenId,
  voterClient: Client,
  creatorId: AccountId,
  creatorPK: PrivateKey,
  creatorClient: Client,
  txnFee: number
) {
  await setupProposalCreationAllowance(
    governor,
    tokenHolder,
    creatorId,
    creatorPK,
    creatorClient
  );

  const title = Helper.createProposalTitle("Token Associate Proposal");
  const proposalId = await governor.createTokenAssociateProposal(
    title,
    tokenId.toSolidityAddress(),
    creatorClient,
    "Token Association Proposal - Desc",
    "Token Association Proposal - LINK",
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO
  );
  await governor.getProposalDetails(proposalId, voterClient);
  await governor.forVote(proposalId, 0, voterClient);
  await governor.getProposalDetails(proposalId, voterClient);
  if (await governor.isSucceeded(proposalId)) {
    await governor.executeProposal(title, undefined, creatorClient, txnFee);
  } else {
    await governor.cancelProposal(title, creatorClient);
  }
}

export async function createAndExecuteTokenCreateProposal(
  name: string,
  symbol: string,
  governor: TokenCreateGovernor,
  tokenHolder: GodHolder | NFTHolder,
  voterClient: Client,
  treasureId: AccountId,
  treasureClient: Client,
  creatorId: AccountId,
  creatorPK: PrivateKey,
  creatorClient: Client,
  txnFee: number
) {
  await setupProposalCreationAllowance(
    governor,
    tokenHolder,
    creatorId,
    creatorPK,
    creatorClient
  );

  let tokenId: TokenId | null = null;
  const title = Helper.createProposalTitle("Token Create Proposal");
  const proposalId = await governor.createTokenProposal(
    title,
    name,
    symbol,
    treasureId,
    creatorClient
  );

  await governor.getProposalDetails(proposalId, voterClient);
  await governor.forVote(proposalId, 0, voterClient);
  await governor.getProposalDetails(proposalId, voterClient);
  if (await governor.isSucceeded(proposalId)) {
    await governor.executeProposal(title, undefined, creatorClient, txnFee);
    tokenId = await governor.getTokenAddressFromGovernorTokenCreate(proposalId);
  } else {
    await governor.cancelProposal(title, creatorClient);
  }
  if (!tokenId) {
    throw Error("failed to created token inside integration test");
  }
  await governor.mintToken(proposalId, BigNumber(10), treasureClient);
  await governor.burnToken(proposalId, BigNumber(9), treasureClient);
  await Common.associateTokensToAccount(treasureId, [tokenId!], treasureClient);
  await governor.transferToken(
    proposalId,
    treasureId.toSolidityAddress(),
    BigNumber(1),
    treasureClient
  );
  return tokenId;
}

async function setupProposalCreationAllowance(
  governor: Governor,
  tokenHolder: GodHolder | NFTHolder,
  creatorId: AccountId,
  creatorPK: PrivateKey,
  creatorClient: Client
) {
  if (tokenHolder instanceof GodHolder) {
    await governor.setupAllowanceForProposalCreation(
      creatorClient,
      creatorId,
      creatorPK
    );
  } else {
    await governor.setupNFTAllowanceForProposalCreation(
      creatorClient,
      creatorId,
      creatorPK
    );
  }
}
