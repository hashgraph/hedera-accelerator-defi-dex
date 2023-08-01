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
  fromAccount: AccountId = clientsInfo.treasureId,
  fromAccountPrivateKey: PrivateKey = clientsInfo.treasureKey,
  toAccount: AccountId = clientsInfo.operatorId,
  tokenId: TokenId = TOKEN_ID,
  tokenAmount: number = TOKEN_QTY,
  proposalCreatorClient: Client = clientsInfo.operatorClient,
  proposalCreatorAccountId: AccountId = clientsInfo.operatorId,
  proposalCreatorAccountPrivateKey: PrivateKey = clientsInfo.operatorKey,
  voterClient: Client = clientsInfo.operatorClient,
  voterAccountId: AccountId = clientsInfo.operatorId,
  voterAccountPrivateKey: PrivateKey = clientsInfo.operatorKey
) {
  await Common.associateTokensToAccount(
    voterAccountId,
    [dex.GOVERNANCE_DAO_ONE_TOKEN_ID],
    clientsInfo.treasureClient
  );

  await godHolder.setupAllowanceForTokenLocking(
    10005e8,
    voterAccountId,
    voterAccountPrivateKey,
    voterClient
  );

  await godHolder.lock(
    10005e8,
    voterAccountId,
    voterAccountPrivateKey,
    voterClient
  );

  const governorAddresses =
    await tokenTransferDAO.getGovernorTokenTransferContractAddresses();
  const governorTokenTransfer = new TokenTransferGovernor(
    governorAddresses.governorTokenTransferProxyId
  );

  await governorTokenTransfer.setupAllowanceForProposalCreation(
    proposalCreatorClient,
    proposalCreatorAccountId,
    proposalCreatorAccountPrivateKey
  );

  const title = Helper.createProposalTitle("Token Transfer Proposal");
  const proposalId = await tokenTransferDAO.createTokenTransferProposal(
    title,
    fromAccount.toSolidityAddress(),
    toAccount.toSolidityAddress(),
    tokenId.toSolidityAddress(),
    tokenAmount,
    proposalCreatorClient,
    GovernorTokenMetaData.DEFAULT_DESCRIPTION,
    GovernorTokenMetaData.DEFAULT_LINK,
    PROPOSAL_CREATE_NFT_SERIAL_ID
  );
  await governorTokenTransfer.getProposalDetails(proposalId);
  await governorTokenTransfer.forVote(proposalId, 0, voterClient);
  await governorTokenTransfer.isQuorumReached(proposalId);
  await governorTokenTransfer.isVoteSucceeded(proposalId);
  await governorTokenTransfer.proposalVotes(proposalId);
  if (await governorTokenTransfer.isSucceeded(proposalId)) {
    await governorTokenTransfer.setAllowanceForTransferTokenProposal(
      tokenId,
      tokenAmount,
      governorTokenTransfer.contractId,
      fromAccount,
      fromAccountPrivateKey
    );
    await governorTokenTransfer.executeProposal(title, fromAccountPrivateKey);
  } else {
    await governorTokenTransfer.cancelProposal(title, proposalCreatorClient);
  }
  await godHolder.checkAndClaimGodTokens(voterClient, voterAccountId);
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

  await godHolder.lock(
    10005e8,
    voterAccountId,
    voterAccountPrivateKey,
    voterClient
  );

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

  await godHolder.lock(
    10005e8,
    voterAccountId,
    voterAccountPrivateKey,
    voterClient
  );

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

  await godHolder.lock(
    10005e8,
    voterAccountId,
    voterAccountPrivateKey,
    voterClient
  );

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
    clientsInfo.operatorClient,
    GovernorTokenMetaData.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
    GovernorTokenMetaData.DEFAULT_VOTING_DELAY,
    GovernorTokenMetaData.DEFAULT_VOTING_PERIOD,
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
