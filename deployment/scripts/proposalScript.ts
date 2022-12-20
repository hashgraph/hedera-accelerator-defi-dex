import { main as eventReader } from "./eventReader";
import GovernorMethods from "../../integrationTest/governance/GovernorMethods";
import { ContractService } from "../service/ContractService";
import { DeployedContract } from "../model/contract";
import ContractMetadata from "../../utils/ContractMetadata";
import { ContractId } from "@hashgraph/sdk";

import dotenv from "dotenv";
dotenv.config();

const governor = new GovernorMethods();
const contractService = new ContractService();
const contractMetadata = new ContractMetadata();
let contractId: string | undefined;
let contract: DeployedContract;

export async function main() {
  contractId = process.env.PROPOSAL_CONTRACT_ID;
  if (!contractId) {
    throw Error("Proposal contract id missing.");
  }
  contract = contractService.getContractWithProxyById(contractId);
  if (!contract) {
    throw Error("Failed to get contract details.");
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
      (await isProposalActive(proposalId)) &&
        (await governor.execute(description, contractId!)) &&
        (await onPostExecute(proposalId));
      console.log("--- Proposal execution succeeded:", proposalId);
    } catch (e) {
      console.error("- Proposal execution failed:", proposal.proposalId, e);
    }
  }
  console.log("- Proposals execution ended.\n");
}

async function isProposalActive(proposalId: any) {
  return Number(await governor.state(proposalId, contractId!)) === 4;
}

async function onPostExecute(proposalId: any) {
  switch (contract.name) {
    case contractService.governorUpgradeContract: {
      const { proxyAddress, logicAddress } =
        await governor.getContractAddresses(contractId!, proposalId);
      await governor.upgradeTo(proxyAddress, logicAddress);
      await saveNewContract(proxyAddress, logicAddress);
      break;
    }
  }
}

async function saveNewContract(proxyAddress: string, logicAddress: string) {
  const proxyId = ContractId.fromSolidityAddress(proxyAddress).toString();
  const proxyContract = contractService.getContractWithProxyById(proxyId);
  if (proxyContract) {
    const logicId = ContractId.fromSolidityAddress(logicAddress).toString();
    const newContract: DeployedContract = {
      ...proxyContract,
      id: logicId,
      address: logicAddress,
      hash: contractMetadata.calculateHash(proxyContract.name),
      timestamp: new Date().toISOString(),
    };
    contractService.addDeployed(newContract);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
