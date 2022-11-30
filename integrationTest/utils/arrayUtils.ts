import {
    ContractFunctionResult
  } from "@hashgraph/sdk";

export default class ArrayUtils {

    /// This function is used to iterate over result of ContractFunctionResult which returning array
    /// it return address as string stored after default values.
    public getAddressArray = (contractFunctionResult: ContractFunctionResult) => {
        const tokenCount = contractFunctionResult.getUint256(1);
        const result : string[] = [];
        for (var i = 0; i < Number(tokenCount); i ++ ) {
            result.push(contractFunctionResult.getAddress(i + 2));
        }
        return result;
    }
}