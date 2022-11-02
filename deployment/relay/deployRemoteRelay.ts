
import * as hre from "hardhat";
import * as hethers from "@hashgraph/hethers";
import { BigNumber } from "@ethersproject/bignumber";


 export const deployContract = async (contractName: string, contractConstructorArgs: any) => {
  const provider = new hre.ethers.providers.JsonRpcProvider("https://testnet.hashio.io/api");
  const wallet = new hre.ethers.Wallet("0xb17080a89335f96f01e350d93c5c5ae59a0f685681bcc8c08bbb32cf02dcc96a", provider);
  wallet.estimateGas = async (tnx: any) => {
    return BigNumber.from("500000");
  }

  const constractFactory = await hre.ethers.getContractFactory(contractName, wallet);

  const contract = await constractFactory.deploy();
  const contractAddress = (await contract.deployTransaction.wait()).contractAddress;
  const contractId = hethers.utils.getAccountFromAddress(contractAddress);

  console.log(`${contractName} contract id: ${hethers.utils.asAccountString(contractId)}`);
  console.log(`${contractName} deployed to: ${contractAddress}`);

  return contractAddress;
};

