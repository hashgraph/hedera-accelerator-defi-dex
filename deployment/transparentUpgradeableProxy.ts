import dotenv from "dotenv";
import { Deployment } from "./deployContractOnTestnet";
dotenv.config();

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS!;
    const adminAddress = process.env.ADMIN_ADDRESS!;
    const deployment = new Deployment();
    const filePath = "./artifacts/@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json";
    const deployedContract = await deployment.deployContract(filePath, [contractAddress, adminAddress, []]);
    console.log(`TransparentUpgradeableProxy deployed - ${deployedContract}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });