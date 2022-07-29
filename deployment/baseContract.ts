
import { Deployment } from "./deployContractOnTestnet";

async function main() {
    const deployment = new Deployment();
    const filePath = "./artifacts/contracts/BaseHTS.sol/BaseHTS.json";
    const deployedContract = await deployment.deployContract(filePath, []);
    console.log("baseContract deployed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });