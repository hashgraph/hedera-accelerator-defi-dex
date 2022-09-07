import dotenv from "dotenv";
import * as fs from "fs";
import {
  AccountId,
} from "@hashgraph/sdk";
import { Deployment, contractRecordFile } from "./deployContractOnTestnet";
import { DeployedContract } from "./model/contract";
dotenv.config();

const readFileContent = (filePath: string) => {
  const rawdata: any = fs.readFileSync(filePath);
  return JSON.parse(rawdata);
};

async function main() {
    const contractName = process.env.CONTRACT_NAME?.toLowerCase();
    const contracts: Array<DeployedContract> = readFileContent(contractRecordFile)
    const matchingContracts = contracts.filter((contract: DeployedContract) => contract.name == contractName);
    const contractBeingDeployed = matchingContracts[matchingContracts.length - 1];
    const contractAddress = contractBeingDeployed.address;
    const adminId = AccountId.fromString(process.env.ADMIN_ID!);
    const deployment = new Deployment();
    const filePath = "./artifacts/@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json";
    const deployedContract = await deployment.deployContract(filePath, [contractAddress, adminId.toSolidityAddress(), []]);
    console.log(`TransparentUpgradeableProxy deployed - ${deployedContract}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });