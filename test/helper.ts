import { Helper } from "../deployment/Helper";
import { expect } from "chai";

describe("Helper Tests", function () {
  it("verify that file name should be non-empty when path is correct", async function () {
    const name = Helper.extractFileName("/deployment/helper/info.json");
    expect(name).to.be.equal("info");
  });
  it("verify that file name should be empty when path is equal to file-name", async function () {
    const name = Helper.extractFileName("info.json");
    expect(name).to.be.equal("info");
  });
  it("verify that file name should be empty when path is in-correct", async function () {
    const name = Helper.extractFileName("development");
    expect(name).to.be.equal("");
  });
  it("verify that file name should be empty when path is missing", async function () {
    const name = Helper.extractFileName("");
    expect(name).to.be.equal("");
  });
});
