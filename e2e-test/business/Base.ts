import {
  Client,
  PrivateKey,
  Transaction,
  ContractExecuteTransaction,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import { BigNumber } from "bignumber.js";

export default abstract class Base {
  protected execute = async (
    contractId: string,
    functionName: string,
    client: Client,
    functionParams: ContractFunctionParameters | undefined = undefined,
    keys: PrivateKey | PrivateKey[] | undefined = undefined,
    amount: BigNumber | number = 0
  ) => {
    const txn = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(9999999)
      .setFunction(functionName, functionParams)
      .setPayableAmount(amount);
    const txnToExecute = await this.signTxnIfNeeded(txn, keys, client);
    const txnResponse = await txnToExecute.execute(client);
    const txnReceipt = await txnResponse.getReceipt(client);
    const txnRecord = await txnResponse.getRecord(client);
    return {
      receipt: txnReceipt,
      record: txnRecord,
      result: txnRecord.contractFunctionResult!,
    };
  };

  private signTxnIfNeeded = async (
    txn: Transaction,
    keys: PrivateKey | PrivateKey[] | undefined = undefined,
    client: Client
  ) => {
    if (!keys) return txn;

    if (!Array.isArray(keys)) keys = [keys];

    txn.freezeWith(client);
    for (const key of keys) {
      txn = await txn.sign(key);
    }
    return txn;
  };
}
