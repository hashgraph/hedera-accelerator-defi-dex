import { Helper } from "../utils/Helper";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../utils/ClientManagement";

import Configuration from "../e2e-test/business/Configuration";
import dex from "../deployment/model/dex";

const configuration = new Configuration();

async function main() {
  await configuration.initialize();
  await configuration.getTransactionsFee();
  await configuration.setTransactionFee(
    BigNumber(1),
    BigNumber(5),
    clientsInfo.operatorKey,
  );
  await configuration.getTransactionsFee();
  await configuration.getHbarxAddress();
  await configuration.setHbarxAddress(
    dex.HBARX_TOKEN_ADDRESS,
    clientsInfo.operatorKey,
  );
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
