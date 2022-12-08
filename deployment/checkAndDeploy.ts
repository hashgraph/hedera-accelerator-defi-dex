import ContractMetadata from "../utils/ContractMetadata";
import { main as deployContract } from "./scripts/logic";
import { main as updateContractProxy } from "./scripts/upgradeProxy";
import { ContractService } from "./service/ContractService";
import { main as createContractProxy } from "./scripts/transparentUpgradeableProxy";

async function main() {
  const contractMetadata = new ContractMetadata();
  const contractUatService = new ContractService(
    ContractService.UAT_CONTRACTS_PATH
  );
  const contractDevService = new ContractService(
    ContractService.DEV_CONTRACTS_PATH
  );
  const contractsToDeploy = contractMetadata.getAllChangedContractNames();
  for (const contractName of contractsToDeploy) {
    await deployContract(contractName);
    const deployedProxyContract =
      contractDevService.getContractWithProxy(contractName);
    !deployedProxyContract && (await createContractProxy(contractName));
    await updateContractProxy(contractName);
    const deployedNewProxyContract =
      contractDevService.getContractWithProxy(contractName);
    contractUatService.addDeployed(deployedNewProxyContract);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
