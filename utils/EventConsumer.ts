import * as fs from "fs";
import Web3 from "web3";
import axios from "axios";
export class EventConsumer {
  private abi: any;
  private web3 = new Web3();
  private eventSignatureToNameMap = new Map<string, any>();
  private logRecords: Array<any> = new Array<any>();

  public constructor(abiPath: string) {
    this.abi = JSON.parse(fs.readFileSync(abiPath, "utf8")).abi;
    this.fillSignatureMap();
  }

  public getSignatureAndEventEntries() {
    const details: any[] = [];
    this.eventSignatureToNameMap.forEach((value, key) => {
      details.push({ eventName: value.name, eventSignature: key });
    });
    return details;
  }

  public async getEventsFromRecord(
    record: any,
    eventName: string
  ): Promise<Array<any>> {
    console.log(`\nGetting event(s) `);

    // the events from the function call are in record.contractFunctionResult.logs.data
    // let's parse the logs using web3.js
    // there may be several log entries
    record.forEach((log: any) => {
      // convert the log.data (uint8Array) to a string
      let logStringHex = "0x".concat(Buffer.from(log.data).toString("hex"));

      // get topics from log
      let logTopics: Array<string> = [];
      log.topics.forEach((topic: string) => {
        logTopics.push("0x".concat(Buffer.from(topic).toString("hex")));
      });

      // decode the event data
      const event = this.decodeEvent(
        eventName,
        logStringHex,
        logTopics.slice(1)
      );

      // output the from address stored in the event
      this.logRecords.push(event);
    });

    return this.logRecords;
  }

  public getLogs(): Array<any> {
    return this.logRecords;
  }

  public async getEventsFromMirror(
    contractId: string,
    delayRequired: boolean = false
  ) {
    console.log(`- Getting event(s) from mirror`);
    if (delayRequired) {
      const delay = (ms: any) => new Promise((res) => setTimeout(res, ms));
      console.log(`- Waiting 10s to allow transaction propagation to mirror`);
      await delay(10000);
    }
    const url = `https://testnet.mirrornode.hedera.com/api/v1/contracts/${contractId}/results/logs?order=desc`;
    console.log("- Request url:", url);
    const response = await axios.get(url);
    return this.decodeLog(response.data.logs);
  }

  private fillSignatureMap() {
    this.abi.forEach((eventAbi: any) => {
      if (eventAbi.type === "event") {
        const signature = this.web3.eth.abi.encodeEventSignature(eventAbi);
        this.eventSignatureToNameMap.set(signature, eventAbi);
      }
    });
  }

  private decodeEvent(eventName: any, log: any, topics: any) {
    const eventAbi = this.abi.find(
      (event: any) => event.name === eventName && event.type === "event"
    );
    const decodedLog = this.web3.eth.abi.decodeLog(
      eventAbi.inputs,
      log,
      topics
    );
    return decodedLog;
  }

  private decodeLog(logs: any[]) {
    const eventsMap = new Map<string, any[]>();
    for (const log of logs) {
      try {
        const data = log.data;
        const topics = log.topics;
        const eventAbi = this.eventSignatureToNameMap.get(topics[0]);
        if (eventAbi) {
          const event = this.web3.eth.abi.decodeLog(
            eventAbi.inputs,
            data,
            eventAbi.anonymous === true ? topics.splice(1) : topics
          );
          const events = eventsMap.get(eventAbi.name) ?? [];
          eventsMap.set(eventAbi.name, [...events, event]);
        }
      } catch (e: any) {}
    }
    return eventsMap;
  }
}
