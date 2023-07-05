import Base from "../Base";
import GodHolder from "../GodHolder";
import NFTHolder from "../NFTHolder";

import { Helper } from "../../../utils/Helper";
import { Deployment } from "../../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../../utils/ClientManagement";
import { ContractService } from "../../../deployment/service/ContractService";
import {
  Client,
  TokenId,
  ContractId,
  ContractFunctionParameters,
} from "@hashgraph/sdk";

const INITIALIZE = "initialize";
const GET_TOKEN_HOLDER = "getTokenHolder";
const GET_TOKEN_HOLDERS = "getTokenHolders";

export default class TokenHolderFactory extends Base {
  private _isNFTType: Boolean;

  constructor(contractId: string, isNFTType: Boolean) {
    super(contractId);
    this._isNFTType = isNFTType;
  }

  private getPrefix() {
    return this._isNFTType ? "NFT" : "GOD";
  }

  private getHolderInstance(contractId: ContractId) {
    const cId = contractId.toString();
    return this._isNFTType ? new NFTHolder(cId) : new GodHolder(cId);
  }

  initialize = async (client: Client = clientsInfo.operatorClient) => {
    if (await this.isInitializationPending()) {
      const logic = this._isNFTType
        ? ContractService.NFT_HOLDER
        : ContractService.GOD_HOLDER;
      const holderLogic = await new Deployment().deploy(logic);
      const args = new ContractFunctionParameters()
        .addAddress(this.htsAddress)
        .addAddress(holderLogic.address)
        .addAddress(clientsInfo.childProxyAdminId.toSolidityAddress());
      await this.execute(4_00_000, INITIALIZE, client, args);
      console.log(
        `- ${this.getPrefix()}TokenHolderFactory#${INITIALIZE}(): done. \n`
      );
      return;
    }
    console.log(
      `- ${this.getPrefix()}TokenHolderFactory#${INITIALIZE}(): already done. \n`
    );
  };

  getTokenHolder = async (
    tokenAddress: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addAddress(tokenAddress);

    const { result } = await this.execute(
      20_00_000,
      GET_TOKEN_HOLDER,
      client,
      args
    );
    const address = result.getAddress(0);
    const items = [
      {
        TokenId: TokenId.fromSolidityAddress(tokenAddress).toString(),
        HolderContractId: ContractId.fromSolidityAddress(address).toString(),
      },
    ];
    console.log(
      `- ${this.getPrefix()}TokenHolderFactory#${GET_TOKEN_HOLDER}():`
    );
    console.table(items);
    return ContractId.fromSolidityAddress(address);
  };

  getTokenHolders = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(9_00_000, GET_TOKEN_HOLDERS, client);
    const contractIds = Helper.getAddressArray(result);
    const tokensId = await Promise.all(
      contractIds.map((item: string) => {
        const cId = ContractId.fromSolidityAddress(item);
        return this.getHolderInstance(cId).getToken(client);
      })
    );
    const items = contractIds.map((item: string, index: number) => {
      return {
        TokenId: tokensId[index].toString(),
        HolderContractId: ContractId.fromSolidityAddress(item).toString(),
      };
    });
    console.log(
      `- ${this.getPrefix()}TokenHolderFactory#${GET_TOKEN_HOLDERS}():`
    );
    console.table(items);
  };
}
