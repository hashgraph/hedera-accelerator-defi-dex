import { Helper } from "./Helper";
import { ContractId } from "@hashgraph/sdk";
import { MirrorNodeService } from "./MirrorNodeService";

export class AddressHelper {
  private static async getContractInfo(idOrAddress: string): Promise<any> {
    await Helper.delay(6000);
    return await MirrorNodeService.getInstance().getContractInfo(idOrAddress);
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
