const { hethers } = require("@hashgraph/hethers");
const { deployContract } = require("./deployContractOnTestnet");
const { TokenId, AccountId, ContractExecuteTransaction, ContractFunctionParameters } = require("@hashgraph/sdk");

async function main() {
    const filePath = "./artifacts/contracts/Swap.sol/Swap.json";
    const deployedContract = await deployContract(filePath, []);
    console.log("swapContract deployed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });