import { Helper } from "./Helper";
import { ContractId } from "@hashgraph/sdk";
import { MirrorNodeService } from "./MirrorNodeService";

export class AddressHelper {
  static async addressToId(address: string) {
    await Helper.delay(3000);
    return await MirrorNodeService.getInstance().getContractId(address);
  }

  static async addressToIdObject(address: string) {
    return ContractId.fromString(await AddressHelper.addressToId(address));
  }
}
