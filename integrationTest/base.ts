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
const {treasureId, treasureKey} = clientManagement.getTreasure();
const {tokenUserId, tokenUserKey} = clientManagement.getTokenUser();

const htsServiceAddress = contractService.getContract(contractService.baseContractName).address;

//Token created 0.0.48291338, Token Address 0000000000000000000000000000000002e0de0a

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

  // create LP for TokenC and TokenD

  console.log(`\nSTEP 4 - Create token CD`);
    const tokenCreateCDTx = await new TokenCreateTransaction()
        .setTokenName("hhLP-L49C-L49D")
        .setTokenSymbol("LabC-LabD")
        .setDecimals(0)
        .setInitialSupply(0)
        .setTokenType(TokenType.FungibleCommon)
        .setSupplyType(TokenSupplyType.Infinite)
      //create the token with the contract as supply and treasury
        .setSupplyKey(contractId)
        .setTreasuryAccountId(contractId?.toString() ?? "")
        .execute(client);

  const tokenCreateCDRx = await tokenCreateCDTx.getReceipt(client);
  const tokenCDId = tokenCreateCDRx.tokenId;
  console.log(`- Token created hhLP-L49C-L49D ${tokenCDId}, Token Address ${tokenCDId?.toSolidityAddress()}`);

  // create LP for TokenC and TokenD

  console.log(`\nSTEP 5 - Create token EF`);
    const tokenCreateEFTx = await new TokenCreateTransaction()
        .setTokenName("hhLP-L49E-L49F")
        .setTokenSymbol("LabE-LabF")
        .setDecimals(0)
        .setInitialSupply(0)
        .setTokenType(TokenType.FungibleCommon)
        .setSupplyType(TokenSupplyType.Infinite)
      //create the token with the contract as supply and treasury
        .setSupplyKey(contractId)
        .setTreasuryAccountId(contractId?.toString() ?? "")
        .execute(client);

  const tokenCreateEFRx = await tokenCreateEFTx.getReceipt(client);
  const tokenEFId = tokenCreateEFRx.tokenId;
  console.log(`- Token created hhLP-L49E-L49F ${tokenEFId}, Token Address ${tokenEFId?.toSolidityAddress()}`);

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
