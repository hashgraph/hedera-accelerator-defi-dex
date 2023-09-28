//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract BarclaysRepo is OwnableUpgradeable {
    struct TradeMatchingInputs {
        string role;
        string tradeId;
        string counterparty;
        string eventDate;
        string eventType;
        string cdmHash;
        string lineageHash;
    }

    struct EconomicTerms {
        string effectiveDate;
        string maturityDate;
    }

    struct SettlementEvent {
        string dvpDate;
        string collateral;
        string amount;
    }

    event TradeState(
        TradeMatchingInputs tradeInputs,
        EconomicTerms economicTerms,
        SettlementEvent settlementEvent
    );

    TradeMatchingInputs private tradeInputs;
    EconomicTerms private economicTerms;
    SettlementEvent private settlementEvent;

    function initialize(
        TradeMatchingInputs memory _tradeInputs,
        EconomicTerms memory _economicTerms,
        SettlementEvent memory _settlementEvent
    ) external initializer {
        tradeInputs = _tradeInputs;
        economicTerms = _economicTerms;
        settlementEvent = _settlementEvent;
        emit TradeState(_tradeInputs, _economicTerms, _settlementEvent);
    }

    function updateTradeState(
        TradeMatchingInputs memory _tradeInputs,
        EconomicTerms memory _economicTerms,
        SettlementEvent memory _settlementEvent
    ) public {
        tradeInputs = _tradeInputs;
        economicTerms = _economicTerms;
        settlementEvent = _settlementEvent;
        emit TradeState(_tradeInputs, _economicTerms, _settlementEvent);
    }

    function updateTradeMatchinInputs(
        string memory effectiveDate,
        string memory maturityDate
    ) public {
        economicTerms.effectiveDate = effectiveDate;
        economicTerms.maturityDate = maturityDate;
        emit TradeState(tradeInputs, economicTerms, settlementEvent);
    }

    function updateEconomicTerms(
        string memory effectiveDate,
        string memory maturityDate
    ) public {
        economicTerms.effectiveDate = effectiveDate;
        economicTerms.maturityDate = maturityDate;
        emit TradeState(tradeInputs, economicTerms, settlementEvent);
    }

    function updateSettlementEvent(
        string memory dvpDate,
        string memory collateral,
        string memory amount
    ) public {
        settlementEvent.dvpDate = dvpDate;
        settlementEvent.collateral = collateral;
        settlementEvent.amount = amount;
        emit TradeState(tradeInputs, economicTerms, settlementEvent);
    }

    function updateTradeMatchingInputs(
        string memory role,
        string memory tradeId,
        string memory counterparty,
        string memory eventDate,
        string memory eventType,
        string memory cdmHash,
        string memory lineageHash
    ) public {
        tradeInputs.role = role;
        tradeInputs.tradeId = tradeId;
        tradeInputs.counterparty = counterparty;
        tradeInputs.eventDate = eventDate;
        tradeInputs.eventType = eventType;
        tradeInputs.cdmHash = cdmHash;
        tradeInputs.lineageHash = lineageHash;
        emit TradeState(tradeInputs, economicTerms, settlementEvent);
    }
}
