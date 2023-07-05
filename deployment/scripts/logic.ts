import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";

import dotenv from "dotenv";
dotenv.config();

export async function main(_contractName: string) {
  if (_contractName === undefined || _contractName === "") {
    _contractName = process.env.CONTRACT_NAME!;
  }
  return new Deployment().deployAndSave(_contractName.toLowerCase());
}

if (require.main === module) {
  main("")
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
