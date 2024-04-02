import dex from "../model/dex";
import Factory from "../../e2e-test/business/Factory";
import BigNumber from "bignumber.js";
import GodHolder from "../../e2e-test/business/GodHolder";
import Configuration from "../../e2e-test/business/Configuration";
import FTDAOFactory from "../../e2e-test/business/factories/FTDAOFactory";
import NFTDAOFactory from "../../e2e-test/business/factories/NFTDAOFactory";
import HederaGovernor from "../../e2e-test/business/HederaGovernor";
import MultiSigDAOFactory from "../../e2e-test/business/factories/MultiSigDAOFactory";
import FTTokenHolderFactory from "../../e2e-test/business/factories/FTTokenHolderFactory";
import NFTTokenHolderFactory from "../../e2e-test/business/factories/NFTTokenHolderFactory";
import SystemRoleBasedAccess from "../../e2e-test/business/common/SystemRoleBasedAccess";

import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";

const tokenA = TokenId.fromString(dex.TOKEN_LAB49_1);
const tokenB = TokenId.fromString(dex.TOKEN_LAB49_2);
const tokenC = TokenId.fromString(dex.TOKEN_LAB49_3);
const tokenGOD = TokenId.fromString(dex.GOD_TOKEN_ID);
const tokenHBARX = TokenId.fromString(dex.HBARX_TOKEN_ID);
const tokenNFT = dex.NFT_TOKEN_ID;

const createPair = async (
  factory: Factory,
  token0: TokenId,
  token1: TokenId,
  fee: BigNumber,
) => {
  const feeCollectionAccountId = clientsInfo.operatorId;

  return await factory.createPair(
    token0,
    token1,
    feeCollectionAccountId,
    clientsInfo.uiUserKey,
    clientsInfo.uiUserClient,
    fee,
  );
};

export async function main() {
  const systemBasedControlAccess = new SystemRoleBasedAccess();
  await systemBasedControlAccess.initialize();

  const configuration = new Configuration();
  await configuration.initialize();

  /*
  const fees = await configuration.getTransactionsFee();
  const factory = new Factory();
  await factory.setupFactory();
  await factory.getPairs();

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
*/
  const godTokenHolderFactory = new FTTokenHolderFactory();
  await godTokenHolderFactory.initialize();
  await godTokenHolderFactory.getTokenHolder(tokenGOD.toSolidityAddress());
  /*
  await godTokenHolderFactory.getTokenHolder(
    dex.TOKEN_LAB49_1_ID.toSolidityAddress(),
  );
  await godTokenHolderFactory.getTokenHolder(
    dex.GOVERNANCE_DAO_ONE_TOKEN_ID.toSolidityAddress(),
  );
  */
  const nftTokenHolderFactory = new NFTTokenHolderFactory();
  await nftTokenHolderFactory.initialize();
  await nftTokenHolderFactory.getTokenHolder(tokenNFT.toSolidityAddress());

  await new MultiSigDAOFactory().initialize();

  await new FTDAOFactory().initialize(
    clientsInfo.operatorClient,
    godTokenHolderFactory,
  );

  await new NFTDAOFactory().initialize(
    clientsInfo.operatorClient,
    nftTokenHolderFactory,
  );

  const godHolder = new GodHolder(
    await godTokenHolderFactory.getTokenHolder(tokenGOD.toSolidityAddress()),
  );
  await new HederaGovernor().initialize(godHolder);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
