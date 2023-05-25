import Base from "./Base";

import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import {
  Client,
  ContractId,
  TokenId,
  AccountId,
  ContractFunctionParameters,
} from "@hashgraph/sdk";

const INITIALIZE = "initialize";

const SPLIT_TOKENS = "splitTokens";

const GET_VAULTS = "getVaults";
const GET_VAULT_MULTIPLIER = "getVaultMultiplier";
const GET_SPLITTED_AMOUNT_LIST_FOR_GIVEN_AMOUNT =
  "getSplittedAmountListForGivenAmount";

export default class Splitter extends Base {
  public initialize = async (
    vaults: ContractId[],
    multipliers: number[],
    client: Client = clientsInfo.operatorClient
  ) => {
    if (await this.isInitializationPending()) {
      const args = new ContractFunctionParameters()
        .addAddress(this.htsAddress)
        .addAddressArray(vaults.map((vault) => vault.toSolidityAddress()))
        .addUint256Array(multipliers);
      await this.execute(5_00_000, INITIALIZE, client, args);
      console.log(
        `- Splitter#${INITIALIZE}(): done, contract-id = ${this.contractId}\n`
      );
      return;
    }
    console.log(
      `- Splitter#${INITIALIZE}(): already done, contract-id = ${this.contractId}\n`
    );
  };

  public vaults = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(1_00_000, GET_VAULTS, client);
    const vaults = Helper.getAddressArray(result);
    console.log(
      `- Splitter#${GET_VAULTS}(): vaults = [${vaults}], count = ${vaults.length}\n`
    );
    return vaults.map((vault: string) => ContractId.fromSolidityAddress(vault));
  };

  public vaultMultiplier = async (
    vaultContractId: ContractId,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addAddress(
      vaultContractId.toSolidityAddress()
    );
    const { result } = await this.execute(
      50_000,
      GET_VAULT_MULTIPLIER,
      client,
      args
    );
    const multiplier = result.getUint256(0);
    console.log(
      `- Splitter#${GET_VAULT_MULTIPLIER}(): vault = ${vaultContractId.toSolidityAddress()}, multiplier = ${multiplier}\n`
    );
    return multiplier;
  };

  public getSplittedAmountListForGivenAmount = async (
    amount: number,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addUint256(amount);
    const { result } = await this.execute(
      5_00_000,
      GET_SPLITTED_AMOUNT_LIST_FOR_GIVEN_AMOUNT,
      client,
      args
    );
    const amounts = Helper.getUint256Array(result);
    console.log(
      `- Splitter#${GET_SPLITTED_AMOUNT_LIST_FOR_GIVEN_AMOUNT}(): amounts = ${amounts}, count = ${amounts.length}\n`
    );
    return amounts;
  };

  public splitTokens = async (
    token: TokenId,
    fromAccount: AccountId,
    amount: number,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(token.toSolidityAddress())
      .addAddress(fromAccount.toSolidityAddress())
      .addUint256(amount);
    const { record } = await this.execute(
      5_000_000,
      SPLIT_TOKENS,
      client,
      args
    );
    console.log(
      `- Splitter#${SPLIT_TOKENS}(): done, TxnId = ${record.transactionId.toString()}`
    );
  };
}
