import Common from "../e2e-test/business/Common";
import * as fs from "fs";
import { ethers } from "ethers";

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

const readFileTrades = async () => {
  const rawdata: any = fs.readFileSync("./tmp.json");
  const data = JSON.parse(rawdata);
  return data;
};

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
    role: "Buyer",
    tradeId: "UC1GQN1435RKX0",
    counterparty: "CLIENT01",
    eventDate: "2023-10-02",
    eventType: "NewTrade",
    cdmHash: "77a0a13",
    lineageHash: "77a0a13",
  };

  const economicTerms: EconomicTerms = {
    effectiveDate: "2023-10-02",
    maturityDate: "2023-10-03",
  };
  const blankEconomicTerms: EconomicTerms = {
    effectiveDate: "",
    maturityDate: "",
  };

  const settlementEvent: SettlementEvent = {
    dvpDate: "02-10-2023",
    collateral: "GBTHQ4XCY21",
    amount: "1940400",
  };

  const blankSettlementEvent: SettlementEvent = {
    dvpDate: "",
    collateral: "",
    amount: "",
  };

  //await barclaysRepo.initialize(tradeMatchingInputs, economicTerms, settlementEvent);

  const data = await readFileTrades();

  for (let i = 0; i < data.length; i++) {
    const element = data[i];
    const tradeMatchingInputs: TradeMatchingInputs = {
      role: element.buyer.buyer_name,
      tradeId: element.trade_id,
      counterparty: element.seller.seller_name,
      eventDate: element.trade_details.trade_date,
      eventType: "New Contract",
      cdmHash: ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(
          element.buyer.buyer_name + element.seller.seller_name,
        ),
      ),
      lineageHash: ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(
          element.buyer.buyer_name + element.seller.seller_name,
        ),
      ),
    };

    const economicTerms: EconomicTerms = {
      effectiveDate: element.trade_details.effective_date,
      maturityDate: element.trade_details.maturity_date,
    };

    const settlementEvent: SettlementEvent = {
      dvpDate: "",
      collateral: element.trade_details.collateral_id,
      amount: element.trade_details.cash_amount,
    };

    console.log(JSON.stringify(tradeMatchingInputs));
    console.log(JSON.stringify(economicTerms));
    console.log(JSON.stringify(settlementEvent));

    await barclaysRepo.updateTradeMatchingInputs(tradeMatchingInputs);

    await barclaysRepo.updateEconomicTerms(
      economicTerms.effectiveDate,
      economicTerms.maturityDate,
    );

    await barclaysRepo.updateSettlementEvent(settlementEvent);
  }

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
