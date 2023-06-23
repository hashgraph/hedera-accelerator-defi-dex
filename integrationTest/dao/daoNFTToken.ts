import dex from "../../deployment/model/dex";
import Governor from "../../e2e-test/business/Governor";
import NFTHolder from "../../e2e-test/business/NFTHolder";
import GovernorTokenDao from "../../e2e-test/business/GovernorTokenDao";
import * as GovernorTokenMetaData from "../../e2e-test/business/GovernorTokenDao";

import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { InstanceProvider } from "../../utils/InstanceProvider";
import { AccountId, Client, PrivateKey, TokenId } from "@hashgraph/sdk";

const NFT_ID = 19;
const TOKEN_QTY = 1 * 1e8;
const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const adminAddress: string = clientsInfo.operatorId.toSolidityAddress();
const DAO_ADMIN_CLIENT = clientsInfo.operatorClient;
const DAO_DESC = "Lorem Ipsum is simply dummy text";
const DAO_WEB_LINKS = ["LINKEDIN", "https://linkedin.com"];

const deployment = new Deployment();
const provider = InstanceProvider.getInstance();

async function main() {
  const newCopies = await deployment.deployProxies([ContractService.FTDAO]);

  const transferDao = newCopies.get(ContractService.FTDAO);

  const tokenTransferDAO = provider.getGovernorTokenDao(transferDao.id);

  const nftHolder = await provider.getNFTTokenHolderFromFactory(
    GovernorTokenMetaData.NFT_TOKEN_ID
  );

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
    GovernorTokenMetaData.GOD_TOKEN_ID,
    GovernorTokenMetaData.NFT_TOKEN_ID
  );

  await executeGovernorTokenTransferFlow(nftHolder, tokenTransferDAO);

  await tokenTransferDAO.addWebLink("GIT", "https://git.com", DAO_ADMIN_CLIENT);
  await tokenTransferDAO.updateName(
    "Governor Token Dao - New",
    DAO_ADMIN_CLIENT
  );
  await tokenTransferDAO.updateLogoURL("dao url - New", DAO_ADMIN_CLIENT);
  await tokenTransferDAO.updateDescription("desc - New", DAO_ADMIN_CLIENT);
  await tokenTransferDAO.getDaoDetail();
  await tokenTransferDAO.upgradeHederaService();
  console.log(`\nDone`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}

export async function executeGovernorTokenTransferFlow(
  nftHolder: NFTHolder,
  tokenTransferDAO: GovernorTokenDao,
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
    NFT_ID,
    voterAccountId,
    voterAccountPrivateKey,
    voterClient
  );

  const governorAddresses =
    await tokenTransferDAO.getGovernorTokenTransferContractAddresses();
  const governorTokenTransfer = new Governor(
    governorAddresses.governorTokenTransferProxyId.toString()
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
    GovernorTokenMetaData.DEFAULT_LINK
  );

  await governorTokenTransfer.getProposalDetails(proposalId);
  await governorTokenTransfer.forVote(proposalId, NFT_ID, voterClient);
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
  await nftHolder.checkAndClaimNFTTokens(voterClient);
}
