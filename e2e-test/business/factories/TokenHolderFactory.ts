import Base from "../Base";
import GodHolder from "../GodHolder";
import NFTHolder from "../NFTHolder";

import { Helper } from "../../../utils/Helper";
import { Deployment } from "../../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../../utils/ClientManagement";
import { AddressHelper } from "../../../utils/AddressHelper";
import {
  Client,
  TokenId,
  ContractId,
  ContractFunctionParameters,
} from "@hashgraph/sdk";

const INITIALIZE = "initialize";
const GET_TOKEN_HOLDER = "getTokenHolder";
const GET_TOKEN_HOLDERS = "getTokenHolders";

export default abstract class TokenHolderFactory extends Base {
  protected abstract getPrefix(): string;

  protected abstract getHolderLogic(): string;

  protected abstract getHolderInstance(
    contractId: ContractId,
  ): GodHolder | NFTHolder;

  public initialize = async (client: Client = clientsInfo.operatorClient) => {
    if (await this.isInitializationPending()) {
      const logic = this.getHolderLogic();
      const holderLogic = await new Deployment().deploy(logic);
      const args = new ContractFunctionParameters()
        .addAddress(this.htsAddress)
        .addAddress(holderLogic.address)
        .addAddress(clientsInfo.childProxyAdminId.toSolidityAddress());
      await this.execute(4_00_000, INITIALIZE, client, args);
      console.log(
        `- ${this.getPrefix()}TokenHolderFactory#${INITIALIZE}(): done. \n`,
      );
      return;
    }
    console.log(
      `- ${this.getPrefix()}TokenHolderFactory#${INITIALIZE}(): already done. \n`,
    );
  };

  public getTokenHolder = async (
    tokenAddress: string,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = new ContractFunctionParameters().addAddress(tokenAddress);

    const { result } = await this.execute(
      20_00_000,
      GET_TOKEN_HOLDER,
      client,
      args,
    );
    const address = result.getAddress(0);
    const contractId = await AddressHelper.addressToIdObject(address);
    const items = [
      {
        TokenId: TokenId.fromSolidityAddress(tokenAddress).toString(),
        HolderContractId: contractId.toString(),
      },
    ];
    console.log(
      `- ${this.getPrefix()}TokenHolderFactory#${GET_TOKEN_HOLDER}():`,
    );
    console.table(items);
    return contractId;
  };

  public getTokenHolders = async (
    client: Client = clientsInfo.operatorClient,
  ) => {
    const { result } = await this.execute(9_00_000, GET_TOKEN_HOLDERS, client);
    const contractAddresses = Helper.getAddressArray(result);
    const items: any[] = [];
    await Promise.all(
      contractAddresses.map(async (address: string) => {
        const contractId = await AddressHelper.addressToIdObject(address);
        const tokenId =
          await this.getHolderInstance(contractId).getToken(client);
        items.push({
          TokenId: tokenId.toString(),
          HolderContractId: contractId.toString(),
        });
      }),
    );
    console.log(
      `- ${this.getPrefix()}TokenHolderFactory#${GET_TOKEN_HOLDERS}():`,
    );
    console.table(items);
    return items;
  };
}
