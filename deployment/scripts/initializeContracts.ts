import dex from "../model/dex";
import Factory from "../../e2e-test/business/Factory";
import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";

import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../service/ContractService";

const tokenA = TokenId.fromString(dex.TOKEN_LAB49_1);
const tokenB = TokenId.fromString(dex.TOKEN_LAB49_2);
const tokenC = TokenId.fromString(dex.TOKEN_LAB49_3);
const tokenGOD = TokenId.fromString(dex.GOD_TOKEN_ID);
const tokenHBARX = TokenId.fromString(dex.HBARX_TOKEN_ID);

const csDev = new ContractService();
const factoryContractId = csDev.getContractWithProxy(csDev.factoryContractName)
  .transparentProxyId!;

const godHolderContractId = csDev.getContractWithProxy(csDev.godHolderContract)
  .transparentProxyId!;

const factory = new Factory(factoryContractId);
const godHolder = new GodHolder(godHolderContractId);

const createPair = async (token0: TokenId, token1: TokenId) => {
  const feeCollectionAccountId = clientsInfo.operatorId;
  const tokensOwnerKey = clientsInfo.treasureKey;
  return await factory.createPair(
    token0,
    token1,
    feeCollectionAccountId,
    tokensOwnerKey
  );
};

async function main() {
  await factory.setupFactory();

  try {
    await createPair(tokenB, tokenHBARX);
  } catch (error) {
    console.log(`Create pair failed for ${tokenB} and ${tokenHBARX}`);
    console.error(error);
  }

  try {
    await createPair(tokenB, tokenC);
  } catch (error) {
    console.log(`Create pair failed for ${tokenB} and ${tokenC}`);
    console.error(error);
  }

  try {
    await createPair(tokenA, tokenGOD);
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

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
