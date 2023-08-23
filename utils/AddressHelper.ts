import { Helper } from "./Helper";
import { ContractId } from "@hashgraph/sdk";
import { MirrorNodeService } from "./MirrorNodeService";
import { ContractService } from "../deployment/service/ContractService";

export class AddressHelper {
  private static cs = ContractService.getContractServiceForIds();

  private static async getContractInfoFromMirrorNode(
    idOrAddress: string,
    maxWaitInMs: number = 30 * 1000,
    eachIterationDelayInMS: number = 1 * 1000
  ): Promise<any> {
    const mirrorNodeService = MirrorNodeService.getInstance();
    while (maxWaitInMs > 0) {
      try {
        return await mirrorNodeService.getContractInfo(idOrAddress);
      } catch (e: any) {
        console.log(`Failed to get contract info := ${idOrAddress}`, e.message);
      }
      await Helper.delay(eachIterationDelayInMS);
      maxWaitInMs -= eachIterationDelayInMS;
    }
  }

  private static async getContractInfo(idOrAddress: string): Promise<any> {
    console.time("*** Resolved in");
    const cacheResponse =
      AddressHelper.cs.getContractByIdOrAddress(idOrAddress);
    if (cacheResponse) {
      console.log("*** cache hit ***", idOrAddress);
      console.timeEnd("*** Resolved in");
      console.log("");
      return {
        contract_id: cacheResponse.id,
        evm_address: cacheResponse.address,
      };
    }
    const apiResponse = await this.getContractInfoFromMirrorNode(idOrAddress);
    if (apiResponse) {
      const item = {
        id: apiResponse.contract_id,
        address: apiResponse.evm_address,
      };
      console.log("*** api hit ***", idOrAddress);
      console.timeEnd("*** Resolved in");
      console.log("");
      AddressHelper.cs.addDeployed(item);
      return apiResponse;
    }
    throw Error(`Failed to get contract info := ${idOrAddress}`);
  }

  static async addressToId(address: string): Promise<string> {
    return (await this.getContractInfo(address)).contract_id;
  }

  static async idToEvmAddress(id: string): Promise<string> {
    return (await this.getContractInfo(id)).evm_address;
  }

  static async addressToIdObject(address: string): Promise<ContractId> {
    return ContractId.fromString(await this.addressToId(address));
  }
}
