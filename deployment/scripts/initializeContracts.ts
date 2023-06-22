import dex from "../model/dex";
import BigNumber from "bignumber.js";
import Factory from "../../e2e-test/business/Factory";

import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../service/ContractService";
import { InstanceProvider } from "../../utils/InstanceProvider";

const tokenA = TokenId.fromString(dex.TOKEN_LAB49_1);
const tokenB = TokenId.fromString(dex.TOKEN_LAB49_2);
const tokenC = TokenId.fromString(dex.TOKEN_LAB49_3);
const tokenGOD = TokenId.fromString(dex.GOD_TOKEN_ID);
const tokenHBARX = TokenId.fromString(dex.HBARX_TOKEN_ID);
const tokenNFT = TokenId.fromString(dex.NFT_TOKEN_ID);

const csDev = new ContractService();

const createPair = async (
  factory: Factory,
  token0: TokenId,
  token1: TokenId,
  fee: BigNumber
) => {
  const feeCollectionAccountId = clientsInfo.operatorId;

  return await factory.createPair(
    token0,
    token1,
    feeCollectionAccountId,
    clientsInfo.uiUserKey,
    clientsInfo.uiUserClient,
    fee
  );
};

export async function main() {
  const provider = InstanceProvider.getInstance();

  const configuration = provider.getConfiguration();
  await configuration.initialize();
  const fees = await configuration.getTransactionsFee();

  const factory = provider.getFactory();
  await factory.setupFactory();
  try {
    await createPair(factory, tokenB, tokenHBARX, fees[1]);
  } catch (error) {
    console.log(`Create pair failed for ${tokenB} and ${tokenHBARX}}`);
    console.error(error);
  }

  try {
    await createPair(factory, tokenA, tokenC, fees[3]);
  } catch (error) {
    console.log(`Create pair failed for ${tokenA} and ${tokenC}`);
    console.error(error);
  }

  try {
    await createPair(factory, tokenA, tokenB, fees[1]);
  } catch (error) {
    console.log(`Create pair failed for ${tokenA} and ${tokenB}`);
    console.error(error);
  }

  try {
    await createPair(factory, tokenA, tokenGOD, fees[5]);
  } catch (error) {
    console.log(`Create pair failed for ${tokenA} and ${tokenGOD}`);
    console.error(error);
  }

  await factory.getPairs();

  await provider.getGODTokenHolderFactory().initialize();
  await provider.getNFTTokenHolderFactory().initialize();

  const godHolder = await provider.getGODTokenHolderFromFactory(tokenGOD);
  await provider.getGODTokenHolderFromFactory(dex.TOKEN_LAB49_1_ID);
  await provider.getGODTokenHolderFromFactory(dex.GOVERNANCE_DAO_ONE_TOKEN_ID);
  await provider.getNFTTokenHolderFromFactory(tokenNFT);

  await provider.getMultiSigDAOFactory().initialize();
  await provider.getFungibleTokenDAOFactory().initialize();
  await provider.getNonFungibleTokenDAOFactory().initialize();

  for (const contractName of csDev.allGovernorContracts) {
    console.log(`- Governor contract name = ${contractName}`);
    await provider.getGovernor(contractName).initialize(godHolder);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
