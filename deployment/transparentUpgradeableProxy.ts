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

const getAllContracts = (contractName: string):  Array<DeployedContract>  => {
  const contracts: Array<DeployedContract> = readFileContent(contractRecordFile);
  return contracts;
}

const updateContractRecord = (contracts: Array<DeployedContract>, contractBeingDeployed: DeployedContract, transparentProxyAddress: string) => {
  const allOtherContracts = contracts.filter((contract: DeployedContract) => contract.address != contractBeingDeployed.address);
  const updatedContract = {
    ...contractBeingDeployed,
    transparentProxyAddress: transparentProxyAddress
  }
  const updatedContracts = [
    ...allOtherContracts,
    updatedContract
  ]

  fs.writeFileSync(contractRecordFile, updatedContracts);

  const data = JSON.stringify(updatedContracts, null, 4);

  console.log(`Contract record updated ${data}`);
}

async function main() {
    const contractName = process.env.CONTRACT_NAME!.toLowerCase();
    const contracts: Array<DeployedContract> = getAllContracts(contractName);
    const matchingContracts = contracts.filter((contract: DeployedContract) => contract.name == contractName);
    const contractBeingDeployed = matchingContracts[matchingContracts.length - 1];
    const contractAddress = contractBeingDeployed.address;
    const adminId = AccountId.fromString(process.env.ADMIN_ID!);
    const deployment = new Deployment();
    const filePath = "./artifacts/@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json";
    const deployedContractAddress = await deployment.deployContract(filePath, [contractAddress, adminId.toSolidityAddress(), []]);
    console.log(`TransparentUpgradeableProxy deployed - ${deployedContractAddress}`);  
    updateContractRecord(contracts, contractBeingDeployed, deployedContractAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });