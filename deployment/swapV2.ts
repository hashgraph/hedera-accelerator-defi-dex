
import { Deployment } from "./deployContractOnTestnet";

const contractId = "0.0.47814722";

async function main() {
    const htsServiceAddress = "0x0000000000000000000000000000000002dc43c0"; //contract id 0.0.47818234
     const lpTokenContractAddress = "0x0000000000000000000000000000000002dc43f0" // tokenID: 0.0.47985079
     
    const deployment = new Deployment();
    const filePath = "./artifacts/contracts/SwapV2.sol/SwapV2.json";
    const deployedContract = await deployment.deployContract(filePath, [htsServiceAddress, lpTokenContractAddress]);
    console.log("SwapV2 deployed.");
    // Latest deployed contract : 0x0000000000000000000000000000000002dc4447
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });