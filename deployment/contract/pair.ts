
import { Deployment } from "../deployContractOnTestnet";
import {
  ContractFunctionParameters
} from "@hashgraph/sdk";

async function main() {
    const deployment = new Deployment();
    const filePath = "./artifacts/contracts/Pair.sol/Pair.json";
    console.log(`Deploying swap contract...`);
    const deployedContract = await deployment.deployContractAsClient(filePath, new ContractFunctionParameters());
    console.log(`Swap deployed address ${JSON.stringify(deployedContract)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });