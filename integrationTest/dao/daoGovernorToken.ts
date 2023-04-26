import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { InstanceProvider } from "../../utils/InstanceProvider";
import { main as deployContracts } from "../../deployment/scripts/createContractsE2E";
import { AccountId, Client, PrivateKey, TokenId } from "@hashgraph/sdk";

import dex from "../../deployment/model/dex";
import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";
import GovernorTokenDao from "../../e2e-test/business/GovernorTokenDao";
import * as GovernorTokenMetaData from "../../e2e-test/business/GovernorTokenDao";

const TOKEN_QTY = 1 * 1e8;
const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const DOA_ADMIN_ADDRESS = clientsInfo.operatorId.toSolidityAddress();

async function main() {
  const csDev = new ContractService();
  await deployContracts([
    csDev.governorTTContractName,
    csDev.governorTokenDao,
    csDev.godHolderContract,
  ]);

  const provider = InstanceProvider.getInstance();

  const godHolder = provider.getFungibleTokenHolder();
  const governorTT = provider.getGovernor(ContractService.GOVERNOR_TT);

  const governorTokenDao = provider.getGovernorTokenDao();
  await governorTokenDao.initialize(
    DOA_ADMIN_ADDRESS,
    "Governor Token Dao",
    "dao url",
    governorTT,
    godHolder,
    clientsInfo.operatorClient,
    GovernorTokenMetaData.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
    GovernorTokenMetaData.DEFAULT_VOTING_DELAY,
    GovernorTokenMetaData.DEFAULT_VOTING_PERIOD,
    dex.GOVERNANCE_DAO_ONE_TOKEN_ID,
    dex.GOVERNANCE_DAO_ONE_TOKEN_ID
  );

  await executeGovernorTokenTransferFlow(
    godHolder,
    governorTokenDao,
    governorTT
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
  proposalCreatorClient: Client = clientsInfo.operatorClient,
  proposalCreatorAccountId: AccountId = clientsInfo.operatorId,
  proposalCreatorAccountPrivateKey: PrivateKey = clientsInfo.operatorKey,
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
