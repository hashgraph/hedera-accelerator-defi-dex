import Web3 from "web3";
import { getAllFilesSync } from "get-all-files";
import platformPath from "path";
import { ContractFunctionResult } from "@hashgraph/sdk";
import inquirer from "inquirer";
import { execSync } from "child_process";
import { BigNumber } from "bignumber.js";

const web3 = new Web3();

export class Helper {
  static extractFileName(path: string): string {
    return platformPath.parse(path).name;
  }

  static getContractPathList(path: string) {
    const info: {
      compiledPaths: Array<string>;
    } = {
      compiledPaths: [],
    };

    // reading compiled path to get json files
    try {
      info.compiledPaths = getAllFilesSync(path)
        .toArray()
        .filter((path) => {
          return (
            path.includes(".sol") &&
            !path.includes(".dbg") &&
            path.endsWith(".json")
          );
        });
    } catch (e) {
      info.compiledPaths = [];
    }
    return info;
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

  async prompt(inputs: string[], userMessage: string) {
    return (
      await inquirer.prompt([
        {
          type: "rawlist",
          name: "option",
          message: userMessage,
          choices: [...inputs, "exit"],
        },
      ])
    ).option;
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
}
