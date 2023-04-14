import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";

import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";

const csDev = new ContractService();

const tokenCreateContractId = csDev.getContractWithProxy(
  csDev.governorContractName
).transparentProxyId!;

const godHolderContractId = csDev.getContractWithProxy(csDev.godHolderContract)
  .transparentProxyId!;

const governor = new Governor(tokenCreateContractId);
const godHolder = new GodHolder(godHolderContractId);

async function main() {
  await governor.initialize(godHolder);
  await godHolder.lock();

  const title = Helper.createProposalTitle("Create Token Proposal");
  const proposalId = await governor.createTokenProposal(
    title,
    "TEST-A",
    "TEST-A1",
    clientsInfo.treasureId,
    clientsInfo.treasureKey.publicKey,
    clientsInfo.treasureId,
    clientsInfo.treasureKey.publicKey
  );

  await governor.getProposalDetails(proposalId);
  await governor.forVote(proposalId, clientsInfo.uiUserClient);
  await governor.isQuorumReached(proposalId);
  await governor.isVoteSucceeded(proposalId);
  await governor.proposalVotes(proposalId);
  if (await governor.isSucceeded(proposalId)) {
    await governor.executeProposal(title, clientsInfo.treasureKey);
    await governor.getTokenAddressFromGovernorTokenCreate(proposalId);
  } else {
    await governor.cancelProposal(title, clientsInfo.operatorClient);
  }
  await godHolder.checkAndClaimedGodTokens(
    clientsInfo.uiUserClient,
    clientsInfo.uiUserId
  );
  console.log(`\nDone`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
