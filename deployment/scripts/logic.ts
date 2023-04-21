import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import ContractMetadata from "../../utils/ContractMetadata";

import { ContractFunctionParameters } from "@hashgraph/sdk";
import dotenv from "dotenv";
dotenv.config();

const deployment = new Deployment();
const contractMetadata = new ContractMetadata();

export async function main(_contractName: string) {
  if (_contractName === undefined || _contractName === "") {
    _contractName = process.env.CONTRACT_NAME!;
  }
  const contractName = _contractName.toLowerCase();
  console.log(`contract name value ${contractName}`);
  const filePath = await contractMetadata.getFilePath(contractName);
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
  return deployedContract;
}

if (require.main === module) {
  main("")
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
