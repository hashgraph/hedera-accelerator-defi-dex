import dex from "../../deployment/model/dex";
import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";

import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";

const csDev = new ContractService();

const godHolderProxyId = csDev.getContractWithProxy(csDev.godHolderContract)
  .transparentProxyId!;

const governorTransferTokenId = csDev.getContractWithProxy(
  csDev.governorTTContractName
).transparentProxyId!;

const governor = new Governor(governorTransferTokenId);
const godHolder = new GodHolder(godHolderProxyId);

const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1).toSolidityAddress();
const TOKEN_QTY = 1e8;

async function main() {
  const title = Helper.createProposalTitle("Token Transfer Proposal");
  await governor.initialize(godHolder);
  await godHolder.lock();
  const proposalId = await governor.createTokenTransferProposal(
    title,
    clientsInfo.treasureId.toSolidityAddress(),
    clientsInfo.operatorId.toSolidityAddress(),
    TOKEN_ID,
    TOKEN_QTY
  );
  await governor.getProposalDetails(proposalId);
  await governor.forVote(proposalId, 0, clientsInfo.uiUserClient);
  await governor.isQuorumReached(proposalId);
  await governor.isVoteSucceeded(proposalId);
  await governor.proposalVotes(proposalId);
  if (await governor.isSucceeded(proposalId)) {
    await governor.executeProposal(title, clientsInfo.treasureKey);
  } else {
    await governor.cancelProposal(title, clientsInfo.operatorClient);
  }
  await godHolder.checkAndClaimGodTokens(
    clientsInfo.uiUserClient,
    clientsInfo.uiUserId
  );
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
