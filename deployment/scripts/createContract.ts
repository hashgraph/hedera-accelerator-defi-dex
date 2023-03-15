import { Helper } from "../../utils/Helper";
import { main as deployContract } from "./logic";
import { main as upgradeProxy } from "./upgradeProxy";
import { main as initContracts } from "./initializeContracts";
import { main as createProxy } from "./transparentUpgradeableProxy";

async function main() {
  const input = Helper.readWorkflowInputs();

  // below calls are validating input data only
  const contractName = input.contractName;
  const contractType = input.contractType;

  if (contractName) {
    await deployContract(contractName);
    if (contractType === "Proxy") {
      await createProxy(contractName);
      await initContracts();
    } else if (contractType === "Upgrade") {
      await upgradeProxy(contractName);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
