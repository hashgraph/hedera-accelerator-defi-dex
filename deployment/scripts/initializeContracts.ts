import dex from "../model/dex";
import BigNumber from "bignumber.js";
import Factory from "../../e2e-test/business/Factory";

import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../service/ContractService";
import Configuration from "../../e2e-test/business/Configuration";
import MultiSigDAOFactory from "../../e2e-test/business/factories/MultiSigDAOFactory";
import FTDAOFactory from "../../e2e-test/business/factories/FTDAOFactory";
import NFTDAOFactory from "../../e2e-test/business/factories/NFTDAOFactory";
import TokenTransferGovernor from "../../e2e-test/business/TokenTransferGovernor";
import GodHolder from "../../e2e-test/business/GodHolder";
import TokenCreateGovernor from "../../e2e-test/business/TokenCreateGovernor";
import ContractUpgradeGovernor from "../../e2e-test/business/ContractUpgradeGovernor";
import TextGovernor from "../../e2e-test/business/TextGovernor";
import FTTokenHolderFactory from "../../e2e-test/business/factories/FTTokenHolderFactory";
import NFTTokenHolderFactory from "../../e2e-test/business/factories/NFTTokenHolderFactory";
import SystemRoleBasedAccess from "../../e2e-test/business/common/SystemRoleBasedAccess";

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

export async function main(cs: ContractService) {
  const systemBasedControlAccess = new SystemRoleBasedAccess(null, cs);
  await systemBasedControlAccess.initialize();

  const configuration = new Configuration(null, cs);
  await configuration.initialize();
  const fees = await configuration.getTransactionsFee();

  const factory = new Factory(null, cs);
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

  // ft-token holder factories
  const godTokenHolderFactory = new FTTokenHolderFactory(null, cs);
  await godTokenHolderFactory.initialize();

  const godHolderContractId = await godTokenHolderFactory.getTokenHolder(
    tokenGOD.toSolidityAddress()
  );
  const godHolder = new GodHolder(godHolderContractId);

  await godTokenHolderFactory.getTokenHolder(
    dex.TOKEN_LAB49_1_ID.toSolidityAddress()
  );
  await godTokenHolderFactory.getTokenHolder(
    dex.GOVERNANCE_DAO_ONE_TOKEN_ID.toSolidityAddress()
  );

  // nft-token holder factories
  const nftTokenHolderFactory = new NFTTokenHolderFactory(null, cs);
  await nftTokenHolderFactory.initialize();
  await nftTokenHolderFactory.getTokenHolder(tokenNFT.toSolidityAddress());

  await new MultiSigDAOFactory(null, cs).initialize();

  await new FTDAOFactory(null, cs).initialize(
    clientsInfo.operatorClient,
    godTokenHolderFactory
  );

  await new NFTDAOFactory(null, cs).initialize(
    clientsInfo.operatorClient,
    nftTokenHolderFactory
  );

  await new TokenTransferGovernor(null, cs).initialize(godHolder);
  await new TokenCreateGovernor(null, cs).initialize(godHolder);
  await new ContractUpgradeGovernor(null, cs).initialize(godHolder);
  await new TextGovernor(null, cs).initialize(godHolder);
}

if (require.main === module) {
  main(new ContractService(ContractService.UAT_CONTRACTS_PATH))
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
