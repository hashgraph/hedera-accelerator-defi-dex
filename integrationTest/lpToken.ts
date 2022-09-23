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

const htsServiceAddress = contractService.getContract(contractService.baseContractName).address;
const {treasureId, treasureKey} = clientManagement.getTreasure();
const {tokenUserId, tokenUserKey} = clientManagement.getTokenUser();

const baseContract = contractService.getContract(contractService.baseContractName);
const contractId = contractService.getContract(contractService.lpTokenContractName).id;

const createToken =  async (): Promise<TokenId> => {
  const createTokenTx = await new TokenCreateTransaction()
    .setTokenName("hhLP-L49A-L49B")
    .setTokenSymbol("LabA-LabB")
    .setDecimals(8)
    .setInitialSupply(0)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    //create the token with the contract as supply and treasury
    .setSupplyKey(ContractId.fromString(baseContract.id))
    .setTreasuryAccountId(baseContract.id)
    .execute(client);

    const tokenCreateTx = await createTokenTx.getReceipt(client);
    const tokenId = tokenCreateTx.tokenId;
    console.log(`- Token created ${tokenId}, Token Address ${tokenId?.toSolidityAddress()}`);
    return tokenId!;
}

const initialize = async (tokenId: TokenId) => {
    let contractFunctionParameters = new ContractFunctionParameters()
      .addAddress(tokenId.toSolidityAddress())
      .addAddress(htsServiceAddress);

    const contractTokenTx = await new ContractExecuteTransaction()
      .setContractId(contractId ?? "")
      .setFunction("initializeParams", contractFunctionParameters)
      .setGas(500000)
      .execute(client);
      
    await contractTokenTx.getReceipt(client);
}

const allotLPTokenFor = async () => {
    const tokenAQty = new BigNumber(10);
    const tokenBQty = new BigNumber(10);
  
    const contractFunctionParameters = new ContractFunctionParameters()
        .addInt256(tokenAQty)
        .addInt256(tokenBQty)
        .addAddress(treasureId.toSolidityAddress());

    const contractAllotTx = await new ContractExecuteTransaction()
        .setContractId(contractId)
        .setFunction("allotLPTokenFor", contractFunctionParameters)
        .setGas(900000)
        .execute(client);

    const contractAllotRx = await contractAllotTx.getReceipt(client);
    const response = await contractAllotTx.getRecord(client);
    const status = contractAllotRx.status;
    console.log(`\n allotLPTokenFor Result ${status} code: ${response.contractFunctionResult!.getInt64()}`);
}

const removeLPTokenFor = async () => {
  const lpTokenQty = new BigNumber(5);

  const contractFunctionParameters = new ContractFunctionParameters()
      .addInt256(lpTokenQty)
      .addAddress(treasureId.toSolidityAddress());

  console.log(`\n STEP 2 Remove LP Token`);
  const contractRemoveTx0 = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("removeLPTokenFor", contractFunctionParameters)
      .setGas(2000000)
      .freezeWith(client)
      .sign(treasureKey);

  const contractRemoveTx = await contractRemoveTx0.execute(client);
  const contractRemoveRx = await contractRemoveTx.getReceipt(client);
  const response = await contractRemoveTx.getRecord(client);
  const status = contractRemoveRx.status;
  console.log(`\n Remove LP Token ${status} code: ${response.contractFunctionResult!.getInt64()}`);
}

const getBalance = async() => {
  const balance = await new AccountBalanceQuery()
  .setAccountId(treasureId)
  .execute(client);

  console.log(balance.tokens);
}

async function main() {
  const tokenId = await createToken();
  await initialize(tokenId);
  await allotLPTokenFor();
  await removeLPTokenFor();
  await getBalance();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
