import { Helper } from "../../utils/Helper";
import { main as deployContract } from "./logic";
import { main as createProxy } from "./transparentUpgradeableProxy";
import hre from "hardhat";

console.log("inside file");
export async function main(contracts: string[]) {
  await hre.run("compile");
  try {
    console.log(process.env.CONTRACTS);
  } catch (error) {
    console.log(error);
  }
  if (contracts.length === 0) {
    contracts = String(process.env.CONTRACTS).split(",");
  }
  console.log("- Contracts for deployment are:", contracts);

  const startTime = Helper.currentTimeInMills();
  // await Promise.all(
  //   contracts.map(async (contractName: string) => {
  //     await deployContract(contractName);
  //     await createProxy(contractName);
  //   })
  // );
  console.log(
    `- Deployment took: ${Helper.currentTimeInMills() - startTime} ms`
  );
}

if (require.main === module) {
  main([])
    .then((env) => {
      console.log(env);
      process.exit(0);
    })
    .catch(Helper.processError);
}
