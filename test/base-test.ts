// Commenting test as contract has dependency on HTS service which we need to mock somehow.
import {  expect } from "chai";
import hre from "hardhat";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";

describe("BaseHTS", function () {
  async function deployFixture() {
    const BaseHTS = await hre.ethers.getContractFactory("BaseHTS");
    const baseHTS = await hre.upgrades.deployProxy(BaseHTS, {"kind": "uups", "unsafeAllow": ['delegatecall']});

    return { baseHTS };
  }

  it("Base test ", async function () {
    const { baseHTS } = await loadFixture(deployFixture);
  });

});

