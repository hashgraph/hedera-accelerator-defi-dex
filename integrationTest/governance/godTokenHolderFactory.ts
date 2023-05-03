import dex from "../../deployment/model/dex";
import GODTokenHolderFactory from "../../e2e-test/business/GODTokenHolderFactory";

import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";

const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);

const csDev = new ContractService();

const godTokenHolderFactoryProxyId = csDev.getContractWithProxy(
  csDev.godTokenHolderFactory
).transparentProxyId!;

const godTokenHolderFactory = new GODTokenHolderFactory(
  godTokenHolderFactoryProxyId
);

async function main() {
  await godTokenHolderFactory.initialize();
  await godTokenHolderFactory.getTokenHolder(
    GOD_TOKEN_ID.toSolidityAddress(),
    clientsInfo.operatorClient
  );
  await godTokenHolderFactory.getTokenHolder(
    TOKEN_ID.toSolidityAddress(),
    clientsInfo.operatorClient
  );
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
