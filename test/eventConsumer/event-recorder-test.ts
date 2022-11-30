import { expect } from "chai";
import * as fs from "fs";

import { EventConsumer } from "../../integrationTest/utils/EventConsumer";
const relativePath = "./test/eventConsumer/";
describe("EventConsumer", function () {
  describe("getEventsFromRecord", function () {
    it("Get all events ", async function () {
      const eventConsumer = new EventConsumer(relativePath + "abi.json");
      const output = JSON.parse(
        fs.readFileSync(relativePath + "sample-record.json", "utf8")
      );
      const logs: Array<any> = await eventConsumer.getEventsFromRecord(
        output,
        "SenderDetail"
      );
      expect(logs.length).to.be.equals(2);
      expect(logs[0]._from).to.be.equals(
        "0x0000000000000000000000000000000002D70207"
      );
      expect(logs[0].msg).to.be.equals("allotLPTokenForWithDelegate");
      expect(logs[1]._from).to.be.equals(
        "0x0000000000000000000000000000000002D70207"
      );
      expect(logs[1].msg).to.be.equals("mintTokenPublicWithDelegate");
    });
  });
});
