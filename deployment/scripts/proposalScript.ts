import { main as eventReader } from "./eventReader";
import GovernorMethods from "../../integrationTest/governance/GovernorMethods";

import dotenv from "dotenv";
dotenv.config();

const governor = new GovernorMethods();
let contractId: string | undefined;

export async function main() {
  contractId = process.env.PROPOSAL_CONTRACT_ID;
  if (contractId === undefined) {
    throw Error("proposal contract id missing");
  }
  const events = await eventReader(contractId);
  const proposalsExecuted = events.get("ProposalExecuted") ?? [];
  const proposalsCanceled = events.get("ProposalCanceled") ?? [];
  let proposalsCreated = events.get("ProposalCreated") ?? [];
  proposalsCreated = removeSubset(proposalsCreated, proposalsExecuted);
  proposalsCreated = removeSubset(proposalsCreated, proposalsCanceled);
  if (proposalsCreated.length <= 0) {
    console.log("- no proposal pending for execution.");
  } else {
    await executeProposals(proposalsCreated);
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

async function executePrposal(proposal: any) {
  const { proposalId, description } = proposal;
  try {
    console.log("\n------- exectuion started:", proposalId);
    const state = await governor.state(proposalId, contractId!);
    Number(state) === 4 &&
      (await governor.execute(description, contractId!)) &&
      (await governor.claimGODToken(proposalId, contractId!));
    console.log("------- exectuion completed:", proposalId);
  } catch (e) {
    console.error("- failed to execute propsal:", proposal.proposalId, e);
  }
}

async function executeProposals(proposals: any[]) {
  console.log("- proposals execution flow started");
  for (let index = 0; index < proposals.length; index++) {
    const proposal = proposals[index];
    await executePrposal(proposal);
  }
  console.log("- proposals execution flow ended");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
