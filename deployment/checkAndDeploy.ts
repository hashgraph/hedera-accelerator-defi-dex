import ContractMetadata from "../utils/ContractMetadata";

import { Helper } from "../utils/Helper";
import { Deployment } from "../utils/deployContractOnTestnet";
import { ContractService } from "./service/ContractService";
import { main as initializeContracts } from "./scripts/initializeContracts";

const deployment = new Deployment();
const contractMetadata = new ContractMetadata();

async function main() {
  const service = getContractService();
  const response = await contractMetadata.getAllChangedContractNames(service);
  if (response.all.length === 0) {
    console.log(`No contract for auto upgrade available`);
    return;
  }
  console.log(`Eligible contracts for auto upgrade:`, response.all);

  await Promise.all(
    response.nonProxies.map(async (name: string) => {
      const item = await deployment.deploy(name);
      service.addDeployed(item);
    })
  );

  await Promise.all(
    response.proxies.map(async (name: string) => {
      const item = await deployment.deployProxy(name);
      service.addDeployed(item);
    })
  );

  service.makeLatestDeploymentAsDefault(false);
  response.proxies.length > 0 && (await initializeContracts(service));
}

function getContractService() {
  const path =
    process.env.CONTRACT_SERVICE_PATH ?? ContractService.UAT_CONTRACTS_PATH;
  return new ContractService(path);
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
