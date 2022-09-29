
import * as fs from "fs";
import Web3 from "web3";

export class EventConsumer {

    private abi: any;

    private web3 = new Web3;

    public constructor (abiPath: string) {
        this.abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    }

    private logRecords: Array<any> = new Array<any>;
    /**
    * Decodes event contents using the ABI definition of the event
    * @param eventName the name of the event
    * @param log log data as a Hex string
    * @param topics an array of event topics
    */
    private decodeEvent(eventName: any, log: any, topics: any) {
        const eventAbi = this.abi.find((event: any) => (event.name === eventName && event.type === "event"));
        const decodedLog = this.web3.eth.abi.decodeLog(eventAbi.inputs, log, topics);
        return decodedLog;
    }

    public async getEventsFromRecord(record: any, eventName: string): Promise<Array<any>> {
        console.log(`\nGetting event(s) `);

        // the events from the function call are in record.contractFunctionResult.logs.data
        // let's parse the logs using web3.js
        // there may be several log entries
        record.logs.forEach((log: any) => {
            // convert the log.data (uint8Array) to a string
            let logStringHex = '0x'.concat(Buffer.from(log.data).toString('hex'));

            // get topics from log
            let logTopics: Array<string> = [];
            log.topics.forEach((topic: string) => {
                logTopics.push('0x'.concat(Buffer.from(topic).toString('hex')));
            });

            // decode the event data
            const event = this.decodeEvent(eventName, logStringHex, logTopics.slice(1));

            // output the from address stored in the event
            this.logRecords.push(event);
        });

        return this.logRecords;
    }

    public getLogs(): Array<any> {
        return this.logRecords;
    }
}