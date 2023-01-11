import { BigNumber } from "bignumber.js";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
} from "@hashgraph/sdk";

import { ContractService } from "../deployment/service/ContractService";
import ClientManagement from "../utils/ClientManagement";
import dex from "../deployment/model/dex";

const clientManagement = new ClientManagement();
const contractService = new ContractService();
let client = clientManagement.dexOwnerClient();

const htsServiceAddress = contractService.getContract(
  contractService.baseContractName
).address;
const { treasureId, treasureKey } = clientManagement.getTreasure();

const contract = contractService.getContractWithProxy(
  contractService.dummyContract
);

const precision = 10000000;

const initialize = async (contId: string) => {
  console.log(`Initialize contract with token  `);

  let contractFunctionParameters = new ContractFunctionParameters()
    .addAddress(htsServiceAddress)
    .addAddress(dex.GOD_TOKEN_ADDRESS);

  const contractTokenTx = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setFunction("initialize", contractFunctionParameters)
    .setGas(500000)
    .execute(client);

  await contractTokenTx.getReceipt(client);

  console.log(`Initialize contract with token done.`);
};

const transferToContract = async (
  contId: string,
  to: string,
  amt: BigNumber
) => {
  console.log(`transferToContract `);

  const contractFunctionParameters = new ContractFunctionParameters()
    .addAddress(to)
    .addInt256(amt);

  const contractAllotTx = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setFunction("transferToContract", contractFunctionParameters)
    .setGas(900000)
    .freezeWith(client);

  const signedTran = await contractAllotTx.sign(treasureKey);

  const executedTx = await signedTran.execute(client);

  const contractAllotRx = await executedTx.getReceipt(client);

  const status = contractAllotRx.status;
  console.log(`transferToContract result ${status} `);
};

const transferFromContract = async (contId: string, amt: BigNumber) => {
  console.log(`transferFromContract `);

  const contractFunctionParameters = new ContractFunctionParameters().addInt256(
    amt
  );

  const contractAllotTx = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setFunction("transferFromContract", contractFunctionParameters)
    .setGas(900000)
    .freezeWith(client);

  const executedTx = await contractAllotTx.execute(client);

  const contractAllotRx = await executedTx.getReceipt(client);

  const status = contractAllotRx.status;
  console.log(`transferFromContract result ${status} `);
};

const transferFromContractViaDep = async (contId: string, amt: BigNumber) => {
  console.log(`transferFromContractViaDep `);

  const contractFunctionParameters = new ContractFunctionParameters().addInt256(
    amt
  );

  const contractAllotTx = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setFunction("transferFromContractViaDep", contractFunctionParameters)
    .setGas(900000)
    .freezeWith(client);

  const executedTx = await contractAllotTx.execute(client);

  const contractAllotRx = await executedTx.getReceipt(client);

  const status = contractAllotRx.status;
  console.log(`transferFromContractViaDep result ${status} `);
};

const transferFromContractViaDepUsingErc20 = async (
  contId: string,
  amt: BigNumber
) => {
  console.log(`transferFromContractViaDepUsingErc20 `);

  const contractFunctionParameters = new ContractFunctionParameters().addInt256(
    amt
  );

  const contractAllotTx = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setFunction(
      "transferFromContractViaDepUsingErc20",
      contractFunctionParameters
    )
    .setGas(900000)
    .freezeWith(client);

  const executedTx = await contractAllotTx.execute(client);

  const contractAllotRx = await executedTx.getReceipt(client);

  const status = contractAllotRx.status;
  console.log(`transferFromContractViaDepUsingErc20 result ${status} `);
};

const transferFromContractViaErc20 = async (contId: string, amt: BigNumber) => {
  console.log(`transferFromContractViaErc20 `);

  const contractFunctionParameters = new ContractFunctionParameters().addInt256(
    amt
  );

  const contractAllotTx = await new ContractExecuteTransaction()
    .setContractId(contId)
    .setFunction("transferFromContractViaErc20", contractFunctionParameters)
    .setGas(900000)
    .freezeWith(client);

  const executedTx = await contractAllotTx.execute(client);

  const contractAllotRx = await executedTx.getReceipt(client);

  const status = contractAllotRx.status;
  console.log(`transferFromContractViaErc20 result ${status} `);
};

async function main() {
  console.log(`Testing contract .............\n`);
  await initialize(contract.transparentProxyId!);
  await transferToContract(
    contract.transparentProxyId!,
    treasureId.toSolidityAddress(),
    new BigNumber(4)
  );
  await transferFromContract(contract.transparentProxyId!, new BigNumber(1));
  try {
    await transferFromContractViaDep(
      contract.transparentProxyId!,
      new BigNumber(1)
    );
  } catch (e) {
    console.log(e);
  }
  try {
    await transferFromContractViaDepUsingErc20(
      contract.transparentProxyId!,
      new BigNumber(1)
    );
  } catch (e) {
    console.log(e);
  }
  await transferFromContractViaErc20(
    contract.transparentProxyId!,
    new BigNumber(1)
  );
  console.log(`Testing contract done`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
