import dotenv from "dotenv";
import { ContractFunctionParameters } from "@hashgraph/sdk";
import { Deployment } from "./deployContractOnTestnet";

dotenv.config();

async function main() {
  const deployment = new Deployment();
  const filePath =
    "./artifacts/contracts/common/governorUpgrade.sol/governorUpgrade.json";
  console.log(`Deploying governor Upgrade contract...`);
  const deployedContract = await deployment.deployContractAsClient(
    filePath,
    new ContractFunctionParameters()
  );
  console.log(
    `governorUpgrade deployed ${JSON.stringify(deployedContract)}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
