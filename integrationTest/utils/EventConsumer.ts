
import * as fs from "fs";
import Web3 from "web3";
import axios from "axios";
import { ContractId } from "@hashgraph/sdk";

/**
 * In Smart Contract
 *      Define event - event SenderDetail(address indexed _from, string msg);
 *      Emit event in smart contract - emit SenderDetail(address, "Message");
 * 
 * In consumer code SDK
 *      const response = await contractAllotTx.getRecord(client);
 *      const allRecords = await getEventsFromRecord(response.contractFunctionResult.logs, "SenderDetail");
 *  
 */
export class EventConsumer {

    private abi: any;

    private web3 = new Web3;

    public constructor (abiPath: string) {
        this.abi = JSON.parse(fs.readFileSync(abiPath, 'utf8')).abi;
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
        record.forEach((log: any) => {
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


    public async getEventsFromMirror(contractId: ContractId) {
        const delay = (ms: any) => new Promise((res) => setTimeout(res, ms));
        console.log(`\nGetting event(s) from mirror`);
        console.log(`Waiting 10s to allow transaction propagation to mirror`);
        await delay(10000);
    
        const url = `https://testnet.mirrornode.hedera.com/api/v1/contracts/${contractId.toString()}/results/logs?order=asc`;
    
        axios
            .get(url)
            .then( (response: any) => {
                const jsonResponse = response.data;
    
                jsonResponse.logs.forEach((log: any) => {
                    // decode the event data
                    const event = this.decodeEvent("SendDetail", log.data, log.topics.slice(1));
                    this.logRecords.push(event);
                });
            })
            .catch(function (err) {
                console.error(err);
            });
    }
}