import { hethers } from "@hashgraph/hethers";
import hre from "hardhat";


 export const deployContract = async (contractName: string, contractConstructorArgs: any) => {
  const provider = new hre.ethers.providers.JsonRpcProvider("https://testnet.hashio.io/api");
  const wallet = new hre.ethers.Wallet("0xb17080a89335f96f01e350d93c5c5ae59a0f685681bcc8c08bbb32cf02dcc96a", provider);
  
  const contractFactory = await hre.ethers.getContractFactory(contractName, wallet);
  const contractProxy = await hre.upgrades.deployProxy(contractFactory, contractConstructorArgs);
  const contractAddress = (await contractProxy.deployTransaction.wait()).contractAddress;
  const contractId = hethers.utils.getAccountFromAddress(contractAddress);

  console.log(`${contractName} contract id: ${hethers.utils.asAccountString(contractId)}`);
  console.log(`${contractName} deployed to: ${contractAddress}`);

  return contractAddress;
};

