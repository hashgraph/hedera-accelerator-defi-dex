import dex from "../model/dex";
import Factory from "../../e2e-test/business/Factory";

import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../service/ContractService";
import { InstanceProvider } from "../../utils/InstanceProvider";

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

export async function main() {
  const provider = InstanceProvider.getInstance();
  await provider.getConfiguration().initialize();

  const factory = provider.getFactory();
  await provider.getFactory().setupFactory();
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

  await provider.getFungibleTokenHolder().initialize();
  await provider.getFungibleTokenHolderFactory().initialize();
  await provider.getFungibleTokenDAOFactory().initialize();

  await provider.getNonFungibleTokenHolder().initialize();
  await provider.getNonFungibleTokenHolderFactory().initialize();
  await provider.getNonFungibleTokenDAOFactory().initialize();

  await provider.getMultiSigDAOFactory().initialize();

  for (const contractName of csDev.allGovernorContracts) {
    const contract = csDev.getContractWithProxy(contractName);
    console.log(
      `\n${contractName} transparent proxy contractId: ${contract.transparentProxyId!}`
    );
    try {
      await provider
        .getGovernor(contractName)
        .initialize(provider.getFungibleTokenHolder());
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
