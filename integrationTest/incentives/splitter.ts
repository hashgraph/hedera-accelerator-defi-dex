import { BigNumber } from "bignumber.js";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
  ContractId,
  TokenId,
} from "@hashgraph/sdk";

import { ContractService } from "../../deployment/service/ContractService";
import ClientManagement from "../../utils/ClientManagement";

const clientManagement = new ClientManagement();
const contractService = new ContractService();

let client = clientManagement.createOperatorClient();
let treasureClient = clientManagement.createClient();

const { treasureId, treasureKey } = clientManagement.getTreasure();
const tokenA = TokenId.fromString("0.0.48289687");
const tokenB = TokenId.fromString("0.0.48289686");
const tokenC = TokenId.fromString("0.0.48301281");
const tokenD = TokenId.fromString("0.0.48301282");
const tokenE = TokenId.fromString("0.0.48301300");
const tokenF = TokenId.fromString("0.0.48301322");

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

const withPrecision = (value: number): BigNumber => {
  return new BigNumber(value).multipliedBy(100000000);
};

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
  const vaultInitializeTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9000000)
    .setFunction(
      "initialize",
      new ContractFunctionParameters()
        .addAddress(tokenF.toSolidityAddress())
        .addUint256(10) // block time
        .addAddress(baseService)
    )
    .setMaxTransactionFee(new Hbar(100))
    .freezeWith(client);

  const vaultInitializeTxRes = await vaultInitializeTx.execute(client);
  const receipt = await vaultInitializeTxRes.getReceipt(client);
  console.log(`vaultInitialize: ${receipt.status}`);
};

const vaultAddStakingToken = async (
  contractId: string | ContractId,
  stakeAmount: number
) => {
  console.log(`vaultAddStakingToken ${contractId}`);
  const vaultAddStakingTokenTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9000000)
    .setFunction(
      "addStake",
      new ContractFunctionParameters().addUint256(withPrecision(stakeAmount))
    )
    .setMaxTransactionFee(new Hbar(100))
    .freezeWith(treasureClient)
    .sign(treasureKey);

  const vaultAddStakingTokenTxRes = await vaultAddStakingTokenTx.execute(
    treasureClient
  );
  const receipt = await vaultAddStakingTokenTxRes.getReceipt(treasureClient);
  console.log(`vaultAddStakingToken: ${receipt.status}`);
};

const initialize = async (contractId: string | ContractId) => {
  console.log(`Splitter Initialize`);
  console.log(`vault addresses ${vaultContractAddresses}`);
  const splitterInitializeTx = await new ContractExecuteTransaction()
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

  const splitterInitializeTxRes = await splitterInitializeTx.execute(client);
  const receipt = await splitterInitializeTxRes.getReceipt(client);
  console.log(`Splitter Initialize: ${receipt.status}`);
};

const splitTokens = async (contractId: string | ContractId) => {
  console.log(`splitTokens`);
  const splitTokensTx = await new ContractExecuteTransaction()
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

  const splitTokensTxRes = await splitTokensTx.execute(client);
  const receipt = await splitTokensTxRes.getReceipt(client);
  console.log(`splitTokens: ${receipt.status}`);
};

async function main() {
  /// Code to be uncommented if new fresh vault deployed

  const stakeAmounts = [1000, 50, 100];
  for (let index = 0; index < vaultContractIds.length; index++) {
    const element = vaultContractIds[index];
    await vaultInitialize(element, stakeAmounts[index]);
    await vaultAddStakingToken(element, stakeAmounts[index]);
  }
  await initialize(contractId);
  await splitTokens(contractId);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
