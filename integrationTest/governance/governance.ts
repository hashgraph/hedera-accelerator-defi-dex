import dex from "../../deployment/model/dex";
import Common from "../../e2e-test/business/Common";
import GodHolder from "../../e2e-test/business/GodHolder";
import NFTHolder from "../../e2e-test/business/NFTHolder";
import AssetsHolder from "../../e2e-test/business/AssetsHolder";
import HederaGovernor from "../../e2e-test/business/HederaGovernor";

import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import { AddressHelper } from "../../utils/AddressHelper";
import { ContractService } from "../../deployment/service/ContractService";
import {
  Hbar,
  Client,
  TokenId,
  HbarUnit,
  AccountId,
  PrivateKey,
  ContractId,
} from "@hashgraph/sdk";

export const NFT_TOKEN_FOR_TRANSFER = dex.NFT_TOKEN_ID;
export const FT_TOKEN_FOR_TRANSFER = TokenId.fromString(dex.TOKEN_LAB49_1);
export const FT_TOKEN_AMOUNT_FOR_TRANSFER = 1e8;
export const CRYPTO_AMOUNT_FOR_TRANSFER = Hbar.from(1, HbarUnit.Hbar)
  .toTinybars()
  .toNumber();

async function lockTokenForVotingIfNeeded(
  governor: HederaGovernor,
  tokenHolder: GodHolder | NFTHolder,
  txnFeePayerClient: Client,
  voterAccountId: AccountId,
  voterAccountKey: PrivateKey,
  voterClient: Client,
  nftTokenSerialIdForVoting: number,
) {
  const quorum = await governor.quorum(txnFeePayerClient);
  const votingPowerAmount = await tokenHolder.balanceOfVoter(
    voterAccountId,
    txnFeePayerClient,
  );

  // tokens locking required in token holder if not enough power locked
  if (votingPowerAmount < quorum) {
    if (tokenHolder instanceof GodHolder) {
      const lockAmount = quorum - votingPowerAmount;
      await tokenHolder.setupAllowanceForTokenLocking(
        lockAmount,
        voterAccountId,
        voterAccountKey,
        voterClient,
      );
      await tokenHolder.lock(lockAmount, voterClient);
    } else {
      await tokenHolder.setupAllowanceForTokenLocking(
        voterAccountId,
        voterAccountKey,
        voterClient,
      );
      await tokenHolder.grabTokensForVoter(
        nftTokenSerialIdForVoting,
        voterClient,
      );
    }
  }
}

async function createAndExecuteTokenAssociationProposal(
  governor: HederaGovernor,
  tokenHolder: GodHolder | NFTHolder,
  tokenId: TokenId,
  voterClient: Client,
  creatorId: AccountId,
  creatorPK: PrivateKey,
  creatorClient: Client,
  txnFee: number,
) {
  await setupProposalCreationAllowance(
    governor,
    tokenHolder,
    creatorId,
    creatorPK,
    creatorClient,
  );
  const title = Helper.createProposalTitle("Token Associate Proposal");
  const { proposalInfo } = await governor.createTokenAssociationProposal(
    tokenId,
    title,
    creatorClient,
    governor.DEFAULT_DESCRIPTION,
    governor.DEFAULT_LINK,
    governor.DEFAULT_META_DATA,
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
  );
  await governor.forVote(proposalInfo.proposalId, voterClient);
  await governor.getVotingInformation(proposalInfo.proposalId, voterClient);
  if (await governor.isSucceeded(proposalInfo.proposalId)) {
    await governor.executeProposal(proposalInfo, creatorClient, txnFee);
  } else {
    await governor.cancelProposal(proposalInfo, creatorClient);
  }
}

async function createAndExecuteAssetTransferProposal(
  governor: HederaGovernor,
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
  txnFee: number,
) {
  await setupProposalCreationAllowance(
    governor,
    tokenHolder,
    creatorId,
    creatorPK,
    creatorClient,
  );
  const title = Helper.createProposalTitle("Asset Transfer Proposal");
  const { proposalInfo, assetHolder } =
    await governor.createAssetTransferProposal(
      receiverAccountId.toSolidityAddress(),
      tokenId.toSolidityAddress(),
      amountOrId,
      title,
      creatorClient,
      governor.DEFAULT_DESCRIPTION,
      governor.DEFAULT_LINK,
      governor.DEFAULT_META_DATA,
      governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
    );
  await governor.forVote(proposalInfo.proposalId, voterClient);
  await governor.getVotingInformation(proposalInfo.proposalId, voterClient);
  if (await governor.isSucceeded(proposalInfo.proposalId)) {
    // step - 1 transfer assets to asset-holder contract
    await Common.transferAssets(
      tokenId,
      amountOrId,
      assetHolder.contractId,
      senderAccountId,
      senderAccountPK,
      creatorClient,
    );
    // step - 2 associate token to receiver
    await Common.associateTokensToAccount(
      receiverAccountId,
      [tokenId],
      creatorClient,
      receiverAccountPK,
    );
    await governor.executeProposal(proposalInfo, creatorClient, txnFee);
  } else {
    await governor.cancelProposal(proposalInfo, creatorClient);
  }
}

async function createAndExecuteTextProposal(
  governor: HederaGovernor,
  tokenHolder: GodHolder | NFTHolder,
  voterClient: Client,
  creatorId: AccountId,
  creatorPK: PrivateKey,
  creatorClient: Client,
  txnFee: number,
) {
  await setupProposalCreationAllowance(
    governor,
    tokenHolder,
    creatorId,
    creatorPK,
    creatorClient,
  );

  const title = Helper.createProposalTitle("Text Proposal");
  const { proposalInfo } = await governor.createTextProposal(
    title,
    creatorClient,
    "Text Proposal - Desc",
    "Text Proposal - LINK",
    "Text Proposal - Metadata",
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
  );
  await governor.forVote(proposalInfo.proposalId, voterClient);
  await governor.getVotingInformation(proposalInfo.proposalId, voterClient);
  if (await governor.isSucceeded(proposalInfo.proposalId)) {
    await governor.executeProposal(proposalInfo, creatorClient, txnFee);
  } else {
    await governor.cancelProposal(proposalInfo, creatorClient);
  }
}

async function createAndExecuteContractUpgradeProposal(
  proxyAddress: string,
  proxyLogicAddress: string,
  proxyAdminAddress: string,
  proxyAdminKey: PrivateKey,
  proxyAdminClient: Client,
  governor: HederaGovernor,
  tokenHolder: GodHolder | NFTHolder,
  voterClient: Client,
  creatorId: AccountId,
  creatorPK: PrivateKey,
  creatorClient: Client,
  txnFee: number,
) {
  await setupProposalCreationAllowance(
    governor,
    tokenHolder,
    creatorId,
    creatorPK,
    creatorClient,
  );

  const title = Helper.createProposalTitle("Contract Upgrade Proposal");
  const { proposalInfo, assetHolder } = await governor.createUpgradeProposal(
    proxyAddress,
    proxyLogicAddress,
    proxyAdminAddress,
    title,
    creatorClient,
    governor.DEFAULT_DESCRIPTION,
    governor.DEFAULT_LINK,
    governor.DEFAULT_META_DATA,
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
  );
  await governor.forVote(proposalInfo.proposalId, voterClient);
  await governor.getVotingInformation(proposalInfo.proposalId, voterClient);
  if (await governor.isSucceeded(proposalInfo.proposalId)) {
    const proxyId = await AddressHelper.addressToIdObject(proxyAddress);
    await new Common(proxyId).changeAdmin(
      assetHolder.contractEvmAddress,
      proxyAdminKey,
      proxyAdminClient,
    );
    await governor.executeProposal(proposalInfo, creatorClient, txnFee);
  } else {
    await governor.cancelProposal(proposalInfo, creatorClient);
  }
}

async function createAndExecuteTokenCreateProposal(
  name: string,
  symbol: string,
  initialSupply: number,
  governor: HederaGovernor,
  tokenHolder: GodHolder | NFTHolder,
  voterClient: Client,
  creatorId: AccountId,
  creatorPK: PrivateKey,
  creatorClient: Client,
  txnFee: number,
) {
  await setupProposalCreationAllowance(
    governor,
    tokenHolder,
    creatorId,
    creatorPK,
    creatorClient,
  );
  const title = Helper.createProposalTitle("Token Create Proposal");
  const { proposalInfo } = await governor.createTokenProposal(
    name,
    symbol,
    initialSupply,
    new Hbar(txnFee, HbarUnit.Hbar).toTinybars().toNumber(),
    title,
    creatorClient,
    governor.DEFAULT_DESCRIPTION,
    governor.DEFAULT_LINK,
    governor.DEFAULT_META_DATA,
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
  );
  await governor.forVote(proposalInfo.proposalId, voterClient);
  await governor.getVotingInformation(proposalInfo.proposalId, voterClient);
  if (await governor.isSucceeded(proposalInfo.proposalId)) {
    await governor.executeProposal(proposalInfo, creatorClient, txnFee);
  } else {
    await governor.cancelProposal(proposalInfo, creatorClient);
  }
}

async function createAndExecuteMintTokenProposal(
  tokenAddress: string,
  mintAmount: number,
  governor: HederaGovernor,
  tokenHolder: GodHolder | NFTHolder,
  voterClient: Client,
  creatorId: AccountId,
  creatorPK: PrivateKey,
  creatorClient: Client,
  txnFee: number,
) {
  await setupProposalCreationAllowance(
    governor,
    tokenHolder,
    creatorId,
    creatorPK,
    creatorClient,
  );
  const title = Helper.createProposalTitle("Token Mint Proposal");
  const { proposalInfo } = await governor.createMintTokenProposal(
    tokenAddress,
    mintAmount,
    title,
    creatorClient,
    governor.DEFAULT_DESCRIPTION,
    governor.DEFAULT_LINK,
    governor.DEFAULT_META_DATA,
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
  );
  await governor.forVote(proposalInfo.proposalId, voterClient);
  await governor.getVotingInformation(proposalInfo.proposalId, voterClient);
  if (await governor.isSucceeded(proposalInfo.proposalId)) {
    await governor.executeProposal(proposalInfo, creatorClient, txnFee);
  } else {
    await governor.cancelProposal(proposalInfo, creatorClient);
  }
}

async function createAndExecuteBurnTokenProposal(
  tokenAddress: string,
  burnAmount: number,
  governor: HederaGovernor,
  tokenHolder: GodHolder | NFTHolder,
  voterClient: Client,
  creatorId: AccountId,
  creatorPK: PrivateKey,
  creatorClient: Client,
  txnFee: number,
) {
  await setupProposalCreationAllowance(
    governor,
    tokenHolder,
    creatorId,
    creatorPK,
    creatorClient,
  );
  const title = Helper.createProposalTitle("Token Burn Proposal");
  const { proposalInfo } = await governor.createBurnTokenProposal(
    tokenAddress,
    burnAmount,
    title,
    creatorClient,
    governor.DEFAULT_DESCRIPTION,
    governor.DEFAULT_LINK,
    governor.DEFAULT_META_DATA,
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
  );
  await governor.forVote(proposalInfo.proposalId, voterClient);
  await governor.getVotingInformation(proposalInfo.proposalId, voterClient);
  if (await governor.isSucceeded(proposalInfo.proposalId)) {
    await governor.executeProposal(proposalInfo, creatorClient, txnFee);
  } else {
    await governor.cancelProposal(proposalInfo, creatorClient);
  }
}

async function setupProposalCreationAllowance(
  governor: HederaGovernor,
  tokenHolder: GodHolder | NFTHolder,
  creatorId: AccountId,
  creatorPK: PrivateKey,
  creatorClient: Client,
) {
  if (tokenHolder instanceof GodHolder) {
    await governor.setupAllowanceForProposalCreation(
      creatorClient,
      creatorId,
      creatorPK,
    );
  } else {
    await governor.setupNFTAllowanceForProposalCreation(
      creatorClient,
      creatorId,
      creatorPK,
    );
  }
}

export async function executeGovernanceProposals(
  tokenHolder: GodHolder | NFTHolder,
  governor: HederaGovernor,
  ftTokenId: TokenId,
  ftTokenQty: number,
  nftTokenId: TokenId,
  hBarAmount: number,
) {
  console.time("- executeGovernanceProposals took");
  const assetHolderDetails = await governor.getAssetHolderContractAddressInfo();
  const assetsHolder = new AssetsHolder(
    ContractId.fromString(assetHolderDetails.contractId),
  );

  // step - 0 lock required tokens to token holder
  await lockTokenForVotingIfNeeded(
    governor,
    tokenHolder,
    clientsInfo.treasureClient,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient,
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO_FOR_VOTING,
  );

  // step - 1 (A) ft token association
  await createAndExecuteTokenAssociationProposal(
    governor,
    tokenHolder,
    ftTokenId,
    clientsInfo.treasureClient,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient,
    0,
  );

  // step - 1 (B) ft transfer flow
  await createAndExecuteAssetTransferProposal(
    governor,
    tokenHolder,
    ftTokenId,
    ftTokenQty,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient,
    0,
  );

  // step - 2 (A) nft token association
  await createAndExecuteTokenAssociationProposal(
    governor,
    tokenHolder,
    nftTokenId,
    clientsInfo.treasureClient,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient,
    0,
  );

  // step - 2 (B) nft transfer flow
  await createAndExecuteAssetTransferProposal(
    governor,
    tokenHolder,
    nftTokenId,
    governor.DEFAULT_NFT_TOKEN_FOR_TRANSFER,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient,
    0,
  );

  // step - 3 HBar transfer flow
  await createAndExecuteAssetTransferProposal(
    governor,
    tokenHolder,
    dex.ZERO_TOKEN_ID,
    hBarAmount,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient,
    0,
  );

  // step - 4 Text proposal
  await createAndExecuteTextProposal(
    governor,
    tokenHolder,
    clientsInfo.treasureClient,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient,
    0,
  );

  // step - 5 Contract upgrade proposal
  const contractToUpgradeInfo = new ContractService().getContract(
    ContractService.MULTI_SIG,
  );
  await createAndExecuteContractUpgradeProposal(
    contractToUpgradeInfo.transparentProxyAddress!,
    contractToUpgradeInfo.address,
    clientsInfo.proxyAdminId.toSolidityAddress(),
    clientsInfo.proxyAdminKey,
    clientsInfo.proxyAdminClient,
    governor,
    tokenHolder,
    clientsInfo.treasureClient,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient,
    0,
  );

  // step - 6 Token creation proposal
  const nameAndSymbol = Helper.createProposalTitle("TT-");
  await createAndExecuteTokenCreateProposal(
    nameAndSymbol,
    nameAndSymbol,
    10e8, // create 10 tokens initially
    governor,
    tokenHolder,
    clientsInfo.treasureClient,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient,
    governor.TXN_FEE_FOR_TOKEN_CREATE,
  );
  // step - 7 get last created token
  const tokens = await assetsHolder.getCreatedTokens(true);
  if (tokens.length > 0) {
    const lastToken = tokens.pop()!;
    // step - 7 (A) Token mint proposal
    await createAndExecuteMintTokenProposal(
      lastToken.toSolidityAddress(),
      6e8, // mint 6 tokens
      governor,
      tokenHolder,
      clientsInfo.treasureClient,
      clientsInfo.treasureId,
      clientsInfo.treasureKey,
      clientsInfo.treasureClient,
      0,
    );
    // step - 7 (B) Token burn proposal
    await createAndExecuteBurnTokenProposal(
      lastToken.toSolidityAddress(),
      3e8, // burn 3 tokens
      governor,
      tokenHolder,
      clientsInfo.treasureClient,
      clientsInfo.treasureId,
      clientsInfo.treasureKey,
      clientsInfo.treasureClient,
      0,
    );

    // step - 8 unlock required tokens from token holder
    await tokenHolder.checkAndClaimGodTokens(
      clientsInfo.treasureClient,
      clientsInfo.treasureId,
    );
    console.timeEnd("- executeGovernanceProposals took");
  }
}
