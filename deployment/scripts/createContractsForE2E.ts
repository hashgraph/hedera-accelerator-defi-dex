import ContractMetadata from "../../utils/ContractMetadata";

import { Helper } from "../../utils/Helper";
import { main as deployContract } from "./logic";
import { main as createProxy } from "./transparentUpgradeableProxy";

async function main() {
  const contracts = ContractMetadata.E2E_SUPPORTED_CONTRACTS_FOR_DEPLOYMENT;
  console.log("- Contracts for deployment are:", contracts);

  const startTime = Helper.currentTimeInMills();
  await Promise.all(
    contracts.map(async (contractName: string) => {
      await deployContract(contractName);
      await createProxy(contractName);
    })
  );
  console.log(
    `- Deployment took: ${Helper.currentTimeInMills() - startTime} ms`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
