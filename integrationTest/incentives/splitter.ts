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
const tokenA = TokenId.fromString("0.0.48289687");

const contractId = contractService.getContractWithProxy(
  contractService.splitterContractName
).transparentProxyId!;

const baseService = contractService.getContractWithProxy(
  contractService.baseContractName
).address!;

const vaultContractAddresses = contractService
  .getContractsWithProxy(contractService.vaultContractName, 3)
  .map((obj) => {
    return obj.transparentProxyAddress!;
  });

const vaultContractIds = contractService
  .getContractsWithProxy(contractService.vaultContractName, 3)
  .map((obj) => {
    return obj.transparentProxyId!;
  });

const vaultInitialize = async (
  contractId: string | ContractId,
  stakeAmount: number
) => {
  console.log(`vaultInitialize ${contractId}`);
  const createPairTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9000000)
    .setFunction(
      "initialize",
      new ContractFunctionParameters().addUint256(stakeAmount)
    )
    .setMaxTransactionFee(new Hbar(100))
    .freezeWith(client);

  const createPairTxRes = await createPairTx.execute(client);
  const receipt = await createPairTxRes.getReceipt(client);
  const record = await createPairTxRes.getRecord(client);
  const contractAddress = record.contractFunctionResult!.getAddress(0);
  console.log(`vaultInitialize: ${contractAddress}`);
  console.log(`vaultInitialize: ${receipt.status}`);
  return contractAddress;
};

const initialize = async (contractId: string | ContractId) => {
  console.log(`Splitter Initialize`);
  console.log(`vault addresses ${vaultContractAddresses}`);
  const createPairTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9000000)
    .setFunction(
      "initialize",
      new ContractFunctionParameters()
        .addAddress(baseService)
        .addAddressArray(vaultContractAddresses)
        .addUint256Array([1, 14, 30])
    )
    .setMaxTransactionFee(new Hbar(100))
    .freezeWith(client);

  const createPairTxRes = await createPairTx.execute(client);
  const receipt = await createPairTxRes.getReceipt(client);
  const record = await createPairTxRes.getRecord(client);
  const contractAddress = record.contractFunctionResult!.getAddress(0);
  console.log(`Splitter Initialize: ${contractAddress}`);
  console.log(`Splitter Initialize: ${receipt.status}`);
  return contractAddress;
};

const splitTokens = async (contractId: string | ContractId) => {
  console.log(`splitTokens`);
  const createPairTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9000000)
    .setFunction(
      "splitTokensToVaults",
      new ContractFunctionParameters()
        .addAddress(tokenA.toSolidityAddress())
        .addAddress(treasureId.toSolidityAddress())
        .addUint256(new BigNumber(10000000000))
    )
    .setMaxTransactionFee(new Hbar(100))
    .freezeWith(client)
    .sign(treasureKey);

  const createPairTxRes = await createPairTx.execute(client);
  const receipt = await createPairTxRes.getReceipt(client);
  const record = await createPairTxRes.getRecord(client);
  console.log(`splitTokens: ${receipt.status}`);
  //return contractAddress;
};

const getSplitPercentage = async (
  contractId: string | ContractId,
  vault: string
) => {
  console.log(`getSplitPercentage`);
  const createPairTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9000000)
    .setFunction(
      "_calculateTokenRewardPercentage",
      new ContractFunctionParameters().addAddress(vault)
    )
    .setMaxTransactionFee(new Hbar(100))
    .freezeWith(client)
    .sign(treasureKey);

  const createPairTxRes = await createPairTx.execute(client);
  const receipt = await createPairTxRes.getReceipt(client);
  const record = await createPairTxRes.getRecord(client);
  console.log(
    `getSplitPercentage: ${
      receipt.status
    } value: ${record.contractFunctionResult!.getUint256(0)}`
  );
  //console.log(`getSplitPercentage: ${receipt.status} value: ${record.contractFunctionResult!.getUint256(1)}`);
  //return contractAddress;
};

async function main() {
  // const stakeAmounts = [100000000000, 5000000000, 10000000000];
  // for (let index = 0; index < vaultContractIds.length; index++) {
  //   const element = vaultContractIds[index];
  //   await vaultInitialize(element, stakeAmounts[index]);
  // }
  await initialize(contractId);
  await splitTokens(contractId);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
