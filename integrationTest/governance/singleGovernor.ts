import dex from "../../deployment/model/dex";
import Common from "../../e2e-test/business/Common";
import GodHolder from "../../e2e-test/business/GodHolder";
import NFTHolder from "../../e2e-test/business/NFTHolder";
import HederaGovernor from "../../e2e-test/business/HederaGovernor";
import FTTokenHolderFactory from "../../e2e-test/business/factories/FTTokenHolderFactory";
import NFTTokenHolderFactory from "../../e2e-test/business/factories/NFTTokenHolderFactory";
import * as GovernanceProps from "./governance";

import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";

async function createNewCopies(isNFT: boolean) {
  const deployment = new Deployment();
  await deployment.deployProxyAndSave(ContractService.HEDERA_GOVERNOR);
  await deployment.deployProxyAndSave(
    isNFT
      ? ContractService.NFT_TOKEN_HOLDER_FACTORY
      : ContractService.FT_TOKEN_HOLDER_FACTORY,
  );
}

async function getTokenHolder(tokenId: TokenId, isNFT: boolean) {
  const holderFactory = isNFT
    ? new NFTTokenHolderFactory()
    : new FTTokenHolderFactory();
  await holderFactory.initialize();
  const holderId = await holderFactory.getTokenHolder(
    tokenId.toSolidityAddress(),
  );
  return isNFT ? new NFTHolder(holderId) : new GodHolder(holderId);
}

async function executeGovernanceProposalsFlow(
  godTokenId: TokenId, // god token
  ftTokenId: TokenId, // associate and transfer this ft token
  ftTokenAmount: number, // transfer this amount
  nftTokenId: TokenId, // associate and transfer this nft token
  hBarAmount: number, // transfer this HBar amount
) {
  const isNFT = (await Common.getTokenInfo(godTokenId)).isNFT;

  await createNewCopies(isNFT);
  const holder = await getTokenHolder(godTokenId, isNFT);

  const governor = new HederaGovernor();
  await governor.initialize(
    holder,
    clientsInfo.operatorClient,
    isNFT ? 500 : 1,
    0, // 0 seconds
    15, // 15 seconds
    godTokenId,
  );

  await GovernanceProps.executeGovernanceProposals(
    holder,
    governor,
    ftTokenId,
    ftTokenAmount,
    nftTokenId,
    hBarAmount,
  );
}

async function main() {
  console.log("************************ FT Test ******************");
  await executeGovernanceProposalsFlow(
    TokenId.fromString(dex.GOD_TOKEN_ID),
    GovernanceProps.FT_TOKEN_FOR_TRANSFER,
    GovernanceProps.FT_TOKEN_AMOUNT_FOR_TRANSFER,
    GovernanceProps.NFT_TOKEN_FOR_TRANSFER,
    GovernanceProps.CRYPTO_AMOUNT_FOR_TRANSFER,
  );

  console.log("************************ NFT Test ******************");
  await executeGovernanceProposalsFlow(
    dex.NFT_TOKEN_ID,
    GovernanceProps.FT_TOKEN_FOR_TRANSFER,
    GovernanceProps.FT_TOKEN_AMOUNT_FOR_TRANSFER,
    GovernanceProps.NFT_TOKEN_FOR_TRANSFER,
    GovernanceProps.CRYPTO_AMOUNT_FOR_TRANSFER,
  );
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
