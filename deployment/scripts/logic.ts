import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { ContractFunctionParameters } from "@hashgraph/sdk";
import dotenv from "dotenv";
dotenv.config();

const deployment = new Deployment();

export async function main(_contractName: string? = null) {
  const contractName = (
    _contractName ?? process.env.CONTRACT_NAME!
  ).toLowerCase();

  const filePath = getFilePath(contractName);
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

const getFilePath = (contractName: string) => {
  const compiledPaths = Helper.getContractPathList("./artifacts").compiledPaths;
  const filePath = compiledPaths.find(
    (path) => Helper.extractFileName(path).toLowerCase() === contractName
  );
  if (filePath === undefined) {
    throw Error(`Failed to locate (${contractName}) contract json`);
  }
  return filePath;
};

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
