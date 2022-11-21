import { Helper } from "../deployment/Helper";
import { expect } from "chai";

describe("Helper Tests", function () {
  it("verify that file name should be non-empty when path is correct", async function () {
    const name = Helper.extractFileName("/deployment/helper/info.json");
    expect(name).to.be.equal("info");
  });
  it("verify that file name should be returned when path is equal to file-name", async function () {
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
  it("verify that retured paths should have given contract json", async function () {
    const contractName = "basehts";
    const { compiledPaths } = Helper.getContractPathList("./artifacts");
    const filePath = compiledPaths.find(
      (path) => Helper.extractFileName(path).toLowerCase() === contractName
    );
    const extractedContractName = Helper.extractFileName(filePath!).toLowerCase();
    expect(extractedContractName).to.be.equals(contractName);
  });
  it("verify that retured paths should not have given contract json", async function () {
    const contractName = "xyz";
    const { compiledPaths } = Helper.getContractPathList("./artifacts");
    const filePath = compiledPaths.find(
      (path) => Helper.extractFileName(path).toLowerCase() === contractName
    );
    expect(filePath).to.be.equals(undefined);
  });
  it("verify that retured paths should be empty when wrong input", async function () {
    const { compiledPaths } = Helper.getContractPathList("xyz");
    expect(compiledPaths.length).to.be.equals(0);
  });
});
