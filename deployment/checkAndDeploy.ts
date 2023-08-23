import ContractMetadata from "../utils/ContractMetadata";

import { Helper } from "../utils/Helper";
import { Deployment } from "../utils/deployContractOnTestnet";
import { ContractService } from "./service/ContractService";
import { main as initializeContracts } from "./scripts/initializeContracts";

async function main() {
  const service = getContractService();
  const deployment = new Deployment(service);
  const contractMetadata = new ContractMetadata();
  const response = await contractMetadata.getAllChangedContractNames(service);
  if (response.all.length === 0) {
    console.log(`\n- No contract for auto upgrade available \n`);
    return;
  }
  console.log(
    `\n- Eligible contracts for auto upgrade:`,
    `{${response.all.length}}`,
    response.all,
    "\n"
  );

  await Promise.all(
    response.nonProxies.map(async (name: string) => {
      await deployment.deploy(name, true);
    })
  );

  await Promise.all(
    response.proxies.map(async (name: string) => {
      await deployment.deployProxy(name, true);
    })
  );

  service.makeLatestDeploymentAsDefault(false);
  response.proxies.length > 0 && (await initializeContracts(service));
}

function getContractService() {
  return (process.env.CHECK_UAT_CONTRACTS ?? "true") === "true"
    ? ContractService.getUATPathContractService()
    : ContractService.getDevPathContractService();
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
