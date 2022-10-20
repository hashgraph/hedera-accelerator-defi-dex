import { Deployment } from "../deployContractOnTestnet";
import {
  ContractFunctionParameters
} from "@hashgraph/sdk";

const contractId = "0.0.48313084";

async function main() {
    const deployment = new Deployment();
    const filePath = "./artifacts/contracts/Factory.sol/Factory.json";
    const deployedContract = await deployment.deployContractAsClient(filePath, new ContractFunctionParameters());
    console.log("Factory deployed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });