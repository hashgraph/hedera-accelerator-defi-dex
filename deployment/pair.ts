
import { Deployment } from "./deployContractOnTestnet";

const contractId = "0.0.48101509";

async function main() {
  //28 sep
  await deployPair("0x0000000000000000000000000000000002e377a0")
  await deployPair("0x0000000000000000000000000000000002e377a2")
  await deployPair("0x0000000000000000000000000000000002e377a4")
}

async function deployPair(lpTokenContractAddress: string) {
    const htsServiceAddress =  "0x0000000000000000000000000000000002e15051";// 23 Sep
    const deployment = new Deployment();
    const filePath = "./artifacts/contracts/Pair.sol/Pair.json";
    const deployedContract = await deployment.deployContract(filePath, []);
    console.log("Pair deployed.");
  
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });