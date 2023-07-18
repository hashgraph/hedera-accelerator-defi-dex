import ContractMetadata from "../utils/ContractMetadata";

import { Helper } from "../utils/Helper";
import { Deployment } from "../utils/deployContractOnTestnet";
import { ContractService } from "./service/ContractService";
import { main as initializeContracts } from "./scripts/initializeContracts";

const NON_PROXY_CONTRACTS_WITH_LOWER_CASE_NAME =
  ContractMetadata.NON_PROXY_CONTRACTS.map((item: string) =>
    item.toLowerCase()
  );

const deployment = new Deployment();
const contractMetadata = new ContractMetadata();

async function main() {
  const service = getContractService();
  const allContractsToDeploy =
    await contractMetadata.getAllChangedContractNames(service);
  if (allContractsToDeploy.length === 0) {
    console.log(`No contract for auto upgrade available`);
    return;
  }
  console.log(`Eligible contracts for auto upgrade:`, allContractsToDeploy);

  const proxyContractsToDeploy = allContractsToDeploy.filter(
    (item: string) => !NON_PROXY_CONTRACTS_WITH_LOWER_CASE_NAME.includes(item)
  );

  const nonProxyContractsToDeploy = allContractsToDeploy.filter(
    (item: string) => NON_PROXY_CONTRACTS_WITH_LOWER_CASE_NAME.includes(item)
  );

  await Promise.all(
    nonProxyContractsToDeploy.map(async (name: string) => {
      const item = await deployment.deploy(name);
      service.addDeployed(item);
    })
  );

  await Promise.all(
    proxyContractsToDeploy.map(async (name: string) => {
      const item = await deployment.deployProxy(name);
      service.addDeployed(item);
    })
  );

  allContractsToDeploy.length > 0 &&
    service.makeLatestDeploymentAsDefault(false);
  proxyContractsToDeploy.length > 0 && (await initializeContracts(service));
}

function getContractService() {
  const path =
    process.env.CONTRACT_SERVICE_PATH ?? ContractService.UAT_CONTRACTS_PATH;
  return new ContractService(path);
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
