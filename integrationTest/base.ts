import { BigNumber } from "bignumber.js";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  AccountBalanceQuery,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenId,
  AccountId,
  PrivateKey
} from "@hashgraph/sdk";

import ClientManagement from "./utils/utils";
import { ContractService } from "../deployment/service/ContractService";

const clientManagement = new ClientManagement();
const contractService = new ContractService();
const client = clientManagement.createClient();

const contractId = contractService.getContract(contractService.baseContractName).id;
const {treasureId, treasureKey} = clientManagement.getTreasure();
const {tokenUserId, tokenUserKey} = clientManagement.getTokenUser();

const htsServiceAddress = contractService.getContract(contractService.baseContractName).address;

//Token created 0.0.48291338, Token Address 0000000000000000000000000000000002e0de0a

const associateToken = async () => {
    const tokenAdd = "0x0000000000000000000000000000000002e0de0a";
  
    const contractFunctionParameters = new ContractFunctionParameters()
        .addAddress(htsServiceAddress)
        .addAddress(tokenAdd);

    const contractAllotTx = await new ContractExecuteTransaction()
        .setContractId(contractId)
        .setFunction("associateTokenPublic", contractFunctionParameters)
        .setGas(900000)
        .execute(client);

    const contractAllotRx = await contractAllotTx.getReceipt(client);
    const response = await contractAllotTx.getRecord(client);
    const status = contractAllotRx.status;
    console.log(`\n allotLPTokenFor Result ${status} code: ${response.contractFunctionResult!.getInt64()}`);
}

async function main() {
  await associateToken();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
