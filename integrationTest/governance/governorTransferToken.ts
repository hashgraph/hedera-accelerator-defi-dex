import dex from "../../deployment/model/dex";
import GodHolder from "../../e2e-test/business/GodHolder";
import NFTHolder from "../../e2e-test/business/NFTHolder";
import TokenTransferGovernor from "../../e2e-test/business/TokenTransferGovernor";
import FTTokenHolderFactory from "../../e2e-test/business/factories/FTTokenHolderFactory";
import NFTTokenHolderFactory from "../../e2e-test/business/factories/NFTTokenHolderFactory";

import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { Hbar, TokenId, HbarUnit, ContractId } from "@hashgraph/sdk";

import {
  lockTokenForVotingIfNeeded,
  createAndExecuteAssetTransferProposal,
  createAndExecuteTokenAssociationProposal,
} from "./governance";

const deployment = new Deployment();

const TRANSFER_TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const TRANSFER_TOKEN_QTY = 1e8;

const TRANSFER_AMOUNT = Hbar.from(1, HbarUnit.Hbar).toTinybars().toNumber();

const FT_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
const NFT_TOKEN_ID = dex.NFT_TOKEN_ID;

const txnFeePayerClient = clientsInfo.operatorClient;

const receiverAccountId = clientsInfo.uiUserId;
const receiverAccountPK = clientsInfo.uiUserKey;

const assetTransferWithFungibleTokenAsGODToken = async () => {
  const voterAccountId = clientsInfo.treasureId;
  const voterAccountKey = clientsInfo.treasureKey;
  const voterClient = clientsInfo.treasureClient;

  const ftHolderFactory = new FTTokenHolderFactory();
  await ftHolderFactory.initialize();

  const ftHolderContractId = await ftHolderFactory.getTokenHolder(
    FT_TOKEN_ID.toSolidityAddress(),
  );
  const tokenHolder = new GodHolder(ftHolderContractId);

  const deploymentDetails = await deployment.deployProxy(
    ContractService.GOVERNOR_TT,
  );
  const governor = new TokenTransferGovernor(
    ContractId.fromString(deploymentDetails.transparentProxyId),
  );
  await governor.initialize(
    tokenHolder,
    txnFeePayerClient,
    1,
    0,
    20,
    FT_TOKEN_ID,
    FT_TOKEN_ID,
  );

  // step - 0 lock required tokens to token holder
  await lockTokenForVotingIfNeeded(
    governor,
    tokenHolder,
    txnFeePayerClient,
    voterAccountId,
    voterAccountKey,
    voterClient,
    0,
  );

  // step - 1 (A) ft token association
  await createAndExecuteTokenAssociationProposal(
    governor,
    tokenHolder,
    TRANSFER_TOKEN_ID,
    voterClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 1 (B) ft transfer flow
  await createAndExecuteAssetTransferProposal(
    governor,
    tokenHolder,
    TRANSFER_TOKEN_ID,
    TRANSFER_TOKEN_QTY,
    receiverAccountId,
    receiverAccountPK,
    voterAccountId,
    voterAccountKey,
    voterClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 2 (A) nft token association
  await createAndExecuteTokenAssociationProposal(
    governor,
    tokenHolder,
    NFT_TOKEN_ID,
    voterClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 2 (B) nft transfer flow
  await createAndExecuteAssetTransferProposal(
    governor,
    tokenHolder,
    NFT_TOKEN_ID,
    governor.DEFAULT_NFT_TOKEN_FOR_TRANSFER,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    voterClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 3 HBar transfer flow
  await createAndExecuteAssetTransferProposal(
    governor,
    tokenHolder,
    dex.ZERO_TOKEN_ID,
    TRANSFER_AMOUNT,
    receiverAccountId,
    receiverAccountPK,
    voterAccountId,
    voterAccountKey,
    voterClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 4 unlock required tokens from token holder
  await tokenHolder.checkAndClaimGodTokens(voterClient, voterAccountId);
  await governor.upgradeHederaService();
};

const assetTransferWithNonFungibleTokenAsGODToken = async () => {
  const voterAccountId = clientsInfo.operatorId;
  const voterAccountKey = clientsInfo.operatorKey;
  const voterClient = clientsInfo.operatorClient;

  const nftHolderFactory = new NFTTokenHolderFactory();
  const nftHolderContractId = await nftHolderFactory.getTokenHolder(
    NFT_TOKEN_ID.toSolidityAddress(),
  );
  const tokenHolder = new NFTHolder(nftHolderContractId);

  const deploymentDetails = await deployment.deployProxy(
    ContractService.GOVERNOR_TT,
  );
  const governor = new TokenTransferGovernor(
    ContractId.fromString(deploymentDetails.transparentProxyId),
  );

  await governor.initialize(
    tokenHolder,
    txnFeePayerClient,
    1,
    0,
    20,
    NFT_TOKEN_ID,
    NFT_TOKEN_ID,
  );

  // step - 0 lock required tokens to token holder
  await lockTokenForVotingIfNeeded(
    governor,
    tokenHolder,
    txnFeePayerClient,
    voterAccountId,
    voterAccountKey,
    voterClient,
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO_FOR_VOTING,
  );

  // step - 1 (A) ft token association
  await createAndExecuteTokenAssociationProposal(
    governor,
    tokenHolder,
    TRANSFER_TOKEN_ID,
    voterClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 1 (B) ft transfer flow
  await createAndExecuteAssetTransferProposal(
    governor,
    tokenHolder,
    TRANSFER_TOKEN_ID,
    TRANSFER_TOKEN_QTY,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    voterClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 2 (A) nft token association
  await createAndExecuteTokenAssociationProposal(
    governor,
    tokenHolder,
    NFT_TOKEN_ID,
    voterClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 2 (B) nft transfer flow
  await createAndExecuteAssetTransferProposal(
    governor,
    tokenHolder,
    NFT_TOKEN_ID,
    governor.DEFAULT_NFT_TOKEN_FOR_TRANSFER,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    voterClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 3 HBar transfer flow
  await createAndExecuteAssetTransferProposal(
    governor,
    tokenHolder,
    dex.ZERO_TOKEN_ID,
    TRANSFER_AMOUNT,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    voterClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 4 unlock required tokens from token holder
  await tokenHolder.checkAndClaimGodTokens(voterClient, voterAccountId);
  await governor.upgradeHederaService();
};

async function main() {
  console.log("************************ FT Test ******************");
  await assetTransferWithFungibleTokenAsGODToken();
  console.log(`\n************************ NFT Test ******************\n`);
  await assetTransferWithNonFungibleTokenAsGODToken();
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
