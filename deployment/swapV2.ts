
import { Deployment } from "./deployContractOnTestnet";

const contractId = "0.0.47814722";

async function main() {
    const htsServiceAddress = "0x0000000000000000000000000000000002dfec41"; // 13 sep 2:41
    const lpTokenContractAddress = "0x0000000000000000000000000000000002df5019"; // 6 sep 03:05 // Token 0.0.48143347
     
    const deployment = new Deployment();
    const filePath = "./artifacts/contracts/Swap.sol/Swap.json";
    const deployedContract = await deployment.deployContract(filePath, [htsServiceAddress, lpTokenContractAddress]);
    console.log("Swap deployed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });