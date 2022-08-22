
import * as hre from "hardhat";
import * as hethers from "@hashgraph/hethers";
import { BigNumber } from "@ethersproject/bignumber";


 export const deployContract = async (contractName: string, contractConstructorArgs: any) => {
  const provider = new hre.ethers.providers.JsonRpcProvider("https://testnet.hashio.io/api");
  const wallet = new hre.ethers.Wallet("0x0f75e883f3963735905ba7324a4477cb774b9b7f08196743ad32831cb348fce3", provider);
  wallet.estimateGas = async (tnx: any) => {
    return BigNumber.from("500000");
  }

  const constractFactory = await hre.ethers.getContractFactory(contractName, wallet);

  const contract = await constractFactory.deploy(contractConstructorArgs);
  const contractAddress = (await contract.deployTransaction.wait()).contractAddress;
  const contractId = hethers.utils.getAccountFromAddress(contractAddress);

  console.log(`${contractName} contract id: ${hethers.utils.asAccountString(contractId)}`);
  console.log(`${contractName} deployed to: ${contractAddress}`);

  return contractAddress;
};

