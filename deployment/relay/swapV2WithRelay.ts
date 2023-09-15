import { deployContract } from "./deployRemoteRelay";

const contractId = "0.0.47961101";

async function main() {
  const htsServiceAddress = "0x0000000000000000000000000000000002dbd40d"; //contract id 0.0.47961101
  const contractName = "SwapV2";
  const deployedContract = await deployContract(
    contractName,
    htsServiceAddress,
  );
  console.log("SwapV2 deployed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
