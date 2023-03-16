import { Helper } from "../../utils/Helper";
import { main as deployContract } from "./logic";
import { main as createProxy } from "./transparentUpgradeableProxy";

async function main() {
  const inputs = Helper.readWorkflowInputs();
  const contracts = String(inputs.contracts).split(",");
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
