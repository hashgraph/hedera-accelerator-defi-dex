
import { Deployment } from "../deployContractOnTestnet";

async function main() {
    const deployment = new Deployment();
    const filePath = "./artifacts/contracts/Swap.sol/Swap.json";
    console.log(`Deploying swap contract...`);
    const deployedContract = await deployment.deployContract(filePath, []);
<<<<<<< HEAD:deployment/upgradeableSwap.ts
    console.log(`SwapV2 deployed address ${deployedContract}`);
=======
    console.log(`Swap deployed address ${deployedContract}`);
>>>>>>> 051fb57 (Proxy contract deployment using GitHUB action):deployment/contract/swap.ts
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });