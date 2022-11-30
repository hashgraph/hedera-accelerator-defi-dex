import {
    ContractFunctionResult
  } from "@hashgraph/sdk";

export default class ArrayUtils {
    public getAddressArray = (contractFunctionResult: ContractFunctionResult) => {
        const tokenCount = contractFunctionResult.getUint256(1);
        const result : string[] = [];
        for (var i = 0; i < Number(tokenCount); i ++ ) {
            result.push(contractFunctionResult.getAddress(i + 2));
        }
        return result;
    }
}