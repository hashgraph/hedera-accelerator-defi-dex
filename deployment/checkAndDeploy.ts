import { ContractId } from "@hashgraph/sdk";
import { DeployedContract } from "./model/contract";
import { main as deployContract } from "./scripts/logic";
import { main as updateContractProxy } from "./scripts/upgradeProxy";
import { main as createContractProxy } from "./scripts/transparentUpgradeableProxy";
import { ContractService } from "./service/ContractService";
import { Helper } from "../utils/Helper";
import ContractMetadata from "../utils/ContractMetadata";
import GovernorMethods from "../integrationTest/governance/GovernorMethods";
import Web3 from "web3";

const web3 = new Web3();
const contractMetadata = new ContractMetadata();
const contractDevService = new ContractService(
  ContractService.DEV_CONTRACTS_PATH
);
const contractUatService = new ContractService(
  ContractService.UAT_CONTRACTS_PATH
);
const upgradeGovernor = contractDevService.getContract(
  contractDevService.governorUpgradeContract
);
const governorMethods = new GovernorMethods();
const gitLastCommitMessage = Helper.getGitLastCommitMessage();
const proxySupportedList = ContractMetadata.SUPPORTED_CONTRACTS_FOR_UPGRADE.map(
  (item) => item.toLowerCase()
);

async function main() {
  const contractsToDeploy = contractMetadata.getAllChangedContractNames();
  console.log(`Eligible contracts for deployment: [${contractsToDeploy}]\n`);
  for (const contractName of contractsToDeploy) {
    const deployedProxyContract =
      contractDevService.getContractWithProxy(contractName);
    if (!deployedProxyContract.transparentProxyId) {
      await deployContract(contractName);
      await createContractProxy(contractName);
      const deployedNewProxyContract =
        contractDevService.getContractWithProxy(contractName);
      contractUatService.addDeployed(deployedNewProxyContract);
    } else if (proxySupportedList.includes(contractName)) {
      const newVersion = await deployContract(contractName);
      contractDevService.remove(newVersion.id); // remove entry from dev json
      await createProposal(deployedProxyContract, newVersion.id);
    }
  }
}

async function createProposal(
  oldVersion: DeployedContract,
  newVersionContractId: string
) {
  const uniqueId = web3.utils.randomHex(20);
  const result = await governorMethods.createContractUpgradeProposal(
    ContractId.fromString(upgradeGovernor.transparentProxyId!),
    ContractId.fromString(oldVersion.transparentProxyId!),
    ContractId.fromString(newVersionContractId!),
    `${gitLastCommitMessage} (${uniqueId})`,
    `Contract Name - ${
      oldVersion.name
    }, New Logic Id =  ${newVersionContractId}, Old Logic Id = ${oldVersion.id!}, Proxy Id = ${oldVersion.transparentProxyId!}`,
    "https://defi-ui.hedera.com"
  );
  console.log(
    "Proposal creation status :",
    result.success,
    result.proposalId.toFixed()
  );
  return result.success;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
