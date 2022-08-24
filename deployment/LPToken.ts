
import { Deployment } from "./deployContractOnTestnet";

const contractId = "0.0.47814722";

async function main() {
    const htsServiceAddress = "0x0000000000000000000000000000000002dc43c0"; //contract id 0.0.47818234
     const lpTokenAddress = "0000000000000000000000000000000002dc31b7" // tokenID: 0.0.47985079
     const deployment0 = new Deployment();
    const filePath0 = "./artifacts/contracts/LPToken.sol/LPToken.json";
    const deployedContract0 = await deployment0.deployContract(filePath0, [htsServiceAddress, lpTokenAddress]);
    console.log("LPToken deployed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });