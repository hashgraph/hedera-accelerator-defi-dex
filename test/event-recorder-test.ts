import {  expect } from "chai";
import * as fs from "fs";

import { EventConsumer } from "../integrationTest/utils/EventConsumer";

describe.only('EventConsumer', function () {
    describe('getEventsFromRecord', function () {
      it('Get all events ', async function () {
        const eventConsumer = new EventConsumer("./test/abi.json");
        const output = JSON.parse(fs.readFileSync("./test/sample-record.json", 'utf8'));
        const logs: Array<any> = await eventConsumer.getEventsFromRecord(output, "SenderDetail");
        expect(logs.length).to.be.equals(3);
      });
    });
  });