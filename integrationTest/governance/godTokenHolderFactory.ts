import dex from "../../deployment/model/dex";
import GODTokenHolderFactory from "../../e2e-test/business/GODTokenHolderFactory";
import GodHolder from "../../e2e-test/business/GodHolder";

import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";

const csDev = new ContractService();

const godHolderLogic = csDev.getContract(csDev.godHolderContract);

const godTokenHolderFactoryProxyId = csDev.getContractWithProxy(
  csDev.godTokenHolderFactory
).transparentProxyId!;

const godTokenHolderFactory = new GODTokenHolderFactory(
  godTokenHolderFactoryProxyId
);

const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);

async function main() {
  await godTokenHolderFactory.initialize(
    godHolderLogic.address,
    clientsInfo.adminId.toSolidityAddress(),
    clientsInfo.operatorClient
  );
  await godTokenHolderFactory.getGodTokenHolder(
    GOD_TOKEN_ID.toSolidityAddress(),
    clientsInfo.operatorClient
  );
  await godTokenHolderFactory.getGodTokenHolder(
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
