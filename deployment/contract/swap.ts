
import { Deployment } from "../deployContractOnTestnet";

async function main() {
    const deployment = new Deployment();
    const filePath = "./artifacts/contracts/Swap.sol/Swap.json";
    console.log(`Deploying swap contract...`);
    const deployedContract = await deployment.deployContract(filePath, []);
    console.log(`Swap deployed address ${deployedContract}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });