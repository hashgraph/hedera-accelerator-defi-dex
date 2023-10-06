import dex from "../../deployment/model/dex";
import Vault from "../../e2e-test/business/Vault";
import Common from "../../e2e-test/business/Common";

import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import SystemRoleBasedAccess from "../../e2e-test/business/common/SystemRoleBasedAccess";
import { AddressHelper } from "../../utils/AddressHelper";

const LOCKING_PERIOD_IN_SECONDS = 15; // 15 second locking period

const STAKING_TOKEN = TokenId.fromString(dex.GOD_TOKEN_ID);
const STAKING_TOKEN_QTY = Common.withPrecision(1, 1).toNumber();

const REWARD_TOKEN = TokenId.fromString(dex.TOKEN_LAB49_1);
const REWARD_TOKEN_1 = TokenId.fromString(dex.TOKEN_LAB49_2);
const REWARD_TOKEN_QTY = Common.withPrecision(1, 1).toNumber();

const addRewards = async (vault: Vault, rToken: TokenId) => {
  await Common.setTokenAllowance(
    rToken,
    vault.contractId,
    REWARD_TOKEN_QTY,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient,
  );
  await vault.addReward(
    rToken,
    REWARD_TOKEN_QTY,
    clientsInfo.treasureId,
    clientsInfo.treasureClient,
  );
};

const stake = async (vault: Vault) => {
  await Common.setTokenAllowance(
    STAKING_TOKEN,
    vault.contractId,
    STAKING_TOKEN_QTY,
    clientsInfo.uiUserId,
    clientsInfo.uiUserKey,
    clientsInfo.uiUserClient,
  );
  return await vault.stake(STAKING_TOKEN_QTY, clientsInfo.uiUserClient);
};

async function main() {
  const vault = new Vault();
  await vault.initialize(STAKING_TOKEN, LOCKING_PERIOD_IN_SECONDS);
  await vault.getStakingTokenAddress();
  await vault.getStakingTokenLockingPeriod();

  // user who has staked their token must associate rewards token so they can earn rewards
  await Common.associateTokensToAccount(
    clientsInfo.uiUserId,
    [REWARD_TOKEN, REWARD_TOKEN_1],
    clientsInfo.uiUserClient,
    clientsInfo.uiUserKey,
  );

  await stake(vault);
  const stakedAmount = await vault.stakedTokenByUser(clientsInfo.uiUserId);
  await vault.canUserUnStakeTokens(clientsInfo.uiUserId, stakedAmount);

  await addRewards(vault, REWARD_TOKEN);
  await addRewards(vault, REWARD_TOKEN_1);
  await vault.getStakingTokenTotalSupply();
  await vault.claimRewards(clientsInfo.uiUserId);
  await vault.claimRewards(clientsInfo.uiUserId);
  const amount = await vault.stakedTokenByUser(clientsInfo.uiUserId);

  !(await vault.canUserUnStakeTokens(clientsInfo.uiUserId, amount)) &&
    (await Helper.delay(LOCKING_PERIOD_IN_SECONDS * 1e3));

  (await vault.canUserUnStakeTokens(clientsInfo.uiUserId, amount)) &&
    (await vault.unstake(amount, clientsInfo.uiUserClient));

  await vault.getStakingTokenTotalSupply();
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
