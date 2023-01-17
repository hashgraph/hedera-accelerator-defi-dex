import { main as eventReader } from "./eventReader";
import { ContractService } from "../service/ContractService";
import { DeployedContract } from "../model/contract";
import { ContractId } from "@hashgraph/sdk";
import GovernorMethods from "../../integrationTest/governance/GovernorMethods";
import ContractMetadata from "../../utils/ContractMetadata";

import dotenv from "dotenv";
dotenv.config();

const governor = new GovernorMethods();
const contractService = new ContractService();
const contractUATService = new ContractService(
  ContractService.UAT_CONTRACTS_PATH
);
const contractMetadata = new ContractMetadata();
let contractId: string | undefined;
let contract: DeployedContract;

const canSkipProxyUpdate = (proxy: DeployedContract, endBlock: string) => {
  return proxy && +(proxy.endBlock ?? 0) > +endBlock;
};

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
        (await onPostExecute(proposal));
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

async function onPostExecute(proposal: any) {
  switch (contract.name) {
    case contractService.governorUpgradeContract: {
      await checkAndUpdateIfRequired(proposal);
      break;
    }
  }
}

async function checkAndUpdateIfRequired(proposal: any) {
  const { proposalId, endBlock } = proposal;
  const { proxyAddress, logicAddress } = await governor.getContractAddresses(
    contractId!,
    proposalId
  );
  const proxyId = ContractId.fromSolidityAddress(proxyAddress);
  const logicId = ContractId.fromSolidityAddress(logicAddress);
  const proxyIdString = proxyId.toString();
  const proxyUAT = contractUATService.getContractWithProxyById(proxyIdString);
  if (canSkipProxyUpdate(proxyUAT, endBlock)) {
    console.log(`- upgradedTo txn status: SKIPPED`);
    console.log(`- previous endblock = ${proxyUAT.endBlock}`);
    console.log(`- current  endblock = ${endBlock}`);
    return;
  }
  const proxyDev = contractService.getContractWithProxyById(proxyIdString);
  switch (proxyDev.name) {
    case contractService.factoryContractName:
    case contractService.governorContractName:
    case contractService.governorTextContractName:
    case contractService.governorTTContractName:
    case contractService.governorUpgradeContract: {
      await updateDirectProxies(proxyId, logicId, proxyDev, endBlock);
      break;
    }
  }
}

async function updateDirectProxies(
  proxyId: ContractId,
  logicId: ContractId,
  previousFromDev: DeployedContract,
  endBlock: string
) {
  const proxyAddress = proxyId.toSolidityAddress();
  const logicAddress = logicId.toSolidityAddress();
  await governor.upgradeTo(proxyAddress, logicAddress);
  await saveNewContract(previousFromDev, logicId, endBlock);
}

async function saveNewContract(
  proxyContract: DeployedContract,
  logicId: ContractId,
  endBlock: string
) {
  const newContract: DeployedContract = {
    ...proxyContract,
    id: logicId.toString(),
    address: logicId.toSolidityAddress(),
    hash: contractMetadata.calculateHash(proxyContract.name),
    timestamp: new Date().toISOString(),
    endBlock,
  };
  contractService.remove(logicId.toString());
  contractService.addDeployed(newContract);
  contractUATService.updateDeployed(newContract);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
