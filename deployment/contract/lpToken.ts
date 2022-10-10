
import {
  ContractFunctionParameters
} from "@hashgraph/sdk";
import { Deployment } from "../deployContractOnTestnet";

async function main() { 
    const deployment = new Deployment();
    const filePath = "./artifacts/contracts/LPToken.sol/LPToken.json";
    const deployedContract = await deployment.deployContractAsClient(filePath, new ContractFunctionParameters());
    console.log(`LPToken deployed ${JSON.stringify(deployedContract)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });