const { hethers } = require("@hashgraph/hethers");
const { deployContract } = require("./deployContractOnTestnet");

async function main() {
    const filePath = "./artifacts/contracts/Greeter.sol/Greeter.json";
    await deployContract(filePath, ["Hello!!"]);
    console.log("greeter deployed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });