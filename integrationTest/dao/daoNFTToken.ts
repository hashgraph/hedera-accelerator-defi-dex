import { Helper } from "../../utils/Helper";
import { AccountId, Client, PrivateKey, TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { InstanceProvider } from "../../utils/InstanceProvider";
import { main as deployContracts } from "../../deployment/scripts/createContractsE2E";

import dex from "../../deployment/model/dex";
import Governor from "../../e2e-test/business/Governor";
import NFTHolder from "../../e2e-test/business/NFTHolder";
import GovernorTokenDao from "../../e2e-test/business/GovernorTokenDao";
import * as GovernorTokenMetaData from "../../e2e-test/business/GovernorTokenDao";

const TOKEN_QTY = 1 * 1e8;
const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const adminAddress: string = clientsInfo.operatorId.toSolidityAddress();
const DAO_ADMIN_CLIENT = clientsInfo.operatorClient;
const DAO_DESC = "Lorem Ipsum is simply dummy text";
const DAO_WEB_LINKS = ["LINKEDIN", "https://linkedin.com"];

async function main() {
  const csDev = new ContractService();
  await deployContracts([
    csDev.governorTTContractName,
    csDev.governorTokenDao,
    csDev.nftHolderContract,
  ]);

  const provider = InstanceProvider.getInstance();

  const nftHolder = provider.getNonFungibleTokenHolder();
  const governorTT = provider.getGovernor(ContractService.GOVERNOR_TT);

  const governorTokenDao = provider.getGovernorTokenDao();
  await governorTokenDao.initialize(
    adminAddress,
    "Governor Token Dao",
    "dao url",
    DAO_DESC,
    DAO_WEB_LINKS,
    governorTT,
    nftHolder,
    clientsInfo.operatorClient,
    GovernorTokenMetaData.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
    GovernorTokenMetaData.DEFAULT_VOTING_DELAY,
    GovernorTokenMetaData.DEFAULT_VOTING_PERIOD,
    GovernorTokenMetaData.GOD_TOKEN_ID,
    GovernorTokenMetaData.NFT_TOKEN_ID
  );

  await executeGovernorTokenTransferFlow(
    nftHolder,
    governorTokenDao,
    governorTT
  );

  await governorTokenDao.addWebLink("GIT", "https://git.com", DAO_ADMIN_CLIENT);
  await governorTokenDao.updateName(
    "Governor Token Dao - New",
    DAO_ADMIN_CLIENT
  );
  await governorTokenDao.updateLogoURL("dao url - New", DAO_ADMIN_CLIENT);
  await governorTokenDao.updateDescription("desc - New", DAO_ADMIN_CLIENT);
  await governorTokenDao.getDaoDetail();
  await governorTokenDao.upgradeHederaService();
  console.log(`\nDone`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}

export async function executeGovernorTokenTransferFlow(
  nftHolder: NFTHolder,
  governorTokenDao: GovernorTokenDao,
  governorTokenTransfer: Governor,
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
    20,
    voterAccountId,
    voterAccountPrivateKey,
    voterClient
  );
  await governorTokenTransfer.setupAllowanceForProposalCreation(
    proposalCreatorClient,
    proposalCreatorAccountId,
    proposalCreatorAccountPrivateKey
  );

  const title = Helper.createProposalTitle("Token Transfer Proposal");
  const proposalId = await governorTokenDao.createTokenTransferProposal(
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
  await governorTokenTransfer.forVote(proposalId, 20, voterClient);
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
