import dex from "../../deployment/model/dex";
import Common from "../../e2e-test/business/Common";
import GodHolder from "../../e2e-test/business/GodHolder";
import NFTHolder from "../../e2e-test/business/NFTHolder";
import FTTokenHolderFactory from "../../e2e-test/business/factories/FTTokenHolderFactory";
import NFTTokenHolderFactory from "../../e2e-test/business/factories/NFTTokenHolderFactory";
import TokenTransferGovernor from "../../e2e-test/business/TokenTransferGovernor";

import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import {
  Client,
  TokenId,
  AccountId,
  ContractId,
  PrivateKey,
} from "@hashgraph/sdk";

const deployment = new Deployment();

const TRANSFER_TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const TRANSFER_TOKEN_QTY = 1e8;

const FT_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
const NFT_TOKEN_ID = dex.NFT_TOKEN_ID;

const txnFeePayerClient = clientsInfo.operatorClient;

const receiverAccountId = clientsInfo.uiUserId;
const receiverAccountPK = clientsInfo.uiUserKey;

const fungibleTokenFlow = async () => {
  const voterAccountId = clientsInfo.treasureId;
  const voterAccountKey = clientsInfo.treasureKey;
  const voterClient = clientsInfo.treasureClient;

  const ftHolderFactory = new FTTokenHolderFactory();
  await ftHolderFactory.initialize();

  const ftHolderContractId = await ftHolderFactory.getTokenHolder(
    FT_TOKEN_ID.toSolidityAddress()
  );
  const godHolder = new GodHolder(ftHolderContractId);

  const deploymentDetails = await deployment.deployProxy(
    ContractService.GOVERNOR_TT
  );
  const governor = new TokenTransferGovernor(
    ContractId.fromString(deploymentDetails.transparentProxyId)
  );
  await governor.initialize(
    godHolder,
    txnFeePayerClient,
    1,
    0,
    30,
    FT_TOKEN_ID,
    FT_TOKEN_ID
  );

  const quorum = await governor.quorum(txnFeePayerClient);
  const votingPowerAmount = await godHolder.balanceOfVoter(
    voterAccountId,
    txnFeePayerClient
  );

  // tokens locking required in token holder if not enough power locked
  if (votingPowerAmount < quorum) {
    await godHolder.setupAllowanceForTokenLocking(
      quorum,
      voterAccountId,
      voterAccountKey,
      txnFeePayerClient
    );
    await godHolder.lock(
      quorum,
      voterAccountId,
      voterAccountKey,
      txnFeePayerClient
    );
  }

  // step - 1
  await createTokenAssociateProposal(
    governor,
    godHolder,
    TRANSFER_TOKEN_ID,
    voterClient,
    txnFeePayerClient
  );

  // step - 2
  await createTokenTransferProposal(
    governor,
    godHolder,
    TRANSFER_TOKEN_ID,
    TRANSFER_TOKEN_QTY,
    receiverAccountId,
    receiverAccountPK,
    voterAccountId,
    voterAccountKey,
    voterClient,
    txnFeePayerClient
  );

  // unlock required tokens from token holder
  await godHolder.checkAndClaimGodTokens(voterClient, voterAccountId);
  await governor.upgradeHederaService();
};

const nonFungibleTokenFlow = async () => {
  const voterAccountId = clientsInfo.operatorId;
  const voterAccountKey = clientsInfo.operatorKey;
  const voterClient = clientsInfo.operatorClient;

  const nftHolderFactory = new NFTTokenHolderFactory();
  const nftHolderContractId = await nftHolderFactory.getTokenHolder(
    NFT_TOKEN_ID.toSolidityAddress()
  );
  const nftHolder = new NFTHolder(nftHolderContractId);

  const deploymentDetails = await deployment.deployProxy(
    ContractService.GOVERNOR_TT
  );
  const governor = new TokenTransferGovernor(
    ContractId.fromString(deploymentDetails.transparentProxyId)
  );

  await governor.initialize(
    nftHolder,
    txnFeePayerClient,
    500,
    0,
    30,
    NFT_TOKEN_ID,
    NFT_TOKEN_ID
  );

  const quorum = await governor.quorum(txnFeePayerClient);
  const votingPowerAmount = await nftHolder.balanceOfVoter(
    voterAccountId,
    txnFeePayerClient
  );

  // tokens locking required in token holder if not enough power locked
  if (votingPowerAmount < quorum) {
    await nftHolder.setupAllowanceForTokenLocking(
      voterAccountId,
      voterAccountKey,
      voterClient
    );
    await nftHolder.grabTokensForVoter(
      governor.DEFAULT_NFT_TOKEN_SERIAL_NO_FOR_VOTING,
      voterAccountId,
      voterAccountKey,
      voterClient
    );
  }

  // step - 1
  await createTokenAssociateProposal(
    governor,
    nftHolder,
    TRANSFER_TOKEN_ID,
    voterClient,
    txnFeePayerClient
  );

  // step - 2
  await createTokenTransferProposal(
    governor,
    nftHolder,
    TRANSFER_TOKEN_ID,
    TRANSFER_TOKEN_QTY,
    receiverAccountId,
    receiverAccountPK,
    voterAccountId,
    voterAccountKey,
    voterClient,
    txnFeePayerClient
  );

  await nftHolder.checkAndClaimGodTokens(voterClient, voterAccountId);
  await governor.upgradeHederaService();
};

async function createTokenAssociateProposal(
  governor: TokenTransferGovernor,
  tokenHolder: GodHolder | NFTHolder,
  tokenToAssociateId: TokenId,
  voterClient: Client,
  txnFeePayerClient: Client,
  creatorId: AccountId = clientsInfo.operatorId,
  creatorPK: PrivateKey = clientsInfo.operatorKey,
  creatorClient: Client = clientsInfo.operatorClient
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

  const title = Helper.createProposalTitle("Token Associate Proposal");
  const proposalId = await governor.createTokenAssociateProposal(
    title,
    tokenToAssociateId.toSolidityAddress(),
    txnFeePayerClient,
    "Token Association Proposal - Desc",
    "Token Association Proposal - LINK",
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
    creatorId.toSolidityAddress()
  );
  await governor.getProposalDetails(proposalId, voterClient);
  await governor.forVote(proposalId, 0, voterClient);
  await governor.getProposalDetails(proposalId, voterClient);
  if (await governor.isSucceeded(proposalId)) {
    await governor.executeProposal(title);
  } else {
    await governor.cancelProposal(title, creatorClient);
  }
}

async function createTokenTransferProposal(
  governor: TokenTransferGovernor,
  tokenHolder: GodHolder | NFTHolder,
  tokenId: TokenId,
  tokenQty: number,
  receiverAccountId: AccountId,
  receiverAccountPK: PrivateKey,
  senderAccountId: AccountId,
  senderAccountPK: PrivateKey,
  voterClient: Client,
  txnFeePayerClient: Client,
  creatorId: AccountId = clientsInfo.operatorId,
  creatorPK: PrivateKey = clientsInfo.operatorKey,
  creatorClient: Client = clientsInfo.operatorClient
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

  const title = Helper.createProposalTitle("Token Transfer Proposal");
  const proposalId = await governor.createTokenTransferProposal(
    title,
    receiverAccountId.toSolidityAddress(),
    tokenId.toSolidityAddress(),
    tokenQty,
    txnFeePayerClient,
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
    "Token Transfer Proposal - Desc",
    "Token Transfer Proposal - Link",
    creatorId.toSolidityAddress()
  );
  await governor.getProposalDetails(proposalId, voterClient);
  await governor.forVote(proposalId, 0, voterClient);
  await governor.getProposalDetails(proposalId, voterClient);
  if (await governor.isSucceeded(proposalId)) {
    // step - 1 transfer some amount to governance
    await Common.transferTokens(
      AccountId.fromString(governor.contractId),
      senderAccountId,
      senderAccountPK,
      TRANSFER_TOKEN_ID,
      TRANSFER_TOKEN_QTY,
      txnFeePayerClient
    );

    // step - 2 associate token to receiver
    await Common.associateTokensToAccount(
      receiverAccountId,
      [TRANSFER_TOKEN_ID],
      txnFeePayerClient,
      receiverAccountPK
    );
    await governor.executeProposal(title);
  } else {
    await governor.cancelProposal(title, creatorClient);
  }
}

async function main() {
  console.log("************************ FT Test ******************");
  await fungibleTokenFlow();
  console.log(`\n************************ NFT Test ******************\n`);
  await nonFungibleTokenFlow();
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
