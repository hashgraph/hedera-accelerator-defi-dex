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
const client = clientManagement.createClientAsAdmin();

const contractIdString = contractService.getContract(contractService.baseContractName).id;

const htsServiceAddress = contractService.getContract(contractService.baseContractName).address;

const associateToken = async () => {
  const contractId = ContractId.fromString(contractIdString);
  if  (contractId != null) {
    console.log(`\nSTEP 3 - Create token AB`);
    const tokenCreateTx = await new TokenCreateTransaction()
        .setTokenName("hhLP-L49A-L49B")
        .setTokenSymbol("LabA-LabB")
        .setDecimals(0)
        .setInitialSupply(0)
        .setTokenType(TokenType.FungibleCommon)
        .setSupplyType(TokenSupplyType.Infinite)
      //create the token with the contract as supply and treasury
        .setSupplyKey(contractId)
        .setTreasuryAccountId(contractId?.toString() ?? "")
        .execute(client);

  const tokenCreateRx = await tokenCreateTx.getReceipt(client);
  const tokenId = tokenCreateRx.tokenId;
  console.log(`- Token created hhLP-L49A-L49B ${tokenId}, Token Address ${tokenId?.toSolidityAddress()}`);

  } 
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
