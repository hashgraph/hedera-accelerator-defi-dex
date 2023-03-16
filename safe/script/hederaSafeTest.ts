import { ContractId } from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";
import SafeFactory from "./SafeFactory";
import Safe from "./Safe";
import { clientsInfo } from "../../utils/ClientManagement";
import { BigNumber } from "bignumber.js";
import dex from "../../deployment/model/dex";

import * as fs from "fs";
import { ethers } from "hardhat";

const contractService = new ContractService();

const readFileContent = (fileName: string) => {
  const rawdata: any = fs.readFileSync(fileName);
  return JSON.parse(rawdata);
};

interface MetaTransaction {
  to: string;
  value: number | BigNumber;
  data: string;
  operation: number;
}

interface SafeTransaction extends MetaTransaction {
  safeTxGas: string | number;
  baseGas: string | number;
  gasPrice: string | number;
  gasToken: string;
  refundReceiver: string;
  nonce: string | number;
}

const safeTx = async (
  nonceCount: number,
  data: string,
  callOrDelegate: number
) => {
  const safeTx: SafeTransaction = {
    to: dex.LAB49_1_TOKEN_ADDRESS,
    value: 0,
    data: data,
    operation: callOrDelegate,
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: dex.LAB49_3_TOKEN_ADDRESS,
    refundReceiver: clientsInfo.treasureId.toSolidityAddress(),
    nonce: nonceCount,
  };
  return safeTx;
};

const tokenTotalSupply = async (): Promise<string> => {
  const contractJson = readFileContent(
    "./artifacts/contracts/common/IERC20.sol/IERC20.json"
  );
  const contractInterface = new ethers.utils.Interface(contractJson.abi);
  const callData = contractInterface.encodeFunctionData("totalSupply", []);
  return callData;
};

const transferToken = async (): Promise<string> => {
  const contractJson = readFileContent(
    "./artifacts/contracts/common/IERC20.sol/IERC20.json"
  );
  const contractInterface = new ethers.utils.Interface(contractJson.abi);
  const callData = contractInterface.encodeFunctionData(
    "transfer(address,uint256)",
    [clientsInfo.dexOwnerId.toSolidityAddress(), 1]
  );
  return callData;
};

const executeSafeTransaction = async (
  safeTx1: SafeTransaction,
  safe: any,
  signBytes: string
) => {
  await safe.execTransaction(
    safeTx1.to,
    safeTx1.value,
    ethers.utils.arrayify(safeTx1.data),
    safeTx1.operation,
    new BigNumber(0),
    new BigNumber(0),
    new BigNumber(0),
    safeTx1.gasToken,
    safeTx1.refundReceiver,
    ""
  );
};

const getTransactionHash = async (safeTx1: SafeTransaction, safe: any) => {
  return await safe.getTransactionHash(
    safeTx1.to,
    safeTx1.value,
    ethers.utils.arrayify(safeTx1.data),
    safeTx1.operation,
    new BigNumber(0),
    new BigNumber(0),
    new BigNumber(0),
    safeTx1.gasToken,
    safeTx1.refundReceiver,
    safeTx1.nonce
  );
};

async function main() {
  const safeContract = contractService.getContract(
    contractService.hederaGnosisSafe
  );
  const factoryContract = contractService.getContract(
    contractService.gnosisSafeProxyFactory
  );
  console.log(`safeContract ${safeContract.id}`);
  console.log(`factoryContract ${factoryContract.id}`);

  const safeFactory = new SafeFactory(factoryContract.id);
  const safeProxy = await safeFactory.createProxy(safeContract.address);
  const safeProxyContractId =
    ContractId.fromSolidityAddress(safeProxy).toString();
  console.log(`safeProxyContractId ${safeProxyContractId}`);

  const safe = new Safe(safeProxyContractId);

  const owners = [
    clientsInfo.dexOwnerId.toSolidityAddress(),
    clientsInfo.treasureId.toSolidityAddress(),
  ];
  const ownersThreshold = owners.length;
  const data = new Uint8Array();
  await safe.setup(
    owners,
    ownersThreshold,
    clientsInfo.operatorId.toSolidityAddress(),
    data,
    clientsInfo.adminId.toSolidityAddress(),
    dex.LAB49_3_TOKEN_ADDRESS,
    new BigNumber(0),
    clientsInfo.treasureId.toSolidityAddress()
  );

  await safe.getOwners();

  console.log(`Start: Testing total supply transaction.\n`);
  let nonceCount = await safe.getNonce();
  let totalSupply = await tokenTotalSupply();
  let totalSupplyTx = await safeTx(nonceCount.toNumber(), totalSupply, 0);
  let totalSupplyHash = await getTransactionHash(totalSupplyTx, safe);

  await safe.approveHash(totalSupplyHash, clientsInfo.dexOwnerClient);
  await safe.approveHash(totalSupplyHash, clientsInfo.treasureClient);

  await executeSafeTransaction(totalSupplyTx, safe, "");
  console.log(`End: Testing total supply transaction.\n`);

  console.log(`Start: Testing token transfer transaction.\n`);
  nonceCount = await safe.getNonce();
  let transferTokenData = await transferToken();
  let transferTokenTx = await safeTx(
    nonceCount.toNumber(),
    transferTokenData,
    1
  );
  let transferTokenHash = await getTransactionHash(transferTokenTx, safe);

  await safe.approveHash(transferTokenHash, clientsInfo.dexOwnerClient);
  await safe.approveHash(transferTokenHash, clientsInfo.treasureClient);

  await executeSafeTransaction(transferTokenTx, safe, "");
  console.log(`End: Testing token transfer transaction.\n`);

  return "Done";
}

main()
  .then((res) => console.log(res))
  .catch((err) => console.error(err))
  .finally(() => process.exit(0));
