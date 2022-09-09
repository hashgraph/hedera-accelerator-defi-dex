import dotenv from "dotenv";
import * as fs from "fs";
import {
  AccountId,
} from "@hashgraph/sdk";
import { Deployment } from "./deployContractOnTestnet";
import { DeployedContract } from "./model/contract";
import { ContractService } from "./service/ContractService";
dotenv.config();

const contractService = new ContractService();

async function main() {
    const contractName = process.env.CONTRACT_NAME!.toLowerCase();
    const contractBeingDeployed = contractService.getContract(contractName);
    const contractAddress = contractBeingDeployed.address;
    const adminId = AccountId.fromString(process.env.ADMIN_ID!);
    const deployment = new Deployment();
    const filePath = "./artifacts/@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json";
    const deployedContractAddress = await deployment.deployContract(filePath, [contractAddress, adminId.toSolidityAddress(), []]);
    console.log(`TransparentUpgradeableProxy deployed - ${deployedContractAddress}`);  
    contractService.updateContractRecord(contractBeingDeployed, deployedContractAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });