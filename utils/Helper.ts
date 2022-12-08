import { getAllFilesSync } from "get-all-files";
import platformPath from "path";
import { ContractFunctionResult } from "@hashgraph/sdk";

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
}
