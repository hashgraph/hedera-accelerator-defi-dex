import dex from "../../deployment/model/dex";

import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import TextGovernor from "../../e2e-test/business/TextGovernor";
import FTTokenHolderFactory from "../../e2e-test/business/factories/FTTokenHolderFactory";
import GodHolder from "../../e2e-test/business/GodHolder";

const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);

async function main() {
  const governor = new TextGovernor();
  const godHolderFactory = new FTTokenHolderFactory(); //GOD token factory
  await godHolderFactory.initialize();
  const godHolderContractId = await godHolderFactory.getTokenHolder(
    GOD_TOKEN_ID.toSolidityAddress()
  );
  const godHolder = new GodHolder(godHolderContractId);

  await governor.initialize(godHolder);

  await godHolder.setupAllowanceForTokenLocking();
  await godHolder.lock();

  await governor.setupAllowanceForProposalCreation(
    clientsInfo.operatorClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey
  );

  const title = Helper.createProposalTitle("Text Proposal");
  const proposalId = await governor.createTextProposal(
    title,
    clientsInfo.operatorId,
    clientsInfo.operatorClient
  );
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
  await governor.upgradeHederaService();
  console.log(`\nDone`);
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
