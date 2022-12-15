import { BigNumber } from "bignumber.js";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
  ContractId,
  TokenId,
} from "@hashgraph/sdk";
import { httpRequest } from "../../deployment/api/HttpsService";

import { ContractService } from "../../deployment/service/ContractService";
import ClientManagement from "../../utils/ClientManagement";

const clientManagement = new ClientManagement();
const contractService = new ContractService();

let client = clientManagement.createOperatorClient();
const { id, key } = clientManagement.getOperator();
const { adminId, adminKey } = clientManagement.getAdmin();

const { treasureId, treasureKey } = clientManagement.getTreasure();

const contractId = contractService.getContractWithProxy(
  contractService.splitterContractName
).transparentProxyId!;

const vaultContractIds = contractService
  .getContractsWithProxy(contractService.splitterContractName, 3)
  .map((obj) => {
    return obj.transparentProxyId!;
  });

const initialize = async (
  contractId: string | ContractId,
  token0: string,
  token1: string
) => {
  console.log(`createPair TokenA TokenB`);
  const createPairTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9000000)
    .setFunction(
      "initialize",
      new ContractFunctionParameters().addAddress(token0).addAddress(token1)
    )
    .setMaxTransactionFee(new Hbar(100))
    .setPayableAmount(new Hbar(100))
    .freezeWith(client)
    .sign(treasureKey);

  const createPairTxRes = await createPairTx.execute(client);
  const receipt = await createPairTxRes.getReceipt(client);
  const record = await createPairTxRes.getRecord(client);
  const contractAddress = record.contractFunctionResult!.getAddress(0);
  console.log(`CreatePair address: ${contractAddress}`);
  console.log(`CreatePair status: ${receipt.status}`);
  return contractAddress;
};

async function main() {}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
