import dex from "../../deployment/model/dex";
import Vault from "../../e2e-test/business/Vault";
import Common from "../../e2e-test/business/Common";
import Splitter from "../../e2e-test/business/Splitter";

import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import { TokenId, ContractId } from "@hashgraph/sdk";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { ContractService } from "../../deployment/service/ContractService";
import BigNumber from "bignumber.js";

const STAKING_TOKEN = TokenId.fromString(dex.GOD_TOKEN_ID);
const STAKING_TOKEN_QTY = Common.withPrecision(1, 1).toNumber();
const LOCKING_PERIOD_IN_SECONDS = 15; // 15 second locking period

const REWARD_TOKEN = TokenId.fromString(dex.TOKEN_LAB49_1);
const REWARD_TOKEN_QTY = Common.withPrecision(1, 1e4).toNumber();

const createVaults = async () => {
  const deployment = new Deployment();
  return (
    await Promise.all([
      deployment.deployProxy(ContractService.VAULT),
      deployment.deployProxy(ContractService.VAULT),
      deployment.deployProxy(ContractService.VAULT),
    ])
  ).map((item) => new Vault(ContractId.fromString(item.transparentProxyId)));
};

const vaultsMultiplier = async (splitter: Splitter, vaultsId: ContractId[]) => {
  return await Promise.all(
    vaultsId.map(async (vaultId: ContractId) =>
      splitter.vaultMultiplier(vaultId)
    )
  );
};

const setupVaultAllowances = async (
  amounts: BigNumber[],
  vaultsId: ContractId[]
) => {
  const allowance = async (amount: BigNumber, index: number) =>
    Common.setTokenAllowance(
      REWARD_TOKEN,
      vaultsId[index].toString(),
      amount.toNumber(),
      clientsInfo.treasureId,
      clientsInfo.treasureKey,
      clientsInfo.operatorClient
    );
  return await Promise.all(amounts.map(allowance));
};

const stake = async (vault: Vault) => {
  await Common.setTokenAllowance(
    STAKING_TOKEN,
    vault.contractId,
    STAKING_TOKEN_QTY,
    clientsInfo.uiUserId,
    clientsInfo.uiUserKey,
    clientsInfo.uiUserClient
  );
  await vault.stake(STAKING_TOKEN_QTY, clientsInfo.uiUserClient);
};

const initialize = async (splitter: Splitter) => {
  if (await splitter.isInitializationPending()) {
    const vaults = await createVaults();
    const vaultIds = await Promise.all(
      vaults.map(async (vault: Vault) => {
        await vault.initialize(STAKING_TOKEN, LOCKING_PERIOD_IN_SECONDS);
        await stake(vault);
        return ContractId.fromString(vault.contractId);
      })
    );
    await splitter.initialize(vaultIds, [1, 14, 30]);
  } else {
    console.log(
      `- Splitter#initialize(): already done, contract-id = ${splitter.contractId}\n`
    );
  }
};

async function main() {
  const splitter = new Splitter();
  await initialize(splitter);
  const vaultsId = await splitter.vaults();
  await vaultsMultiplier(splitter, vaultsId);
  const amounts = await splitter.getSplittedAmountListForGivenAmount(
    REWARD_TOKEN_QTY
  );
  await setupVaultAllowances(amounts, vaultsId);
  await splitter.splitTokens(
    REWARD_TOKEN,
    clientsInfo.treasureId,
    REWARD_TOKEN_QTY,
    clientsInfo.treasureClient
  );
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
