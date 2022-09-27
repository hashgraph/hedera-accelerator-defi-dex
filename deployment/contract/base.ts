
import { Deployment } from "../deployContractOnTestnet";

  async function main() {
      const deployment = new Deployment();
      const filePath = "./artifacts/contracts/common/BaseHTS.sol/BaseHTS.json";
      console.log(`Deploying BaseHTS contract...`);
      const deployedContract = await deployment.deployContract(filePath, []);
      console.log(`BaseHTS deployed ${deployedContract}`);
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });