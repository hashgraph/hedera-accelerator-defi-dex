
import { Deployment } from "./deployContractOnTestnet";

const contractId = "0.0.47814722";

async function main() {
    const htsServiceAddress = "0x0000000000000000000000000000000002d9a5fa"; //contract id 0.0.47818234
    const deployment = new Deployment();
    const filePath = "./artifacts/contracts/SwapV2.sol/SwapV2.json";
    const deployedContract = await deployment.deployContract(filePath, [htsServiceAddress]);
    console.log("SwapV2 deployed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });