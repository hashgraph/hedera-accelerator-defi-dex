import dex from "../../deployment/model/dex";
import GodHolder from "../../e2e-test/business/GodHolder";
import FTDAO from "../../e2e-test/business/FTDAO";
import * as GovernorTokenMetaData from "../../e2e-test/business/FTDAO";

import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import {
  Client,
  TokenId,
  AccountId,
  PrivateKey,
  ContractId,
} from "@hashgraph/sdk";
import Common from "../../e2e-test/business/Common";
import TokenTransferGovernor from "../../e2e-test/business/TokenTransferGovernor";
import TextGovernor from "../../e2e-test/business/TextGovernor";
import ContractUpgradeGovernor from "../../e2e-test/business/ContractUpgradeGovernor";
import FTTokenHolderFactory from "../../e2e-test/business/factories/FTTokenHolderFactory";
import TokenCreateGovernor from "../../e2e-test/business/TokenCreateGovernor";
import SystemRoleBasedAccess from "../../e2e-test/business/common/SystemRoleBasedAccess";

const TOKEN_QTY = 1 * 1e8;
const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const DOA_ADMIN_ADDRESS = clientsInfo.operatorId.toSolidityAddress();
const DAO_ADMIN_CLIENT = clientsInfo.operatorClient;
const DAO_DESC = "Lorem Ipsum is simply dummy text";
const DAO_WEB_LINKS = ["https://linkedin.com"];
const PROPOSAL_CREATE_NFT_SERIAL_ID = 1;

const deployment = new Deployment();

export async function executeGovernorTokenTransferFlow(
  godHolder: GodHolder,
  tokenTransferDAO: FTDAO,
  transferTokenId: TokenId = TOKEN_ID,
  transferTokenAmount: number = TOKEN_QTY,
  receiverAccountId: AccountId = clientsInfo.uiUserId,
  receiverAccountPK: PrivateKey = clientsInfo.uiUserKey,
  senderAccountId: AccountId = clientsInfo.treasureId,
  senderAccountPK: PrivateKey = clientsInfo.treasureKey,
  daoAdminClient: Client = DAO_ADMIN_CLIENT,
  daoAdminId: AccountId = clientsInfo.operatorId,
  daoAdminPK: PrivateKey = clientsInfo.operatorKey,
  voterClient: Client = clientsInfo.treasureClient,
  voterAccountId: AccountId = clientsInfo.treasureId,
  voterAccountKey: PrivateKey = clientsInfo.treasureKey,
  txnFeePayerClient: Client = clientsInfo.operatorClient
) {
  const governorAddresses =
    await tokenTransferDAO.getGovernorTokenTransferContractAddresses();
  const governor = new TokenTransferGovernor(
    governorAddresses.governorTokenTransferProxyId
  );

  const quorum = await governor.quorum(txnFeePayerClient);
  const votingPowerAmount = await godHolder.balanceOfVoter(
    voterAccountId,
    txnFeePayerClient
  );

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

  // step -1 association proposal
  await governor.setupAllowanceForProposalCreation(
    daoAdminClient,
    daoAdminId,
    daoAdminPK
  );

  const title = Helper.createProposalTitle("Token Associate Proposal");
  const proposalId = await tokenTransferDAO.createTokenAssociateProposal(
    title,
    transferTokenId.toSolidityAddress(),
    daoAdminClient,
    "DAO Token Association Proposal - Desc",
    "DAO Token Association Proposal - LINK",
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO
  );
  await governor.getProposalDetails(proposalId, voterClient);
  await governor.forVote(proposalId, 0, voterClient);
  await governor.getProposalDetails(proposalId, voterClient);
  if (await governor.isSucceeded(proposalId)) {
    await governor.executeProposal(title);
  } else {
    await governor.cancelProposal(title, daoAdminClient);
  }

  // step -2 transfer proposal
  await governor.setupAllowanceForProposalCreation(
    daoAdminClient,
    daoAdminId,
    daoAdminPK
  );

  const title1 = Helper.createProposalTitle("Token Transfer Proposal");
  const proposalId1 = await tokenTransferDAO.createTokenTransferProposal(
    title1,
    receiverAccountId.toSolidityAddress(),
    transferTokenId.toSolidityAddress(),
    transferTokenAmount,
    daoAdminClient,
    "DAO Token Transfer Proposal - Desc",
    "DAO Token Transfer Proposal - Link",
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO
  );
  await governor.getProposalDetails(proposalId1, voterClient);
  await governor.forVote(proposalId1, 0, voterClient);
  await governor.getProposalDetails(proposalId1, voterClient);
  if (await governor.isSucceeded(proposalId1)) {
    // step - 1 transfer some amount to governance
    await Common.transferTokens(
      AccountId.fromString(governor.contractId),
      senderAccountId,
      senderAccountPK,
      transferTokenId,
      transferTokenAmount,
      txnFeePayerClient
    );

    // step - 2 associate token to receiver
    await Common.associateTokensToAccount(
      receiverAccountId,
      [transferTokenId],
      txnFeePayerClient,
      receiverAccountPK
    );
    await governor.executeProposal(title1);
  } else {
    await governor.cancelProposal(title1, daoAdminClient);
  }

  await godHolder.checkAndClaimGodTokens(voterClient, voterAccountId);
  await tokenTransferDAO.getTokenTransferProposals();
}

export async function executeTextProposalFlow(
  godHolder: GodHolder,
  tokenTransferDAO: FTDAO,
  tokenId: TokenId = TOKEN_ID,
  proposalCreatorClient: Client = clientsInfo.operatorClient,
  proposalCreatorAccountId: AccountId = clientsInfo.operatorId,
  proposalCreatorAccountPrivateKey: PrivateKey = clientsInfo.operatorKey,
  voterClient: Client = clientsInfo.operatorClient,
  voterAccountId: AccountId = clientsInfo.operatorId,
  voterAccountPrivateKey: PrivateKey = clientsInfo.operatorKey
) {
  await godHolder.setupAllowanceForTokenLocking(
    10005e8,
    voterAccountId,
    voterAccountPrivateKey,
    voterClient
  );

  await godHolder.lock(10005e8, voterClient);

  const governorAddresses =
    await tokenTransferDAO.getGovernorTokenTransferContractAddresses();
  const governorTextProposal = new TextGovernor(
    governorAddresses.governorTextProposalProxyId
  );

  await governorTextProposal.setupAllowanceForProposalCreation(
    proposalCreatorClient,
    proposalCreatorAccountId,
    proposalCreatorAccountPrivateKey
  );

  const title = Helper.createProposalTitle("Text proposal");

  const proposalId = await tokenTransferDAO.createTextProposal(
    title,
    proposalCreatorClient,
    GovernorTokenMetaData.DEFAULT_DESCRIPTION,
    GovernorTokenMetaData.DEFAULT_LINK,
    PROPOSAL_CREATE_NFT_SERIAL_ID
  );

  await governorTextProposal.getProposalDetails(proposalId);
  await governorTextProposal.forVote(proposalId, 0, voterClient);
  await governorTextProposal.isQuorumReached(proposalId);
  await governorTextProposal.isVoteSucceeded(proposalId);
  await governorTextProposal.proposalVotes(proposalId);
  if (await governorTextProposal.isSucceeded(proposalId)) {
    await governorTextProposal.executeProposal(
      title,
      clientsInfo.operatorKey,
      clientsInfo.operatorClient
    );
  } else {
    await governorTextProposal.cancelProposal(title, proposalCreatorClient);
  }
  await godHolder.checkAndClaimGodTokens(voterClient, voterAccountId);
}

export async function executeContractUpgradeFlow(
  godHolder: GodHolder,
  dao: FTDAO,
  proxyContract: string,
  contractToUpgrade: string,
  tokenId: TokenId = TOKEN_ID,
  proposalCreatorClient: Client = clientsInfo.operatorClient,
  proposalCreatorAccountId: AccountId = clientsInfo.operatorId,
  proposalCreatorAccountPrivateKey: PrivateKey = clientsInfo.operatorKey,
  voterClient: Client = clientsInfo.operatorClient,
  voterAccountId: AccountId = clientsInfo.operatorId,
  voterAccountPrivateKey: PrivateKey = clientsInfo.operatorKey
) {
  await godHolder.setupAllowanceForTokenLocking(
    10005e8,
    voterAccountId,
    voterAccountPrivateKey,
    voterClient
  );

  await godHolder.lock(10005e8, voterClient);

  const governorAddresses =
    await dao.getGovernorTokenTransferContractAddresses();
  const governorContractUpgrade = new ContractUpgradeGovernor(
    governorAddresses.governorUpgradeProxyId
  );

  await governorContractUpgrade.setupAllowanceForProposalCreation(
    proposalCreatorClient,
    proposalCreatorAccountId,
    proposalCreatorAccountPrivateKey
  );

  const title = Helper.createProposalTitle("Contract upgrade proposal");

  const proposalId = await dao.createContractUpgradeProposal(
    title,
    proxyContract,
    contractToUpgrade,
    proposalCreatorClient,
    GovernorTokenMetaData.DEFAULT_DESCRIPTION,
    GovernorTokenMetaData.DEFAULT_LINK,
    PROPOSAL_CREATE_NFT_SERIAL_ID
  );

  await governorContractUpgrade.getProposalDetails(proposalId);
  await governorContractUpgrade.forVote(proposalId, 0, voterClient);
  await governorContractUpgrade.isQuorumReached(proposalId);
  await governorContractUpgrade.isVoteSucceeded(proposalId);
  await governorContractUpgrade.proposalVotes(proposalId);
  if (await governorContractUpgrade.isSucceeded(proposalId)) {
    await governorContractUpgrade.executeProposal(
      title,
      clientsInfo.operatorKey,
      clientsInfo.operatorClient
    );
    const { proxyAddress, logicAddress } =
      await governorContractUpgrade.getContractAddressesFromGovernorUpgradeContract(
        proposalId
      );
    await new Common(ContractId.fromSolidityAddress(proxyAddress)).upgradeTo(
      proxyAddress,
      logicAddress
    );
  } else {
    await governorContractUpgrade.cancelProposal(title, proposalCreatorClient);
  }
  await godHolder.checkAndClaimGodTokens(voterClient, voterAccountId);
}

export async function executeTokenCreateFlow(
  godHolder: GodHolder,
  dao: FTDAO,
  tokenName: string,
  tokenSymbol: string,
  treasurer: AccountId = clientsInfo.treasureId,
  proposalCreatorClient: Client = clientsInfo.operatorClient,
  proposalCreatorAccountId: AccountId = clientsInfo.operatorId,
  proposalCreatorAccountPrivateKey: PrivateKey = clientsInfo.operatorKey,
  voterClient: Client = clientsInfo.operatorClient,
  voterAccountId: AccountId = clientsInfo.operatorId,
  voterAccountPrivateKey: PrivateKey = clientsInfo.operatorKey
) {
  await godHolder.setupAllowanceForTokenLocking(
    10005e8,
    voterAccountId,
    voterAccountPrivateKey,
    voterClient
  );

  await godHolder.lock(10005e8, voterClient);

  const governorAddresses =
    await dao.getGovernorTokenTransferContractAddresses();

  const governorTokenCreate = new TokenCreateGovernor(
    governorAddresses.governorTokenCreateProxyId
  );

  await governorTokenCreate.setupAllowanceForProposalCreation(
    proposalCreatorClient,
    proposalCreatorAccountId,
    proposalCreatorAccountPrivateKey
  );

  const title = Helper.createProposalTitle("Token create proposal");

  const proposalId = await dao.createTokenProposal(
    title,
    tokenName,
    tokenSymbol,
    treasurer,
    clientsInfo.operatorClient,
    GovernorTokenMetaData.DEFAULT_DESCRIPTION,
    GovernorTokenMetaData.DEFAULT_LINK,
    PROPOSAL_CREATE_NFT_SERIAL_ID
  );

  await governorTokenCreate.getProposalDetails(proposalId);
  await governorTokenCreate.forVote(proposalId, 0, voterClient);
  await governorTokenCreate.isQuorumReached(proposalId);
  await governorTokenCreate.isVoteSucceeded(proposalId);
  await governorTokenCreate.proposalVotes(proposalId);
  if (await governorTokenCreate.isSucceeded(proposalId)) {
    await governorTokenCreate.executeProposal(
      title,
      clientsInfo.operatorKey,
      clientsInfo.operatorClient
    );
    await governorTokenCreate.getTokenAddressFromGovernorTokenCreate(
      proposalId
    );
  } else {
    await governorTokenCreate.cancelProposal(title, proposalCreatorClient);
  }
  await godHolder.checkAndClaimGodTokens(voterClient, voterAccountId);
}

async function main() {
  const roleBasedAccess = new SystemRoleBasedAccess();
  const newCopies = await deployment.deployProxies([ContractService.FT_DAO]);

  const ftDaoDeployed = newCopies.get(ContractService.FT_DAO);
  const ftDao = new FTDAO(ContractId.fromString(ftDaoDeployed.id));

  const tokenHolderFactory = new FTTokenHolderFactory();
  const godHolderContractId = await tokenHolderFactory.getTokenHolder(
    dex.GOVERNANCE_DAO_ONE_TOKEN_ID.toSolidityAddress()
  );
  const godHolder = new GodHolder(godHolderContractId);

  await ftDao.initialize(
    DOA_ADMIN_ADDRESS,
    "Governor Token Dao",
    "dao url",
    DAO_DESC,
    DAO_WEB_LINKS,
    godHolder,
    DAO_ADMIN_CLIENT,
    1,
    0,
    30,
    dex.GOVERNANCE_DAO_ONE_TOKEN_ID,
    dex.GOVERNANCE_DAO_ONE_TOKEN_ID
  );

  await executeGovernorTokenTransferFlow(godHolder, ftDao);

  await executeTextProposalFlow(godHolder, ftDao);

  await executeTokenCreateFlow(
    godHolder,
    ftDao,
    "Name",
    "Symbol",
    clientsInfo.treasureId
  );

  DAO_WEB_LINKS.push("https://github.com");
  await ftDao.updateDaoInfo(
    "Governor Token Dao - New",
    "dao url - New",
    "desc - New",
    DAO_WEB_LINKS,
    DAO_ADMIN_CLIENT
  );

  await ftDao.getTokenTransferProposals();
  const hasRole = await roleBasedAccess.checkIfChildProxyAdminRoleGiven();
  hasRole &&
    (await ftDao.upgradeHederaService(clientsInfo.childProxyAdminClient));
  console.log(`\nDone`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
