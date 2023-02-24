import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { TokenId } from "@hashgraph/sdk";

import dex from "../../deployment/model/dex";
import GovernorTokenDao from "../../e2e-test/business/GovernorTokenDao";
import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";

const csDev = new ContractService();
const governorTokenDaoContractId = csDev.getContractWithProxy(
  csDev.governorTokenDao
).transparentProxyId!;
const godHolderAddress = csDev.getContractWithProxy(csDev.godHolderContract)
  .transparentProxyId!;
const governorTokenTransferContractId = csDev.getContractWithProxy(
  csDev.governorTTContractName
).transparentProxyId!;
const governorTokenDao = new GovernorTokenDao(governorTokenDaoContractId);
const governor = new Governor(governorTokenTransferContractId);
const adminAddress: string = clientsInfo.uiUserId.toSolidityAddress();
const godHolder = new GodHolder(godHolderAddress);

const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const TOKEN_QTY = 1 * 1e8;

async function main() {
  await governorTokenDao.initialize(
    adminAddress,
    "Governor Token Dao",
    "dao url",
    governor,
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
  await governor.getProposalDetails(proposalId);
  await governor.forVote(proposalId);
  await governor.forVote(proposalId, clientsInfo.treasureClient);
  await governor.isQuorumReached(proposalId);
  await governor.isVoteSucceeded(proposalId);
  await governor.proposalVotes(proposalId);
  await governor.delay(proposalId);
  await governor.executeProposal(title, clientsInfo.treasureKey);
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
