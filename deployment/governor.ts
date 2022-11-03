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
  const deployment = new Deployment();
  const filePath = "./artifacts/contracts/common/GovernorTokenCreate.sol/GovernorTokenCreate.json";
  console.log(`Deploying GovernorTokenCreate contract...`);
  const deployedContract = await deployment.deployContractAsClient(filePath, new ContractFunctionParameters());
  console.log(`GovernorTokenCreate deployed ${JSON.stringify(deployedContract)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });