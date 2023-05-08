import * as fs from "fs";
import Web3 from "web3";
import prompts from "prompts";
import ContractMetadata from "./ContractMetadata";

import { execSync } from "child_process";
import { BigNumber } from "bignumber.js";
import {
  Client,
  PrivateKey,
  Transaction,
  TransactionId,
  ContractFunctionResult,
} from "@hashgraph/sdk";
import { MirrorNodeService } from "../utils/MirrorNodeService";
import { ContractService } from "../deployment/service/ContractService";

const web3 = new Web3();
const csDev = new ContractService();

export class Helper {
  static async processError(apiError: any) {
    console.log(apiError);
    console.log("- Parsing error message ...");
    try {
      const txnIdFromError = Helper.parseTxnIdFromError(apiError);
      const mns = MirrorNodeService.getInstance().enableLogs();
      const info = await mns.getErrorInfo(txnIdFromError);
      console.log("- Parsing done -> ", {
        TxnId: txnIdFromError.toString(),
        Link: `https://hashscan.io/testnet/transaction/${info.timestamp}`,
        Message: info.message,
      });
    } catch (error) {
      console.log("- Parsing failed.");
    } finally {
      process.exit(1);
    }
  }

  private static parseTxnIdFromError(error: any) {
    if (error.message.includes("contained error status")) {
      const txnIdInString = error.message
        .split(" ")
        .filter((item: string) => item.startsWith("0.0"))
        .pop();
      return TransactionId.fromString(txnIdInString);
    }
    throw error;
  }

  static async readContractIdFromPrompt() {
    const name: string = await Helper.prompt(
      ContractMetadata.SUPPORTED_CONTRACTS_FOR_DEPLOYMENT,
      "Please select which contract events you want to read?"
    );
    if (name === "exit") {
      throw Error("nothing to execute");
    }
    const nameInLowerCase = name.toLowerCase();
    const proxyContract = csDev.getContractWithProxy(nameInLowerCase);
    if (proxyContract && proxyContract.transparentProxyId) {
      return proxyContract.transparentProxyId;
    }
    const contract = csDev.getContract(nameInLowerCase);
    if (contract && contract.id) {
      return contract.id;
    }
    throw Error(`No details exist in json for '${name}'`);
  }

  /// This function is used to iterate over result of ContractFunctionResult which returning array
  /// it return address as string stored after default values.
  static getAddressArray = (contractFunctionResult: ContractFunctionResult) => {
    const tokenCount = contractFunctionResult.getUint256(1);
    const result: string[] = [];
    for (let i = 0; i < Number(tokenCount); i++) {
      result.push(contractFunctionResult.getAddress(i + 2));
    }
    return result;
  };

  static getUint256Array = (contractFunctionResult: ContractFunctionResult) => {
    const tokenCount = contractFunctionResult.getUint256(1);
    const result: BigNumber[] = [];
    for (let i = 0; i < Number(tokenCount); i++) {
      result.push(contractFunctionResult.getUint256(i + 2));
    }
    return result;
  };

  static getBytes = (result: ContractFunctionResult, index: number) => {
    const offSet = result.getUint256(index).div(32); // bytes offset
    const bytesLength = result.getUint256(offSet.toNumber() + 1); // bytes length at index (offset + 1)
    const begin = offSet.plus(2).multipliedBy(32).toNumber(); // bytes data at index (offset + 2)
    const end = bytesLength.plus(begin).toNumber();
    return result.asBytes().subarray(begin, end);
  };

  static convertToFeeObjectArray = (items: BigNumber[]) => {
    if (items.length % 2 !== 0) {
      throw Error(`Helper: Invalid items size = ${items.length}`);
    }
    const details: any = [];
    for (let i = 0; i < items.length; i += 2) {
      const key = Number(items[i]);
      const value = Number(items[i + 1]);
      details.push({ key, value });
    }
    return details;
  };

  static async prompt(inputs: string[], userMessage: string) {
    const items = [...inputs, "exit"];
    return items[
      (
        await prompts({
          type: "select",
          name: "option",
          message: userMessage,
          choices: items.map((item: string) => {
            return { title: item };
          }),
        })
      ).option
    ];
  }

  static async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static getGitLastCommitMessage() {
    return execSync("git log -1 HEAD --pretty=format:%s").toString().trim();
  }

  static createProposalTitle(titlePrefix: string) {
    return `${titlePrefix} ${web3.utils.randomHex(20)}`;
  }

  static readWorkflowInputs() {
    try {
      const rawData: any = fs.readFileSync(
        "./deployment/scripts/workflow-inputs.json"
      );
      const inputs = JSON.parse(rawData);
      console.log("- Inputs from workflow:");
      console.table(inputs);
      return inputs;
    } catch (error: any) {
      throw Error(`- Failed to read workflow inputs, ${error.message}`);
    }
  }

  static currentTimeInMills() {
    return Date.now();
  }

  static signTxnIfNeeded = async (
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
