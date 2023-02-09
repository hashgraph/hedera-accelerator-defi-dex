import dex from "../../deployment/model/dex";
import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";

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

const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1).toString();
const TOKEN_QTY = 1 * 1e8;

async function main() {
  const title = "Token Transfer Proposal - 1";
  await governor.initialize(godHolder);
  const proposalId = await governor.createTokenTransferProposal(
    title,
    clientsInfo.treasureId.toSolidityAddress(),
    clientsInfo.operatorId.toSolidityAddress(),
    TOKEN_ID,
    TOKEN_QTY
  );
  await governor.getProposalDetails(proposalId);
  await governor.forVote(proposalId);
  await governor.isQuorumReached(proposalId);
  await governor.isVoteSucceeded(proposalId);
  await governor.proposalVotes(proposalId);
  await governor.delay(proposalId);
  await governor.executeProposal(title, clientsInfo.treasureKey);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
