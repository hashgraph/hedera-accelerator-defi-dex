import { BigNumber } from "bignumber.js";
import axios from "axios";
import * as fs from "fs";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  AccountBalanceQuery,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenId,
  Hbar,
  DelegateContractId
} from "@hashgraph/sdk";
import Web3 from "web3";

import ClientManagement from "./utils/utils";
import { ContractService } from "../deployment/service/ContractService";

const clientManagement = new ClientManagement();
const contractService = new ContractService();
let client = clientManagement.createOperatorClient();
const {id, key} = clientManagement.getOperator();
//client.setMaxQueryPayment(new Hbar(5));
client = client.setDefaultMaxTransactionFee(new Hbar(100));

const htsServiceAddress = contractService.getContract(contractService.baseContractName).address;
const {treasureId, treasureKey} = clientManagement.getTreasure();

const baseContract = contractService.getContract(contractService.baseContractName);
const contractId = contractService.getContract("createtoken").id!;

const abi = JSON.parse(fs.readFileSync('./artifacts/contracts/LPToken.sol/LPToken.json', 'utf8')).abi;
const web3 = new Web3;

const createFungibleTokenPublic = async () => {
  console.log(
    `createFungible`
  );
  const liquidityPool = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(5000000)
    .setMaxTransactionFee(new Hbar(50))
    .setPayableAmount(60)
    .setFunction(
      "createFungible",
      new ContractFunctionParameters()
        .addUint32(8000000)
    )
    .freezeWith(client)
    .sign(key);
  const liquidityPoolTx = await liquidityPool.execute(client);
  const response = await liquidityPoolTx.getRecord(client);
  const code = response.contractFunctionResult!.getInt256(0);
  const ad = response.contractFunctionResult!.getAddress(0);
  console.log(`createFungible address: ${ad}`);
  console.log(`createFungible code: ${code}`);
};

async function main() {
  console.log(`Using contract id ${contractId}`);
  await createFungibleTokenPublic();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
