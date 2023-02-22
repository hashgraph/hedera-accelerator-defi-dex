import dex from "../../deployment/model/dex";
import GodTokenFactory from "../../e2e-test/business/GODTokenHolderFactory";
import GodHolder from "../../e2e-test/business/GodHolder";

import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";

const csDev = new ContractService();

const godHolderProxy = csDev.getContractWithProxy(csDev.godHolderContract);

const godTokenHolderFactoryProxyId = csDev.getContractWithProxy(
  csDev.godTokenHolderFactory
).transparentProxyId!;

const godHolder = new GodHolder(godHolderProxy.transparentProxyId!);
const godTokenFactory = new GodTokenFactory(godTokenHolderFactoryProxyId);

const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);

async function main() {
  await godHolder.initializeWithToken(
    clientsInfo.operatorClient,
    TOKEN_ID.toSolidityAddress()
  );
  await godTokenFactory.createGODHolder(
    godHolderProxy.transparentProxyAddress!,
    clientsInfo.operatorClient
  );
  await godTokenFactory.getGodTokenHolder(
    GOD_TOKEN_ID.toSolidityAddress(),
    clientsInfo.operatorClient
  );
  await godTokenFactory.getGodTokenHolder(
    TOKEN_ID.toSolidityAddress(),
    clientsInfo.operatorClient
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
