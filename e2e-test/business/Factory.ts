import { BigNumber } from "bignumber.js";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  TokenId,
  AccountBalanceQuery,
  Hbar,
  PrivateKey,
  Client,
  AccountId,
} from "@hashgraph/sdk";

export default class Factory {
  public withPrecision = (value: number, precision: number): BigNumber => {
    return new BigNumber(value).multipliedBy(precision);
  };

  public setupFactory = async (
    baseContractAddress: string,
    contractId: string,
    client: Client
  ) => {
    console.log(`\nSetupFactory`);
    let contractFunctionParameters =
      new ContractFunctionParameters().addAddress(baseContractAddress);
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

  public createPair = async (
    contractId: string,
    token0: TokenId,
    token1: TokenId,
    treasureId: AccountId,
    treasureKey: PrivateKey,
    client: Client
  ) => {
    const createPairTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(9000000)
      .setFunction(
        "createPair",
        new ContractFunctionParameters()
          .addAddress(token0.toSolidityAddress())
          .addAddress(token1.toSolidityAddress())
          .addAddress(treasureId.toSolidityAddress())
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

  public getPair = async (
    contractId: string,
    token0: TokenId,
    token1: TokenId,
    client: Client
  ): Promise<string> => {
    console.log(`get Pair`);
    const getPairTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(9999999)
      .setFunction(
        "getPair",
        new ContractFunctionParameters()
          .addAddress(token0.toSolidityAddress())
          .addAddress(token1.toSolidityAddress())
      )
      .freezeWith(client);
    const executedTx = await getPairTx.execute(client);
    const response = await executedTx.getRecord(client);
    console.log(`getPair: ${response.contractFunctionResult!.getAddress(0)}`);
    const receiptRx = await executedTx.getReceipt(client);
    console.log(`getPair: ${receiptRx.status}`);
    return `0x${response.contractFunctionResult!.getAddress(0)}`;
  };
}
