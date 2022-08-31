
import { Deployment } from "./deployContractOnTestnet";

const contractId = "0.0.48101509";

async function main() {
    const htsServiceAddress = "0x0000000000000000000000000000000002ddf7a2"; //contract id 0.0.47818234
    const lpTokenContractAddress = "0x0000000000000000000000000000000002de1c6a";
     
    const deployment = new Deployment();
    const filePath = "./artifacts/contracts/SwapV2.sol/SwapV2.json";
    const deployedContract = await deployment.deployContract(filePath, [htsServiceAddress, lpTokenContractAddress]);
    console.log("SwapV2 deployed.");
    // Latest deployed contract : 0x0000000000000000000000000000000002dca5b3
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });