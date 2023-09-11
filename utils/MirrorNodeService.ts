import Web3 from "web3";
import Long from "long";
import axios from "axios";
import ContractMetadata from "../utils/ContractMetadata";

import { ethers } from "hardhat";
import { Helper } from "./Helper";
import { AccountId, ContractId, TokenId, TransactionId } from "@hashgraph/sdk";

const BASE_URL = "https://testnet.mirrornode.hedera.com";

export class MirrorNodeService {
  private web3 = new Web3();
  private isLogEnabled: boolean = false;
  private static mirrorNodeService = new MirrorNodeService();

  private constructor() {}

  public static getInstance() {
    return MirrorNodeService.mirrorNodeService;
  }

  public enableLogs() {
    this.isLogEnabled = true;
    return MirrorNodeService.mirrorNodeService;
  }

  public disableLogs() {
    this.isLogEnabled = false;
    return MirrorNodeService.mirrorNodeService;
  }

  private toHex = (data: any) => {
    return data instanceof Uint8Array ? ethers.utils.hexlify(data) : data;
  };

  private async readRecords(
    url: string,
    items: any[],
    key: string | undefined | null = null,
  ) {
    this.isLogEnabled && console.log("- Request url:", url);
    const data = (await axios.get(url))?.data;
    const records = key ? data?.[key] ?? [] : [data];
    const next = data?.links?.next;
    items.push(...records);
    return next ? BASE_URL + next : next;
  }

  public async getTokenBalance(
    id: AccountId | ContractId,
    tokens: TokenId[],
  ): Promise<Map<string, Long>> {
    const tokensId = [...new Set(tokens.map((tokenId) => tokenId.toString()))];
    const tokensMap = new Map();
    const tokensObject: any[] = [];
    let url = `${BASE_URL}/api/v1/accounts/${id.toString()}/tokens`;
    if (tokensId.length === 1) {
      url += `?token.id=${tokensId[0]}`;
    } else {
      url += "?limit=100";
    }
    while ((url = await this.readRecords(url, tokensObject, "tokens")));
    this.isLogEnabled && console.log("- Records count:", tokensObject.length);
    for (const tokenObject of tokensObject) {
      const tokenId = tokenObject.token_id;
      tokensId.includes(tokenId) && tokensMap.set(tokenId, tokenObject.balance);
    }
    this.isLogEnabled && console.table(tokensMap);
    return tokensMap;
  }

  public async getNFTSerialNumbersInfo(id: TokenId | string): Promise<any[]> {
    const serialNumbersInfo: any[] = [];
    const tokensObject: any[] = [];
    let url = `${BASE_URL}/api/v1/tokens/${id.toString()}/nfts?limit=100&order=asc`;
    while ((url = await this.readRecords(url, tokensObject, "nfts")));
    this.isLogEnabled && console.log("- Records count:", tokensObject.length);
    for (const tokenObject of tokensObject) {
      serialNumbersInfo.push({
        accountId: tokenObject.account_id,
        serialNo: tokenObject.serial_number,
      });
    }
    return serialNumbersInfo;
  }

  public async getErrorInfo(txnId: TransactionId) {
    await Helper.delay(5000);
    const response: any[] = [];
    const tId = `${txnId.accountId}-${txnId.validStart?.seconds}-${txnId.validStart?.nanos}`;
    const url = `${BASE_URL}/api/v1/contracts/results/${tId}`;
    await this.readRecords(url, response);
    const r = response.pop();
    const message: string = r.error_message;
    const timestamp = r.timestamp;
    if (!message) {
      return { message: r.result, timestamp };
    }
    if (message === "0x" || !this.web3.utils.isHex(message)) {
      const parsedMessage =
        await this.parseErrorMessageFromCallTraceIfAvailable(tId);
      const finalMessage = parsedMessage.length > 0 ? parsedMessage : message;
      return { message: finalMessage, timestamp };
    }
    const signature = message.substring(0, 10);
    const info = message.substring(10);
    const signatureMap = await new ContractMetadata().getSignatureToABIMap();
    const abi = signatureMap.get(signature);
    const result = this.web3.eth.abi.decodeParameters(abi.inputs, info);
    return { message: result[0], timestamp };
  }

  public async isInitializationPending(contractId: string) {
    return !(await this.getEvents(contractId)).has("Initialized");
  }

  public async getEvents(contractId: string, delayRequired: boolean = false) {
    this.isLogEnabled &&
      console.log(
        `- Getting event(s) from mirror for contract id = ${contractId}`,
      );
    if (delayRequired) {
      this.isLogEnabled &&
        console.log(`- Waiting 10s to allow transaction propagation to mirror`);
      await Helper.delay(10000);
    }
    const allLogs: any[] = [];
    let url = `${BASE_URL}/api/v1/contracts/${contractId}/results/logs?order=asc&limit=100`;
    while ((url = await this.readRecords(url, allLogs, "logs")));
    const events = await this.decodeLog(allLogs);
    events.forEach((value: any, key: string) => {
      this.isLogEnabled && console.log(key, "=>", value);
    });
    return events;
  }

  public async decodeLog(logs: any[]) {
    this.isLogEnabled && console.log("- Events count:", logs.length);
    const eventsMap = new Map<string, any[]>();
    const signatureMap = await new ContractMetadata().getSignatureToABIMap();
    for (const log of logs) {
      try {
        const data = this.toHex(log.data);
        const topics = log.topics.map(this.toHex);
        const eventAbi = signatureMap.get(topics[0]);
        if (eventAbi) {
          const event = this.web3.eth.abi.decodeLog(
            eventAbi.inputs,
            data,
            eventAbi.anonymous === false ? topics.splice(1) : topics,
          );
          const events = eventsMap.get(eventAbi.name) ?? [];
          eventsMap.set(eventAbi.name, [
            ...events,
            this.getEventArgumentsByName(event, eventAbi.name),
          ]);
        } else {
          this.isLogEnabled &&
            console.log(`- No mapping found for topic = ${topics[0]}`);
        }
      } catch (e: any) {
        this.isLogEnabled && console.log(e);
      }
    }
    let mappedItems = 0;
    eventsMap.forEach((items: any[]) => (mappedItems += items.length));
    this.isLogEnabled && console.log("- Mapping count:", mappedItems);
    return eventsMap;
  }

  private async getCallTrace(txnId: string) {
    const calls: any[] = [];
    let url = `${BASE_URL}/api/v1/contracts/results/${txnId}/actions?limit=100&order=desc`;
    while ((url = await this.readRecords(url, calls, "actions")));
    this.isLogEnabled && console.log("- Calls count:", calls.length);
    return calls;
  }

  private async parseErrorMessageFromCallTraceIfAvailable(txnId: string) {
    const errorMessages = (await this.getCallTrace(txnId))
      .filter(
        (call: any) =>
          call.result_data_type === "ERROR" && call.result_data !== "0x",
      )
      .map((call: any) =>
        String.fromCharCode(...ethers.utils.arrayify(call.result_data)),
      );
    return [...new Set(errorMessages)].join(",");
  }

  private getEventArgumentsByName(
    args: any,
    eventName: string,
    excludedKeys: string[] = ["__length__"],
  ) {
    const namedArguments: Record<string, any> = {};
    for (const key in args) {
      if (Number.isNaN(Number(key)) && !excludedKeys.includes(key)) {
        const arg = args[key];
        const refilter =
          Helper.isIterable(arg) &&
          !Array.isArray(arg) &&
          typeof arg !== "string";
        namedArguments[key] = refilter
          ? this.getEventArgumentsByName(arg, eventName, excludedKeys)
          : arg;
      }
    }
    return namedArguments;
  }

  public async getTokensAccountBalance(
    tokenId: string | TokenId,
  ): Promise<any> {
    const tokensObject: any[] = [];
    let url = `${BASE_URL}/api/v1/tokens/${tokenId.toString()}/balances?limit=100&order=asc&account.balance=gt%3A0`;
    while ((url = await this.readRecords(url, tokensObject, "balances")));
    this.isLogEnabled && console.log("- Records count:", tokensObject.length);
    this.isLogEnabled && console.table(tokensObject);
    return tokensObject;
  }

  public async getContractCreator(contractId: string) {
    const info: any[] = [];
    const url = `${BASE_URL}/api/v1/accounts/${contractId.toString()}?order=asc&transactiontype=CONTRACTCREATEINSTANCE`;
    await this.readRecords(url, info);
    const timeStamp = info.pop()!.created_timestamp;
    const url1 = `${BASE_URL}/api/v1/contracts/${contractId.toString()}/results/${timeStamp}`;
    await this.readRecords(url1, info);
    return info.pop()!.from;
  }

  public async getContractInfo(idOrAddress: string): Promise<any> {
    const info: any[] = [];
    const url = `${BASE_URL}/api/v1/contracts/${idOrAddress}`;
    await this.readRecords(url, info);
    return info[0];
  }
}
