import { Deployment } from "../../utils/deployContractOnTestnet";
import { ContractService } from "../service/ContractService";

import dotenv from "dotenv";
dotenv.config();

const contractService = new ContractService();

export async function main(_contractName: string) {
  if (_contractName === undefined || _contractName === "") {
    _contractName = process.env.CONTRACT_NAME!;
  }
  console.log(
    `Deployment#deployProxyForGivenLogic(): ${_contractName.toLowerCase()} proxy deploying...`
  );
  const logic = contractService.getContract(_contractName.toLowerCase());
  const proxy = await new Deployment().deployProxyForGivenLogic(logic);
  contractService.updateContractRecord(proxy, logic);
  console.table(proxy);
  console.log("\n");
}
if (require.main === module) {
  main("")
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
