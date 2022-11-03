import dotenv from "dotenv";
import {
  ContractFunctionParameters
} from "@hashgraph/sdk";
import { Deployment } from "./deployContractOnTestnet";

dotenv.config();

async function main() {
  const deployment = new Deployment();
  const filePath = "./artifacts/contracts/common/GovernorTextProposal.sol/GovernorTextProposal.json";
  console.log(`Deploying Governor Text Proposal contract...`);
  const deployedContract = await deployment.deployContractAsClient(filePath, new ContractFunctionParameters());
  console.log(`BaseHTS deployed ${JSON.stringify(deployedContract)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });