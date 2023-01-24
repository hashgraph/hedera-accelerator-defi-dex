import { BigNumber } from "bignumber.js";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  TokenId,
  Hbar,
  AccountId,
} from "@hashgraph/sdk";

import { ContractService } from "../service/ContractService";
import ClientManagement from "../../utils/ClientManagement";
import dex from "../model/dex";
import GovernorMethods from "../../integrationTest/governance/GovernorMethods";

const clientManagement = new ClientManagement();
const client = clientManagement.createOperatorClient();
const { treasureKey } = clientManagement.getTreasure();
const { id } = clientManagement.getOperator();
const contractService = new ContractService();
const governor = new GovernorMethods();

const tokenA = TokenId.fromString("0.0.48289687");
const tokenC = TokenId.fromString("0.0.48301281");
const tokenD = TokenId.fromString("0.0.48301282");
const tokenGOD = TokenId.fromString(dex.GOD_TOKEN_ID);
const tokenHBARX = TokenId.fromString(dex.HBARX_TOKEN_ID);

const baseContract = contractService.getContract(
  contractService.baseContractName
);
const contractId = contractService.getContractWithProxy(
  contractService.factoryContractName
).transparentProxyId!;

const godHolderContractId = contractService.getContractWithProxy(
  contractService.godHolderContract
).transparentProxyId!;

const setupFactory = async () => {
  console.log(`\nSetupFactory`);
  const adminId = AccountId.fromString(process.env.ADMIN_ID!);
  let contractFunctionParameters = new ContractFunctionParameters()
    .addAddress(baseContract.address)
    .addAddress(adminId.toSolidityAddress());
  const contractTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("setUpFactory", contractFunctionParameters)
    .setGas(9000000)
    .execute(client);
  const receipt = await contractTx.getReceipt(client);
  const response = await contractTx.getRecord(client);
  const status = receipt.status;
  console.log(
    `\nSetupFactory Result ${status} code: ${response.contractFunctionResult!.getAddress()}`
  );
};

const createPair = async (
  contractId: string,
  token0: TokenId,
  token1: TokenId
) => {
  console.log(`createPair TokenA TokenB`);
  const createPairTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(9000000)
    .setFunction(
      "createPair",
      new ContractFunctionParameters()
        .addAddress(token0.toSolidityAddress())
        .addAddress(token1.toSolidityAddress())
        .addAddress(id.toSolidityAddress())
        .addInt256(new BigNumber(10))
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

async function main() {
  console.log(`Factory transparent proxy contractId: ${contractId}`);
  try {
    await setupFactory();
  } catch (error) {
    console.log(`Setup factory failed for contract ${contractId}`);
    console.error(error);
  }

  try {
    await createPair(contractId, tokenC, tokenHBARX);
  } catch (error) {
    console.log(`Create pair failed for ${tokenC} and ${tokenHBARX}`);
    console.error(error);
  }

  try {
    await createPair(contractId, tokenC, tokenD);
  } catch (error) {
    console.log(`Create pair failed for ${tokenC} and ${tokenD}`);
    console.error(error);
  }

  try {
    await createPair(contractId, tokenA, tokenGOD);
  } catch (error) {
    console.log(`Create pair failed for ${tokenA} and ${tokenGOD}`);
    console.error(error);
  }

  try {
    await governor.initializeGodHolder();
  } catch (error) {
    console.log(`Initialise GODHolder failed`);
    console.error(error);
  }

  for (const contractName of contractService.allGovernorContracts) {
    const contract = contractService.getContractWithProxy(contractName);
    console.log(
      `\n${contractName} transparent proxy contractId: ${contract.transparentProxyId!}`
    );
    try {
      await governor.initialize(contract.transparentProxyId!);
    } catch (error) {
      console.log(
        `Initialization failed ${contractName} ${contract.transparentProxyId} `
      );
      console.error(error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
