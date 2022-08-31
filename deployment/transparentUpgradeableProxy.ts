import { Deployment } from "./deployContractOnTestnet";
import ClientManagement from "../integrationTest/utils/utils";

const clientManagement =  new ClientManagement();
const {adminId} = clientManagement.getAdmin();

const swapContractAddress = "0x0000000000000000000000000000000002de04e7";

async function main() {
    const deployment = new Deployment();
    const filePath = "./artifacts/@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json";
    const deployedContract = await deployment.deployContract(filePath, [swapContractAddress, adminId.toSolidityAddress(), []]);
    console.log(`TransparentUpgradeableProxy deployed - ${deployedContract}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });