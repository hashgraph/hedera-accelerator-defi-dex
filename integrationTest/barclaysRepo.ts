import Common from "../e2e-test/business/Common";

import { Helper } from "../utils/Helper";
import BarclaysRepo, {
  EconomicTerms,
  SettlementEvent,
  TradeMatchingInputs,
} from "../e2e-test/business/BarclaysRepo";
import { MirrorNodeService } from "../utils/MirrorNodeService";

const TOKEN_A_QTY = Common.withPrecision(10, 1e8);
const TOKEN_B_QTY = Common.withPrecision(10, 1e8);
const TOKEN_LP_QTY = Common.withPrecision(5, 1e8);
const TOKEN_A_QTY_IN_POOL = Common.withPrecision(10, 1e8);
const TOKEN_B_QTY_IN_POOL = Common.withPrecision(10, 1e8);

const TOKEN_NAME = "LP-Token-Name";
const TOKEN_SYMBOL = "LP-Token-Symbol";

async function main() {
  const barclaysRepo = new BarclaysRepo();
  const blankTrade: TradeMatchingInputs = {
    role: "",
    tradeId: "",
    counterparty: "",
    eventDate: "",
    eventType: "",
    cdmHash: "",
    lineageHash: "",
  };

  const tradeMatchingInputs: TradeMatchingInputs = {
    role: "role",
    tradeId: "tradeId",
    counterparty: "counterparty",
    eventDate: "eventDate",
    eventType: "eventType",
    cdmHash: "cdmHash",
    lineageHash: "lineageHash",
  };

  const economicTerms: EconomicTerms = {
    effectiveDate: "28-09-2023",
    maturityDate: "30-09-2023",
  };
  const blankEconomicTerms: EconomicTerms = {
    effectiveDate: "",
    maturityDate: "",
  };

  const settlementEvent: SettlementEvent = {
    dvpDate: "02-10-2023",
    collateral: "Securites",
    amount: "0",
  };

  const blankSettlementEvent: SettlementEvent = {
    dvpDate: "",
    collateral: "",
    amount: "",
  };

  // await barclaysRepo.initialize(blankTrade, blankEconomicTerms, blankSettlementEvent);

  // const updatedTradeMatchingInputs: TradeMatchingInputs = {
  //     role: "role",
  //     tradeId: "tradeId",
  //     counterparty: "counterparty",
  //     eventDate: "eventDate",
  //     eventType: "newEventType",
  //     cdmHash: "updatedHashcdmHash",
  //     lineageHash: "lineageHash",
  // }

  // const newSettlementEvent: SettlementEvent = {
  //     dvpDate: "31-10-2023",
  //     collateral: "Bond",
  //     amount: 9
  // }

  //await barclaysRepo.updateTradeState(updatedTradeMatchingInputs, economicTerms, settlementEvent);

  //await barclaysRepo.updateEconomicTerms("03-10-2023", "05-10-2024");

  //await barclaysRepo.updateSettlementEvent(newSettlementEvent);

  const tradeEvents = await MirrorNodeService.getInstance().getEvents(
    barclaysRepo.contractId,
    true,
  );
  console.log(JSON.stringify(tradeEvents.get("TradeState")));
  console.table(tradeEvents);
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
