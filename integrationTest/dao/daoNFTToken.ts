import dex from "../../deployment/model/dex";
import NFTHolder from "../../e2e-test/business/NFTHolder";
import FTDAO from "../../e2e-test/business/FTDAO";
import * as GovernorTokenMetaData from "../../e2e-test/business/FTDAO";

import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import {
  AccountId,
  Client,
  ContractId,
  PrivateKey,
  TokenId,
} from "@hashgraph/sdk";
import TokenTransferGovernor from "../../e2e-test/business/TokenTransferGovernor";
import NFTTokenHolderFactory from "../../e2e-test/business/factories/NFTTokenHolderFactory";
import SystemRoleBasedAccess from "../../e2e-test/business/common/SystemRoleBasedAccess";

const NFT_ID_FOR_VOTING = 12;
const PROPOSAL_CREATE_NFT_SERIAL_ID = 13;
const TOKEN_QTY = 1 * 1e8;
const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const adminAddress: string = clientsInfo.operatorId.toSolidityAddress();
const DAO_ADMIN_CLIENT = clientsInfo.operatorClient;
const DAO_DESC = "Lorem Ipsum is simply dummy text";
const DAO_WEB_LINKS = ["https://linkedin.com"];

const deployment = new Deployment();

async function main() {
  const newCopies = await deployment.deployProxies([ContractService.FT_DAO]);

  const transferDao = newCopies.get(ContractService.FT_DAO);

  const tokenTransferDAO = new FTDAO(ContractId.fromString(transferDao.id));

  const roleBasedAccess = new SystemRoleBasedAccess();

  const tokenHolderFactory = new NFTTokenHolderFactory();

  const nftHolderContractId = await tokenHolderFactory.getTokenHolder(
    GovernorTokenMetaData.NFT_TOKEN_ID.toSolidityAddress()
  );
  const nftHolder = new NFTHolder(nftHolderContractId);

  await tokenTransferDAO.initialize(
    adminAddress,
    "Governor Token Dao",
    "dao url",
    DAO_DESC,
    DAO_WEB_LINKS,
    nftHolder,
    clientsInfo.operatorClient,
    GovernorTokenMetaData.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
    GovernorTokenMetaData.DEFAULT_VOTING_DELAY,
    GovernorTokenMetaData.DEFAULT_VOTING_PERIOD,
    GovernorTokenMetaData.NFT_TOKEN_ID,
    GovernorTokenMetaData.NFT_TOKEN_ID
  );

  await executeGovernorTokenTransferFlow(nftHolder, tokenTransferDAO);

  DAO_WEB_LINKS.push("https://github.com");
  await tokenTransferDAO.updateDaoInfo(
    "Governor Token Dao - New",
    "dao url - New",
    "desc - New",
    DAO_WEB_LINKS,
    DAO_ADMIN_CLIENT
  );
  const hasRole = await roleBasedAccess.checkIfChildProxyAdminRoleGiven();
  hasRole &&
    (await tokenTransferDAO.upgradeHederaService(
      clientsInfo.childProxyAdminClient
    ));
  console.log(`\nDone`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}

export async function executeGovernorTokenTransferFlow(
  nftHolder: NFTHolder,
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
  await nftHolder.setupAllowanceForTokenLocking(
    voterAccountId,
    voterAccountPrivateKey,
    voterClient
  );

  await nftHolder.grabTokensForVoter(
    NFT_ID_FOR_VOTING,
    voterAccountId,
    voterAccountPrivateKey,
    voterClient
  );

  const governorAddresses =
    await tokenTransferDAO.getGovernorTokenTransferContractAddresses();

  const governorTokenTransfer = new TokenTransferGovernor(
    governorAddresses.governorTokenTransferProxyId
  );

  await governorTokenTransfer.setupNFTAllowanceForProposalCreation(
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
  await governorTokenTransfer.forVote(
    proposalId,
    NFT_ID_FOR_VOTING,
    voterClient
  );
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

  await nftHolder.checkAndClaimNFTTokens(voterClient, voterAccountId);
}
