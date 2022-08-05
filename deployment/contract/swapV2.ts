
import { Deployment } from "../deployContractOnTestnet";

const contractId = "0.0.47814722";

const contractId = "0.0.48101509";

async function main() {
<<<<<<< HEAD:deployment/swapV2.ts
    const htsServiceAddress = "0x0000000000000000000000000000000002dfec41"; // 13 sep 2:41
    const lpTokenContractAddress = "0x0000000000000000000000000000000002df5019"; // 6 sep 03:05 // Token 0.0.48143347
     
    const deployment = new Deployment();
    const filePath = "./artifacts/contracts/Swap.sol/Swap.json";
    const deployedContract = await deployment.deployContract(filePath, [htsServiceAddress, lpTokenContractAddress]);
    console.log("Swap deployed.");
=======
    const htsServiceAddress = "0x0000000000000000000000000000000002d9a5fa"; //contract id 0.0.47818234
    const deployment = new Deployment();
    const filePath = "./artifacts/contracts/SwapV2.sol/SwapV2.json";
    const deployedContract = await deployment.deployContract(filePath, [htsServiceAddress]);
    console.log("SwapV2 deployed.");
>>>>>>> 051fb57 (Proxy contract deployment using GitHUB action):deployment/contract/swapV2.ts
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });