import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../utils/ClientManagement";
import { ContractService } from "../deployment/service/ContractService";

import dex from "../deployment/model/dex";
import GovernanceDAOFactory from "../e2e-test/business/GovernanceDAOFactory";

const csDev = new ContractService();
const governanceDaoFactoryContract = csDev.getContractWithProxy(
  csDev.governanceDaoFactory
);
const governanceDaoFactoryProxyContractId =
  governanceDaoFactoryContract.transparentProxyId!;

const governanceDAOFactory = new GovernanceDAOFactory(
  governanceDaoFactoryProxyContractId
);

async function createDAO(name: string, tokenId: TokenId, isPrivate: boolean) {
  const doaAdmin = clientsInfo.uiUserId.toSolidityAddress();
  await governanceDAOFactory.createDAO(
    doaAdmin,
    name,
    "https://defi-ui.hedera.com/",
    tokenId.toSolidityAddress(),
    500,
    0,
    100,
    isPrivate
  );
}

async function main() {
  await governanceDAOFactory.initialize(governanceDaoFactoryContract.name);
  await createDAO(
    dex.GOVERNANCE_DAO_ONE,
    dex.GOVERNANCE_DAO_ONE_TOKEN_ID,
    false
  );
  await createDAO(
    dex.GOVERNANCE_DAO_TWO,
    dex.GOVERNANCE_DAO_TWO_TOKEN_ID,
    true
  );
  await governanceDAOFactory.getDAOs();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
