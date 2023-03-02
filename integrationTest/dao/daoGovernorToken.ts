import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { TokenId } from "@hashgraph/sdk";

import dex from "../../deployment/model/dex";
import GovernorTokenDao from "../../e2e-test/business/GovernorTokenDao";
import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";

const csDev = new ContractService();
const governorTokenDaoProxyContractId = csDev.getContractWithProxy(
  csDev.governorTokenDao
).transparentProxyId!;
const godHolderProxyContractId = csDev.getContractWithProxy(
  csDev.godHolderContract
).transparentProxyId!;
const governorTokenTransferProxyContractId = csDev.getContractWithProxy(
  csDev.governorTTContractName
).transparentProxyId!;

const governorTokenDao = new GovernorTokenDao(governorTokenDaoProxyContractId);
const governorTokenTransfer = new Governor(
  governorTokenTransferProxyContractId
);
const adminAddress: string = clientsInfo.uiUserId.toSolidityAddress();
const godHolder = new GodHolder(godHolderProxyContractId);

const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const TOKEN_QTY = 1 * 1e8;

async function main() {
  await governorTokenDao.initialize(
    adminAddress,
    "Governor Token Dao",
    "dao url",
    governorTokenTransfer,
    godHolder
  );

  const title = "Create Token Proposal - 1";
  const proposalId = await governorTokenDao.createTokenTransferProposal(
    title,
    clientsInfo.treasureId.toSolidityAddress(),
    clientsInfo.operatorId.toSolidityAddress(),
    TOKEN_ID.toSolidityAddress(),
    TOKEN_QTY
  );
  await governorTokenTransfer.getProposalDetails(proposalId);
  await governorTokenTransfer.forVote(proposalId);
  await governorTokenTransfer.forVote(proposalId, clientsInfo.treasureClient);
  await governorTokenTransfer.isQuorumReached(proposalId);
  await governorTokenTransfer.isVoteSucceeded(proposalId);
  await governorTokenTransfer.proposalVotes(proposalId);
  await governorTokenTransfer.delay(proposalId);
  await governorTokenTransfer.executeProposal(title, clientsInfo.treasureKey);
  await godHolder.checkAndClaimedGodTokens(clientsInfo.treasureClient);
  await godHolder.checkAndClaimedGodTokens(clientsInfo.operatorClient);

  await governorTokenDao.addWebLink();
  await governorTokenDao.getWebLinks();
  await governorTokenDao.getDaoDetail();
  console.log(`\nDone`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
