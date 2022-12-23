import { main as eventReader } from "./eventReader";
import GovernorMethods from "../../integrationTest/governance/GovernorMethods";

import dotenv from "dotenv";
dotenv.config();

const governor = new GovernorMethods();
let contractId: string | undefined;

export async function main() {
  contractId = process.env.PROPOSAL_CONTRACT_ID;
  if (!contractId) {
    throw Error("Proposal contract id missing.");
  }
  const events = await eventReader(contractId);
  const executedProposals = events.get("ProposalExecuted") ?? [];
  const cancelledProposals = events.get("ProposalCanceled") ?? [];
  const createdProposals = events.get("ProposalCreated") ?? [];
  const activeProposals = removeSubset(createdProposals, [
    ...executedProposals,
    ...cancelledProposals,
  ]);
  if (activeProposals.length <= 0) {
    console.log("- No active proposal.");
  } else {
    await executeProposals(activeProposals);
  }
}

function removeSubset(superset: any[], subset: any[]) {
  return superset.filter((supersetItem) => {
    const item = subset.find(
      (subsetItem) => subsetItem.proposalId === supersetItem.proposalId
    );
    return item === undefined;
  });
}

async function executeProposals(proposals: any[]) {
  console.log(`- Proposals execution started (${proposals.length}).`);
  for (const proposal of proposals) {
    try {
      const { proposalId, description } = proposal;
      console.log("\n--- Proposal execution started:", proposalId);
      const state = await governor.state(proposalId, contractId!);
      Number(state) === 4 &&
        (await governor.execute(description, contractId!)) &&
        (await governor.claimGODToken(proposalId, contractId!));
      console.log("--- Proposal execution succeeded:", proposalId);
    } catch (e) {
      console.error("- Proposal execution failed:", proposal.proposalId, e);
    }
  }
  console.log("- Proposals execution ended.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
