import dotenv from "dotenv";
import * as fs from "fs";
import {
  AccountId,
  ContractFunctionParameters
} from "@hashgraph/sdk";
import { Deployment } from "./deployContractOnTestnet";
import { DeployedContract } from "./model/contract";
import { ContractService } from "./service/ContractService";
dotenv.config();

const contractService = new ContractService();

async function main() {
    const contractName = process.env.CONTRACT_NAME!.toLowerCase();
    console.log(`contractName: ${contractName}`);
    const contractBeingDeployed: DeployedContract = contractService.getContract(contractName);
    console.log(`contractName: ${contractBeingDeployed.id}`);
    const contractAddress = contractBeingDeployed.address;
    const adminId = AccountId.fromString(process.env.TREASURE_ID!);
    const deployment = new Deployment();
    const filePath = "./artifacts/@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json";
    const args = new ContractFunctionParameters();
    args.addAddress(contractAddress);
    args.addAddress(adminId.toSolidityAddress());
    args.addBytes(new Uint8Array());
    const { id, address }  = await deployment.deployContractAsClient(filePath, args);
    console.log(`TransparentUpgradeableProxy deployed - ${id}`); 
    const updatedContract = {
      ...contractBeingDeployed,
      transparentProxyAddress: address,
      transparentProxyId: id,
      timestamp: new Date().toISOString()
    }
    contractService.updateContractRecord(updatedContract, contractBeingDeployed);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });