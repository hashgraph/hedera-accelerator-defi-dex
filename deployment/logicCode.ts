import { Helper } from "./Helper";
import { Deployment } from "./deployContractOnTestnet";
import { ContractFunctionParameters } from "@hashgraph/sdk";
import dotenv from "dotenv";
dotenv.config();

const deployment = new Deployment();

export async function main(_contractName: string | null = null) {
  const contractName = (
    _contractName ?? process.env.CONTRACT_NAME!
  ).toLowerCase();
  const compiledPaths = Helper.getContractPathList("./artifacts").compiledPaths;
  const filePath = compiledPaths.find(
    (path) => Helper.getFileNameFromPath(path).toLowerCase() === contractName
  );
  if (filePath === undefined) {
    return `Failed to locate (${contractName}) contract json`;
  }
  console.log(
    `Deploying (${contractName}) contract, where file path is (${filePath})`
  );
  const deployedContract = await deployment.deployContractAsClient(
    filePath,
    new ContractFunctionParameters()
  );
  console.log(
    `${contractName} deployed successfully => ${JSON.stringify(
      deployedContract
    )}`
  );
  return `successfully deployed`;
    }