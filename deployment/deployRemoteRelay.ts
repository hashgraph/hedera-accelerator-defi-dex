
import * as hre from "hardhat";
import * as hethers from "@hashgraph/hethers";

 const main = async () => {
  const provider = new hre.ethers.providers.JsonRpcProvider("https://testnet.hashio.io/api");
  const wallet = new hre.ethers.Wallet("0x0f75e883f3963735905ba7324a4477cb774b9b7f08196743ad32831cb348fce3", provider);
  const BaseHTS = await hre.ethers.getContractFactory('BaseHTS', wallet);

  const baseHTS = await BaseHTS.deploy();
  const contractAddress = (await baseHTS.deployTransaction.wait()).contractAddress;
  const contractId = hethers.utils.getAccountFromAddress(contractAddress);

  console.log(`BaseHTS contract id: ${hethers.utils.asAccountString(contractId)}`);
  console.log(`BaseHTS deployed to: ${contractAddress}`);

  return contractAddress;
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});