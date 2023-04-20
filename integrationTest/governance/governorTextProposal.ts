import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";

import { Helper } from "../../utils/Helper";
import { ContractService } from "../../deployment/service/ContractService";
import { clientsInfo } from "../../utils/ClientManagement";

const csDev = new ContractService();
const godHolderContract = csDev.getContractWithProxy(csDev.godHolderContract);
const governorTextContract = csDev.getContractWithProxy(
  csDev.governorTextContractName
);

const governor = new Governor(governorTextContract.transparentProxyId!);
const godHolder = new GodHolder(godHolderContract.transparentProxyId!);

async function main() {
  const title = Helper.createProposalTitle("Text Proposal");
  await governor.initialize(godHolder);
  await godHolder.lock();
  const proposalId = await governor.createTextProposal(title);
  await governor.getProposalDetails(proposalId);
  await governor.forVote(proposalId, 0, clientsInfo.uiUserClient);
  await governor.isQuorumReached(proposalId);
  await governor.isVoteSucceeded(proposalId);
  await governor.proposalVotes(proposalId);
  if (await governor.isSucceeded(proposalId)) {
    await governor.executeProposal(title);
  } else {
    await governor.cancelProposal(title, clientsInfo.operatorClient);
  }
  await godHolder.checkAndClaimGodTokens(
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
