import { Helper } from "../../utils/Helper";
import { AccountId, Client, PrivateKey, TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";

import dex from "../../deployment/model/dex";
import Governor from "../../e2e-test/business/Governor";
import NFTHolder from "../../e2e-test/business/NFTHolder";
import GovernorTokenDao from "../../e2e-test/business/GovernorTokenDao";
import * as GovernorTokenMetaData from "../../e2e-test/business/GovernorTokenDao";

import { InstanceProvider } from "../../utils/InstanceProvider";

const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const TOKEN_QTY = 1 * 1e8;

const adminAddress: string = clientsInfo.operatorId.toSolidityAddress();

async function main() {
  const provider = InstanceProvider.getInstance();
  const nftHolder = provider.getNonFungibleTokenHolder();
  const governorTT = provider.getGovernor(ContractService.GOVERNOR_TT);
  const governorTokenDao = provider.getGovernorTokenDao();

  await governorTokenDao.initialize(
    adminAddress,
    "Governor Token Dao",
    "dao url",
    governorTT,
    nftHolder
  );

  await executeGovernorTokenTransferFlow(
    nftHolder,
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
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
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
  voterClient: Client = clientsInfo.operatorClient
) {
  await nftHolder.grabTokensForVoter(
    12,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient
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
  await governorTokenTransfer.forVote(proposalId, 12, voterClient);
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
  await nftHolder.checkAndClaimNFTTokens(voterClient);
}
