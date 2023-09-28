import Base from "./Base";

import { clientsInfo } from "../../utils/ClientManagement";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";

const INITIALIZE = "initialize";
const UPDATE_TRADE_STATE = "updateTradeState";

export interface TradeMatchingInputs {
  role: string;
  tradeId: string;
  counterparty: string;
  eventDate: string;
  eventType: string;
  cdmHash: string;
  lineageHash: string;
}

export interface EconomicTerms {
  effectiveDate: string;
  maturityDate: string;
}

export interface SettlementEvent {
  dvpDate: string;
  collateral: string;
  amount: string;
}

export default class BarclaysRepo extends Base {
  protected getContractName() {
    return ContractService.BARCLAYS_REPO;
  }

  initialize = async (
    tradeMatchingInputs: TradeMatchingInputs,
    economicTerms: EconomicTerms,
    settlementEvent: SettlementEvent,
    client: Client = clientsInfo.operatorClient,
  ) => {
    if (await this.isInitializationPending()) {
      const data = {
        tradeMatchingInputs: Object.values(tradeMatchingInputs),
        economicTerms: Object.values(economicTerms),
        settlementEvent: Object.values(settlementEvent),
      };
      const inputs = Object.values(data);

      const { hex, bytes } = await this.encodeFunctionData(
        ContractService.BARCLAYS_REPO,
        INITIALIZE,
        inputs,
      );
      const { receipt } = await this.execute(
        70_00_000,
        INITIALIZE,
        client,
        bytes,
      );

      console.log(
        `- BarclaysRepo#${INITIALIZE}(): hex-data = ${hex}, status = ${receipt.status}\n`,
      );
      return;
    }
    console.log(`- BarclaysRepo#${INITIALIZE}(): already done\n`);
  };

  public updateTradeState = async (
    tradeMatchingInputs: TradeMatchingInputs,
    economicTerms: EconomicTerms,
    settlementEvent: SettlementEvent,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const data = {
      tradeMatchingInputs: Object.values(tradeMatchingInputs),
      economicTerms: Object.values(economicTerms),
      settlementEvent: Object.values(settlementEvent),
    };
    const inputs = Object.values(data);

    const { hex, bytes } = await this.encodeFunctionData(
      ContractService.BARCLAYS_REPO,
      UPDATE_TRADE_STATE,
      inputs,
    );

    const { receipt } = await this.execute(
      70_00_000,
      UPDATE_TRADE_STATE,
      client,
      bytes,
    );

    console.log(
      `- BarclaysRepo#${UPDATE_TRADE_STATE}(): hex-data = ${hex}, status = ${receipt.status}\n`,
    );
  };

  public updateEconomicTerms = async (
    effectDate: string,
    maturityDate: string,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = new ContractFunctionParameters()
      .addString(effectDate)
      .addString(maturityDate);

    await this.execute(400000, "updateEconomicTerms", client, args);
    console.log(
      `- BarclaysRepo#${"updateEconomicTerms"}(): effectDate = ${effectDate}, maturityDate = ${maturityDate} done\n`,
    );
  };

  public updateSettlementEvent = async (
    settlementEvent: SettlementEvent,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = new ContractFunctionParameters()
      .addString(settlementEvent.dvpDate)
      .addString(settlementEvent.collateral)
      .addString(settlementEvent.amount);

    await this.execute(400000, "updateSettlementEvent", client, args);
    console.log(
      `- BarclaysRepo#${"updateSettlementEvent"}(): settlementEvent = ${JSON.stringify(
        settlementEvent,
      )} done\n`,
    );
  };

  public updateTradeMatchingInputs = async (
    tradeMatchingInputs: TradeMatchingInputs,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const args = new ContractFunctionParameters()
      .addString(tradeMatchingInputs.role)
      .addString(tradeMatchingInputs.tradeId)
      .addString(tradeMatchingInputs.counterparty)
      .addString(tradeMatchingInputs.eventDate)
      .addString(tradeMatchingInputs.eventType)
      .addString(tradeMatchingInputs.cdmHash)
      .addString(tradeMatchingInputs.lineageHash);

    await this.execute(400000, "updateTradeMatchingInputs", client, args);
    console.log(
      `- BarclaysRepo#${"updateTradeMatchingInputs"}(): tradeMatchingInputs = ${JSON.stringify(
        tradeMatchingInputs,
      )} done\n`,
    );
  };
}
