import dex from "../../deployment/model/dex";

import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { InstanceProvider } from "../../utils/InstanceProvider";

const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const TOKEN_QTY = 1e8;

const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);

async function main() {
  const provider = InstanceProvider.getInstance();
  const godHolder = await provider.getGODTokenHolderFromFactory(GOD_TOKEN_ID);
  const governor = provider.getGovernor(ContractService.GOVERNOR_TT);
  await governor.initialize(godHolder);

  await godHolder.setupAllowanceForTokenLocking();
  await godHolder.lock();

  await governor.setupAllowanceForProposalCreation(
    clientsInfo.operatorClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey
  );

  const title = Helper.createProposalTitle("Token Transfer Proposal");
  const proposalId = await governor.createTokenTransferProposal(
    title,
    clientsInfo.treasureId.toSolidityAddress(),
    clientsInfo.operatorId.toSolidityAddress(),
    TOKEN_ID.toSolidityAddress(),
    TOKEN_QTY,
    clientsInfo.operatorClient
  );
  await governor.getProposalDetails(proposalId);
  await governor.forVote(proposalId, 0, clientsInfo.uiUserClient);
  await governor.isQuorumReached(proposalId);
  await governor.isVoteSucceeded(proposalId);
  await governor.proposalVotes(proposalId);
  if (await governor.isSucceeded(proposalId)) {
    await governor.setAllowanceForTransferTokenProposal(
      TOKEN_ID,
      TOKEN_QTY,
      governor.contractId,
      clientsInfo.treasureId,
      clientsInfo.treasureKey
    );
    await governor.executeProposal(title, clientsInfo.treasureKey);
  } else {
    await governor.cancelProposal(title, clientsInfo.operatorClient);
  }
  await godHolder.checkAndClaimGodTokens(
    clientsInfo.uiUserClient,
    clientsInfo.uiUserId
  );
  await governor.upgradeHederaService();
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
