const { hethers } = require("@hashgraph/hethers");
const { deployContract } = require("./deployContractOnTestnet");

async function main() {
    const filePath = "./artifacts/contracts/Ballot.sol/Ballot.json";
    const tea = hethers.utils.formatBytes32String("tea");
    const coffee = hethers.utils.formatBytes32String("coffee");
    const proposals = [tea, coffee];
    await deployContract(filePath, proposals);
    console.log("ballotContract deployed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });