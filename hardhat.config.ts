import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@typechain/hardhat";
import "solidity-coverage";
import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        /// Note: A “runs” parameter of “1” will produce short but expensive code.
        ///       In contrast, a larger “runs” parameter will produce longer but more gas efficient code.
        ///       The maximum value of the parameter is 2**32-1. So it could change as required.
        runs: 13000,
      },
    },
  },
  networks: {
    remoteRelay: {
      url: "https://testnet.hashio.io/api",
    },
    hardhat: {
      allowUnlimitedContractSize: true,
    },
  },
};

export default config;
