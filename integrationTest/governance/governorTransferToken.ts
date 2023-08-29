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
  Hbar,
  Client,
  TokenId,
  HbarUnit,
  AccountId,
  ContractId,
  PrivateKey,
} from "@hashgraph/sdk";

const deployment = new Deployment();

const TRANSFER_TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const TRANSFER_TOKEN_QTY = 1e8;
const TRANSFER_AMOUNT = Hbar.from(8, HbarUnit.Hbar);

const FT_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
const NFT_TOKEN_ID = dex.NFT_TOKEN_ID;

const txnFeePayerClient = clientsInfo.operatorClient;

const receiverAccountId = clientsInfo.uiUserId;
const receiverAccountPK = clientsInfo.uiUserKey;

const tokenTransferWithFungibleTokenAsGODToken = async () => {
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
    20,
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
    const lockAmount = quorum - votingPowerAmount;
    await godHolder.setupAllowanceForTokenLocking(
      lockAmount,
      voterAccountId,
      voterAccountKey,
      txnFeePayerClient
    );
    await godHolder.lock(lockAmount, voterClient);
  }

  // step - 1 (A) ft token association
  await createTokenAssociateProposal(
    governor,
    godHolder,
    TRANSFER_TOKEN_ID,
    voterClient,
    txnFeePayerClient
  );

  // step - 1 (B) ft transfer flow
  await createFTTokenTransferProposal(
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

  // step - 2 (A) nft token association
  await createTokenAssociateProposal(
    governor,
    godHolder,
    NFT_TOKEN_ID,
    voterClient,
    txnFeePayerClient
  );

  // step - 2 (B) nft transfer flow
  await createNFTTokenTransferProposal(
    governor,
    godHolder,
    NFT_TOKEN_ID,
    governor.DEFAULT_NFT_TOKEN_FOR_TRANSFER,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    voterClient,
    txnFeePayerClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient
  );

  // step - 3 transfer HBar flow
  await createHBarTransferProposal(
    governor,
    godHolder,
    TRANSFER_AMOUNT,
    receiverAccountId,
    voterClient,
    txnFeePayerClient
  );

  // unlock required tokens from token holder
  await godHolder.checkAndClaimGodTokens(voterClient, voterAccountId);
  await governor.upgradeHederaService();
};

const tokenTransferWithNonFungibleTokenAsGODToken = async () => {
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
    1,
    0,
    20,
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
      voterClient
    );
  }

  // step - 1 (A) ft token association
  await createTokenAssociateProposal(
    governor,
    nftHolder,
    TRANSFER_TOKEN_ID,
    voterClient,
    txnFeePayerClient
  );

  // step - 1 (B) ft token transfer
  await createFTTokenTransferProposal(
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

  // step - 2 (A) nft token association
  await createTokenAssociateProposal(
    governor,
    nftHolder,
    NFT_TOKEN_ID,
    voterClient,
    txnFeePayerClient
  );

  // step - 2 (B) nft transfer flow
  await createNFTTokenTransferProposal(
    governor,
    nftHolder,
    NFT_TOKEN_ID,
    governor.DEFAULT_NFT_TOKEN_FOR_TRANSFER,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    voterClient,
    txnFeePayerClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient
  );

  // step -3 transfer HBar flow
  await createHBarTransferProposal(
    governor,
    nftHolder,
    TRANSFER_AMOUNT,
    receiverAccountId,
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

async function createFTTokenTransferProposal(
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

async function createNFTTokenTransferProposal(
  governor: TokenTransferGovernor,
  tokenHolder: GodHolder | NFTHolder,
  nftToken: TokenId,
  nftTokenSerialId: number,
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

  const title = Helper.createProposalTitle("NFT Token Transfer Proposal");
  const proposalId = await governor.createTokenTransferProposal(
    title,
    receiverAccountId.toSolidityAddress(),
    nftToken.toSolidityAddress(),
    nftTokenSerialId,
    txnFeePayerClient,
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
    "NFT Token Transfer Proposal - Desc",
    "NFT Token Transfer Proposal - Link",
    creatorId.toSolidityAddress()
  );
  await governor.getProposalDetails(proposalId, voterClient);
  await governor.forVote(proposalId, 0, voterClient);
  await governor.getProposalDetails(proposalId, voterClient);
  if (await governor.isSucceeded(proposalId)) {
    // step - 1 transfer some amount to governance
    await Common.transferNFTTokenFromUser(
      nftToken,
      nftTokenSerialId,
      senderAccountId,
      senderAccountPK,
      governor.contractId,
      txnFeePayerClient
    );

    // step - 2 associate token to receiver
    await Common.associateTokensToAccount(
      receiverAccountId,
      [nftToken],
      txnFeePayerClient,
      receiverAccountPK
    );
    await governor.executeProposal(title);
  } else {
    await governor.cancelProposal(title, creatorClient);
  }
}

async function createHBarTransferProposal(
  governor: TokenTransferGovernor,
  tokenHolder: GodHolder | NFTHolder,
  amount: Hbar,
  receiverAccountId: AccountId,
  voterClient: Client,
  txnFeePayerClient: Client,
  senderAccountId: AccountId = clientsInfo.operatorId,
  senderAccountClient: Client = clientsInfo.operatorClient,
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
  const title = Helper.createProposalTitle("HBar Transfer Proposal");
  const proposalId = await governor.createHBarTransferProposal(
    title,
    receiverAccountId.toSolidityAddress(),
    amount.to(HbarUnit.Tinybar),
    txnFeePayerClient,
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
    "HBar Transfer Proposal - Desc",
    "HBar Transfer Proposal - Link",
    creatorId.toSolidityAddress()
  );
  await governor.getProposalDetails(proposalId, voterClient);
  await governor.forVote(proposalId, 0, voterClient);
  await governor.getProposalDetails(proposalId, voterClient);
  if (await governor.isSucceeded(proposalId)) {
    // transfer amount to governance
    await Common.transferHbarsToContract(
      amount,
      ContractId.fromString(governor.contractId),
      senderAccountId,
      senderAccountClient
    );
    await governor.executeProposal(title);
  } else {
    await governor.cancelProposal(title, creatorClient);
  }
}

async function main() {
  console.log("************************ FT Test ******************");
  await tokenTransferWithFungibleTokenAsGODToken();
  console.log(`\n************************ NFT Test ******************\n`);
  await tokenTransferWithNonFungibleTokenAsGODToken();
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
