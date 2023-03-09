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

const getCallData = async (): Promise<Uint8Array> => {
  const contractJson = readFileContent(
    "./artifacts/contracts/common/IERC20.sol/IERC20.json"
  );
  const contractInterface = new ethers.utils.Interface(contractJson.abi);
  const callData = contractInterface.encodeFunctionData("totalSupply", []);
  return callData;
};

async function main() {
  const safeContract = contractService.getContract(contractService.gnosisSafe);
  const factoryContract = contractService.getContract(
    contractService.gnosisSafeProxyFactory
  );
  //const safeFactory = new SafeFactory(factoryContract.id);
  //const safeProxy = await safeFactory.createProxy(safeContract.address);
  //const safeProxyContractId = ContractId.fromSolidityAddress(safeProxy).toString();
  const safeProxyContractId = "0.0.3663437";
  console.log(`safeProxyContractId ${safeProxyContractId}`);
  const safe = new Safe(safeProxyContractId);
  await safe.getChainId();
  const owners = [clientsInfo.operatorId.toSolidityAddress()];
  const data = new Uint8Array();
  // await safe.setup(
  //   owners,
  //   1,
  //   clientsInfo.operatorId.toSolidityAddress(),
  //   data,
  //   clientsInfo.adminId.toSolidityAddress(),
  //   dex.LAB49_3_TOKEN_ADDRESS,
  //   new BigNumber(0),
  //   clientsInfo.treasureId.toSolidityAddress()
  // );

  const calldata = await getCallData();

  const signatures = new Uint8Array();

  await safe.execTransaction(
    "0x000000000000000000000000000000000000230b",
    new BigNumber(0),
    calldata,
    0,
    new BigNumber(0),
    new BigNumber(0),
    new BigNumber(0),
    dex.LAB49_3_TOKEN_ADDRESS,
    clientsInfo.operatorId.toSolidityAddress(),
    signatures
  );

  return "Done";
}

main()
  .then((res) => console.log(res))
  .catch((err) => console.error(err))
  .finally(() => process.exit(0));
