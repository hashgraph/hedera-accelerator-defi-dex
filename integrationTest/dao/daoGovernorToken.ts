import { Helper } from "../../utils/Helper";
import { AccountId, Client, PrivateKey, TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";

import dex from "../../deployment/model/dex";
import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";
import GovernorTokenDao from "../../e2e-test/business/GovernorTokenDao";
import * as GovernorTokenMetaData from "../../e2e-test/business/GovernorTokenDao";

const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const TOKEN_QTY = 1 * 1e8;

const adminAddress: string = clientsInfo.uiUserId.toSolidityAddress();

async function main() {
  const csDev = new ContractService();

  const governorTokenDaoProxyId = csDev.getContractWithProxy(
    csDev.governorTokenDao
  ).transparentProxyId!;

  const governorTokenTransferProxyId = csDev.getContractWithProxy(
    csDev.governorTTContractName
  ).transparentProxyId!;

  const godHolderProxyId = csDev.getContractWithProxy(csDev.godHolderContract)
    .transparentProxyId!;

  const godHolder = new GodHolder(godHolderProxyId);
  const governorTokenTransfer = new Governor(governorTokenTransferProxyId);
  const governorTokenDao = new GovernorTokenDao(governorTokenDaoProxyId);

  await governorTokenDao.initialize(
    adminAddress,
    "Governor Token Dao",
    "dao url",
    governorTokenTransfer,
    godHolder
  );

  await executeGovernorTokenTransferFlow(
    godHolder,
    governorTokenDao,
    governorTokenTransfer
  );

  await governorTokenDao.addWebLink();
  await governorTokenDao.getWebLinks();
  await governorTokenDao.getDaoDetail();
  console.log(`\nDone`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}

export async function executeGovernorTokenTransferFlow(
  godHolder: GodHolder,
  governorTokenDao: GovernorTokenDao,
  governorTokenTransfer: Governor,
  fromAccount: AccountId = clientsInfo.treasureId,
  fromAccountPrivateKey: PrivateKey = clientsInfo.treasureKey,
  toAccount: AccountId = clientsInfo.operatorId,
  tokenId: TokenId = TOKEN_ID,
  tokenAmount: number = TOKEN_QTY,
  proposalCreatorClient: Client = clientsInfo.uiUserClient,
  proposalCreatorAccountId: AccountId = clientsInfo.uiUserId,
  proposalCreatorAccountPrivateKey: PrivateKey = clientsInfo.uiUserKey,
  voterClient: Client = clientsInfo.operatorClient,
  voterAccountId: AccountId = clientsInfo.operatorId,
  voterAccountPrivateKey: PrivateKey = clientsInfo.operatorKey
) {
  await godHolder.lock(
    10005e8,
    10005e8,
    voterAccountId,
    voterAccountPrivateKey,
    voterClient
  );
  const title = Helper.createProposalTitle("Token Transfer Proposal");
  const proposalId = await governorTokenDao.createTokenTransferProposal(
    title,
    fromAccount.toSolidityAddress(),
    toAccount.toSolidityAddress(),
    tokenId.toSolidityAddress(),
    tokenAmount,
    proposalCreatorClient,
    GovernorTokenMetaData.DEFAULT_LINK,
    GovernorTokenMetaData.DEFAULT_DESCRIPTION,
    proposalCreatorAccountId,
    proposalCreatorAccountPrivateKey,
    governorTokenTransfer
  );
  await governorTokenTransfer.getProposalDetails(proposalId);
  await governorTokenTransfer.forVote(proposalId, 0, voterClient);
  await governorTokenTransfer.isQuorumReached(proposalId);
  await governorTokenTransfer.isVoteSucceeded(proposalId);
  await governorTokenTransfer.proposalVotes(proposalId);
  if (await governorTokenTransfer.isSucceeded(proposalId)) {
    await governorTokenTransfer.setAllowanceAndExecuteTTProposal(
      title,
      tokenId,
      tokenAmount,
      governorTokenTransfer.contractId,
      fromAccount,
      fromAccountPrivateKey
    );
  } else {
    await governorTokenTransfer.cancelProposal(title, proposalCreatorClient);
  }
  await godHolder.checkAndClaimGodTokens(voterClient, voterAccountId);
}
