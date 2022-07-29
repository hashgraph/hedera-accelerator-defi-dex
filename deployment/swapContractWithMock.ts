
import { Deployment } from "./deployContractOnTestnet";

async function main() {
    const htsServiceAddress = "0x0000000000000000000000000000000002d84657"; 
    const deployment = new Deployment();
    const filePath = "./artifacts/contracts/SwapWithMock.sol/SwapWithMock.json";
    const deployedContract = await deployment.deployContract(filePath, [htsServiceAddress]);
    console.log("swapContractWithMock deployed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });