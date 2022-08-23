
import { deployContract } from "./deployUpgrades";

async function main() {
    const deployedContract = await deployContract("BaseHTS", undefined);
    console.log("base upgradable Contract deployed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });