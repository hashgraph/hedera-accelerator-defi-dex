import { Helper } from "../../utils/Helper";
import { AccountId, Client, PrivateKey, TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";

import dex from "../../deployment/model/dex";
import Governor from "../../e2e-test/business/Governor";
import NFTHolder from "../../e2e-test/business/NFTHolder";
import GovernorTokenDao from "../../e2e-test/business/GovernorTokenDao";

const csDev = new ContractService();

const governorTokenDaoProxyContractId = csDev.getContractWithProxy(
  csDev.governorTokenDao
).transparentProxyId!;
const governorTokenDao = new GovernorTokenDao(governorTokenDaoProxyContractId);

const governorTokenTransferProxyContractId = csDev.getContractWithProxy(
  csDev.governorTTContractName
).transparentProxyId!;
const governorTokenTransfer = new Governor(
  governorTokenTransferProxyContractId
);

const nftHolderProxyContractId = csDev.getContractWithProxy(
  csDev.nftHolderContract
).transparentProxyId!;
const nftHolder = new NFTHolder(nftHolderProxyContractId);

const adminAddress: string = clientsInfo.uiUserId.toSolidityAddress();

const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const TOKEN_QTY = 1 * 1e8;

async function main() {
  await governorTokenDao.initialize(
    adminAddress,
    "Governor Token Dao",
    "dao url",
    governorTokenTransfer,
    nftHolder
  );
  await nftHolder.grabTokensForVoter(
    clientsInfo.operatorId.toSolidityAddress(),
    1,
    clientsInfo.operatorClient
  );

  await executeGovernorTokenTransferFlow(
    nftHolder,
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
  proposalCreatorClient: Client = clientsInfo.uiUserClient,
  voterClient: Client = clientsInfo.operatorClient
) {
  const title = Helper.createProposalTitle("Transfer Token Proposal");
  const proposalId = await governorTokenDao.createTokenTransferProposal(
    title,
    fromAccount.toSolidityAddress(),
    toAccount.toSolidityAddress(),
    tokenId.toSolidityAddress(),
    tokenAmount,
    proposalCreatorClient
  );
  await governorTokenTransfer.getProposalDetails(proposalId);
  await governorTokenTransfer.forVote(proposalId, voterClient);
  await governorTokenTransfer.isQuorumReached(proposalId);
  await governorTokenTransfer.isVoteSucceeded(proposalId);
  await governorTokenTransfer.proposalVotes(proposalId);
  await governorTokenTransfer.delay(proposalId);
  await governorTokenTransfer.executeProposal(title, fromAccountPrivateKey);
  await nftHolder.checkAndClaimedNFTTokens(voterClient);
}
