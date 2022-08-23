
import { deployContract } from "./deployRemoteRelay";

async function main() {
  const contractName = "BaseHTS";
  const deployedContract = await deployContract(contractName, undefined);
  console.log("baseContract deployed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });