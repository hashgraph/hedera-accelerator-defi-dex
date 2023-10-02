import dex from "../../deployment/model/dex";
import Common from "../../e2e-test/business/Common";
import AssetsHolder from "../../e2e-test/business/AssetsHolder";

import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { ContractService } from "../../deployment/service/ContractService";
import { clientsInfo } from "../../utils/ClientManagement";

const TOKEN_CREATION_FEE = 20;
const INITIAL_AMOUNT = 10e8;
const MINT_AMOUNT = 4e8;
const BURN_AMOUNT = 2e8;
const TRANSFER_AMOUNT = INITIAL_AMOUNT + MINT_AMOUNT - BURN_AMOUNT;

const TO = clientsInfo.treasureId;
const TO_PK = clientsInfo.treasureKey;
const TO_CLIENT = clientsInfo.treasureClient;

async function main() {
  // only for dev testing
  // await createNewCopies();

  const assetsHolder = new AssetsHolder();
  await assetsHolder.initialize(dex.LAB49_1_TOKEN_ADDRESS);
  await assetsHolder.associate(dex.LAB49_2_TOKEN_ADDRESS);

  const nameAndSymbol = Helper.createProposalTitle("TT -");
  await assetsHolder.createToken(
    nameAndSymbol,
    nameAndSymbol,
    INITIAL_AMOUNT,
    TOKEN_CREATION_FEE,
  );

  const tokens = await assetsHolder.getCreatedTokens(true);
  if (tokens.length > 0) {
    const recentToken = tokens.pop()!;
    await assetsHolder.mintToken(recentToken.toSolidityAddress(), MINT_AMOUNT);
    await assetsHolder.burnToken(recentToken.toSolidityAddress(), BURN_AMOUNT);
    // associate token to receiver first
    await Common.associateTokensToAccount(TO, [recentToken], TO_CLIENT, TO_PK);
    await assetsHolder.transfer(
      TO.toSolidityAddress(),
      recentToken.toSolidityAddress(),
      TRANSFER_AMOUNT,
    );
  }
}

async function createNewCopies() {
  const deployment = new Deployment();
  await deployment.deployProxyAndSave(ContractService.ASSET_HOLDER);
  new ContractService().makeLatestDeploymentAsDefault();
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
