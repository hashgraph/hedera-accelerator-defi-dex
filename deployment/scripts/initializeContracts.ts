import dex from "../model/dex";
import Factory from "../../e2e-test/business/Factory";
import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";
import Configuration from "../../e2e-test/business/Configuration";
import GODTokenHolderFactory from "../../e2e-test/business/GODTokenHolderFactory";
import GovernanceDAOFactory from "../../e2e-test/business/GovernanceDAOFactory";

import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../service/ContractService";

const tokenA = TokenId.fromString(dex.TOKEN_LAB49_1);
const tokenB = TokenId.fromString(dex.TOKEN_LAB49_2);
const tokenC = TokenId.fromString(dex.TOKEN_LAB49_3);
const tokenGOD = TokenId.fromString(dex.GOD_TOKEN_ID);
const tokenHBARX = TokenId.fromString(dex.HBARX_TOKEN_ID);

const csDev = new ContractService();

const createPair = async (
  factory: Factory,
  token0: TokenId,
  token1: TokenId
) => {
  const feeCollectionAccountId = clientsInfo.operatorId;
  const tokensOwnerKey = clientsInfo.treasureKey;
  return await factory.createPair(
    token0,
    token1,
    feeCollectionAccountId,
    tokensOwnerKey
  );
};

function createInstances() {
  const factoryContractId = csDev.getContractWithProxy(
    csDev.factoryContractName
  ).transparentProxyId!;

  const godHolderContractId = csDev.getContractWithProxy(
    csDev.godHolderContract
  ).transparentProxyId!;

  const configurationContractId = csDev.getContractWithProxy(
    csDev.configuration
  ).transparentProxyId!;

  const governanceDaoFactoryContractId = csDev.getContractWithProxy(
    csDev.governanceDaoFactory
  ).transparentProxyId!;

  const godHolderFactory = csDev.getContractWithProxy(
    csDev.godTokenHolderFactory
  ).transparentProxyId!;

  const factory = new Factory(factoryContractId);
  const godHolder = new GodHolder(godHolderContractId);
  const configuration = new Configuration(configurationContractId);
  const governanceDaoFactory = new GovernanceDAOFactory(
    governanceDaoFactoryContractId
  );
  const godHolderFactoryInstance = new GODTokenHolderFactory(godHolderFactory);
  return {
    factory,
    godHolder,
    configuration,
    governanceDaoFactory,
    godHolderFactoryInstance,
  };
}

export async function main() {
  const {
    factory,
    godHolder,
    configuration,
    governanceDaoFactory,
    godHolderFactoryInstance,
  } = createInstances();

  await configuration.initialize();
  await governanceDaoFactory.initialize(csDev.governanceDaoFactory);

  await factory.setupFactory();
  try {
    await createPair(factory, tokenB, tokenHBARX);
  } catch (error) {
    console.log(`Create pair failed for ${tokenB} and ${tokenHBARX}`);
    console.error(error);
  }

  try {
    await createPair(factory, tokenB, tokenC);
  } catch (error) {
    console.log(`Create pair failed for ${tokenB} and ${tokenC}`);
    console.error(error);
  }

  try {
    await createPair(factory, tokenA, tokenGOD);
  } catch (error) {
    console.log(`Create pair failed for ${tokenA} and ${tokenGOD}`);
    console.error(error);
  }

  try {
    await godHolder.initialize(clientsInfo.operatorClient);
  } catch (error) {
    console.log(`- GODHolder initialization failed.`);
    console.error(error);
  }

  try {
    await godHolderFactoryInstance.initializeWithGodNewHolder();
  } catch (error) {
    console.log(`- GODHolder initialization failed.`);
    console.error(error);
  }

  for (const contractName of csDev.allGovernorContracts) {
    const contract = csDev.getContractWithProxy(contractName);
    console.log(
      `\n${contractName} transparent proxy contractId: ${contract.transparentProxyId!}`
    );
    try {
      await new Governor(contract.transparentProxyId!).initialize(godHolder);
    } catch (error) {
      console.log(
        `Initialization failed ${contractName} ${contract.transparentProxyId} `
      );
      console.error(error);
    }
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
