import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../utils/ClientManagement";
import { ContractService } from "../deployment/service/ContractService";

import Configuration from "../e2e-test/business/Configuration";

const csDev = new ContractService();
const configurationContractId = csDev.getContractWithProxy(csDev.configuration)
  .transparentProxyId!;

const configuration = new Configuration(configurationContractId);

async function main() {
  await configuration.initialize();
  await configuration.getTransactionsFee();
  await configuration.setTransactionFee(
    BigNumber(1),
    BigNumber(5),
    clientsInfo.operatorKey
  );
  await configuration.getTransactionsFee();
  await configuration.getCommaSeparatedUrlKeys();
  await configuration.addUrlKey("newKey");
  await configuration.getCommaSeparatedUrlKeys();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
