import { ContractId } from "@hashgraph/sdk";
import { DeployedContract } from "./model/contract";
import { main as deployContract } from "./scripts/logic";
import { ContractService } from "./service/ContractService";
import { Helper } from "../utils/Helper";
import ContractMetadata from "../utils/ContractMetadata";
import Governor from "../e2e-test/business/Governor";
import { clientsInfo } from "../utils/ClientManagement";
import Web3 from "web3";

const web3 = new Web3();

const contractMetadata = new ContractMetadata();
const contractDevService = new ContractService();
const contractUATService = new ContractService(
  ContractService.UAT_CONTRACTS_PATH
);
const gitLastCommitMessage = Helper.getGitLastCommitMessage();
const upgradeGovernor = contractDevService.getContract(
  contractDevService.governorUpgradeContract
);

const governor = new Governor(upgradeGovernor.transparentProxyId!);

async function main() {
  const contractsToDeploy = await contractMetadata.getAllChangedContractNames();
  console.log(`Eligible contracts for upgrade: [${contractsToDeploy}]\n`);
  for (const contractName of contractsToDeploy) {
    const oldVersion = contractUATService.getContractWithProxy(contractName);
    const newVersion = await deployContract(contractName);
    contractDevService.remove(newVersion.id); // remove entry from dev json
    await createProposal(oldVersion, newVersion.id);
  }
}

async function createProposal(
  oldVersion: DeployedContract,
  newVersionContractId: string
) {
  const uniqueId = web3.utils.randomHex(20);
  const desc = `Contract Name - ${
    oldVersion.name
  }, New Logic Id =  ${newVersionContractId}, Old Logic Id = ${oldVersion.id!}, Proxy Id = ${oldVersion.transparentProxyId!}`;

  await governor.setupAllowanceForProposalCreation(
    clientsInfo.operatorClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey
  );

  const result = await governor.createContractUpgradeProposal(
    ContractId.fromString(oldVersion.transparentProxyId!),
    ContractId.fromString(newVersionContractId!),
    `${gitLastCommitMessage} (${uniqueId})`,
    clientsInfo.operatorClient,
    desc
  );
  console.log("Proposal creation status :", result.success, result.proposalId);
  return result.success;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
