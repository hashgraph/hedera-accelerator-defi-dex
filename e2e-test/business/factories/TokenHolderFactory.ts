import Base from "../Base";

import { clientsInfo } from "../../../utils/ClientManagement";
import { Deployment } from "../../../utils/deployContractOnTestnet";
import { Client, ContractId, ContractFunctionParameters } from "@hashgraph/sdk";

const INITIALIZE = "initialize";
const GET_TOKEN_HOLDER = "getTokenHolder";

export default class TokenHolderFactory extends Base {
  private _isNFTType: Boolean;

  constructor(contractId: string, isNFTType: Boolean) {
    super(contractId);
    this._isNFTType = isNFTType;
  }

  private getPrefix() {
    return this._isNFTType ? "NF" : "F";
  }

  initialize = async (client: Client = clientsInfo.operatorClient) => {
    if (await this.isInitializationPending()) {
      const logic = this._isNFTType ? "NFTHolder" : "GodHolder";
      const holderLogic = await new Deployment().deploy(logic);
      const proxyAdmin = clientsInfo.dexOwnerId.toSolidityAddress();
      const args = new ContractFunctionParameters()
        .addAddress(this.htsAddress)
        .addAddress(holderLogic.address)
        .addAddress(proxyAdmin);
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
      9_00_000,
      GET_TOKEN_HOLDER,
      client,
      args
    );

    const address = result.getAddress(0);
    console.log(
      `- ${this.getPrefix()}TokenHolderFactory#${GET_TOKEN_HOLDER}(): Token = ${tokenAddress}, Holder address =  ${address}\n`
    );
    return ContractId.fromSolidityAddress(address);
  };
}
