import { BigNumber } from "bignumber.js";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
} from "@hashgraph/sdk";

import { ContractService } from "../deployment/service/ContractService";
import ClientManagement from "../utils/ClientManagement";

const clientManagement = new ClientManagement();
const contractService = new ContractService();
let client = clientManagement.createOperatorClient();
client = client.setDefaultMaxTransactionFee(new Hbar(100));

const contract = contractService.getContract(
  contractService.changeImplementation
);

const swap = async (contId: string) => {
  const args = new ContractFunctionParameters()
    .addAddress("0x0000000000000000000000000000000002f1ad5d")
    .addAddress("0x0000000000000000000000000000000002f1ad9b");

  const tx = new ContractExecuteTransaction()
    .setContractId(contId)
    .setGas(1000000)
    .setFunction("swap", args)
    .freezeWith(client);

  const executedTx = await tx.execute(client);
  await executedTx.getReceipt(client);

  console.log(`swap done`);
};

async function main() {
  console.log(contract.id);
  await swap(contract.id!);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
