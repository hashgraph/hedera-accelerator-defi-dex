import Base from "./Base";
import BigNumber from "bignumber.js";

import { ethers } from "ethers";
import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import {
  Client,
  TokenId,
  AccountId,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";

const INITIALIZE = "initialize";

const STAKE = "stake";
const UNSTAKE = "unstake";

const STAKED_TOKEN_BY_USER = "stakedTokenByUser";
const GET_STAKING_TOKEN_ADDRESS = "getStakingTokenAddress";
const GET_STAKING_TOKEN_TOTAL_SUPPLY = "getStakingTokenTotalSupply";
const GET_STAKING_TOKEN_LOCKING_PERIOD = "getStakingTokenLockingPeriod";

const CAN_USER_UNSTAKE_TOKENS = "canUserUnStakeTokens";
const CAN_USER_CLAIM_REWARDS = "canUserClaimRewards";

const ADD_REWARD = "addReward";
const CLAIM_REWARDS = "claimRewards";

export default class Vault extends Base {
  initialize = async (
    stakingToken: TokenId,
    lockingPeriod: BigNumber | number,
    client: Client = clientsInfo.operatorClient
  ) => {
    if (await this.isInitializationPending()) {
      const args = new ContractFunctionParameters()
        .addAddress(this.htsAddress)
        .addAddress(stakingToken.toSolidityAddress())
        .addUint256(lockingPeriod);
      await this.execute(1_000_000, INITIALIZE, client, args);
      console.log(
        `- Vault#${INITIALIZE}(): done, contract-id = ${this.contractId}\n`
      );
      return;
    }
    console.log(
      `- Vault#${INITIALIZE}(): already done, contract-id = ${this.contractId}\n`
    );
  };

  protected getContractName() {
    return ContractService.VAULT;
  }

  stake = async (amount: BigNumber | number, client: Client) => {
    const args = new ContractFunctionParameters().addUint256(amount);
    const { record, result } = await this.execute(
      5_00_000,
      STAKE,
      client,
      args
    );
    const hex = ethers.utils.hexlify(result.asBytes());
    const isStaked = result.getBool(0);
    console.log(
      `- Vault#${STAKE}(): amount = ${amount.toString()}, txnId = ${record.transactionId.toString()}, hex = ${hex}, staked = ${isStaked}\n`
    );
    return isStaked;
  };

  unstake = async (amount: BigNumber | number, client: Client) => {
    const args = new ContractFunctionParameters().addUint256(amount);
    const { record, result } = await this.execute(
      9_00_000,
      UNSTAKE,
      client,
      args
    );
    const hex = ethers.utils.hexlify(result.asBytes());
    const wasUnStakeSuccessful = result.getBool(0);
    console.log(
      `- Vault#${UNSTAKE}(): amount = ${amount.toString()}, txnId = ${record.transactionId.toString()}, hex = ${hex}, wasUnStakeSuccessful = ${wasUnStakeSuccessful}\n`
    );
    return wasUnStakeSuccessful;
  };

  addReward = async (
    token: TokenId,
    amount: BigNumber | number,
    senderAccount: AccountId,
    client: Client
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(token.toSolidityAddress())
      .addUint256(amount)
      .addAddress(senderAccount.toSolidityAddress());
    const { record } = await this.execute(1_000_000, ADD_REWARD, client, args);
    console.log(
      `- Vault#${ADD_REWARD}(): done, TokenId = ${token.toString()}, Amount = ${amount.toString()}, sender account = ${senderAccount.toString()}, TxnId = ${record.transactionId.toString()}\n`
    );
  };

  canUserUnStakeTokens = async (
    userAccount: AccountId,
    amount: BigNumber | number,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(userAccount.toSolidityAddress())
      .addUint256(amount);
    const { result } = await this.execute(
      1_00_000,
      CAN_USER_UNSTAKE_TOKENS,
      client,
      args
    );
    const hex = ethers.utils.hexlify(result.bytes);
    const canUserWithdrawTokens = result.getBool(0);
    console.log(
      `- Vault#${CAN_USER_UNSTAKE_TOKENS}(): userAccount = ${userAccount.toString()}, Amount = ${amount.toString()}, canUserWithdrawTokens = ${canUserWithdrawTokens}, hex = ${hex}\n`
    );
    return canUserWithdrawTokens;
  };

  stakedTokenByUser = async (
    userAccount: AccountId,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addAddress(
      userAccount.toSolidityAddress()
    );
    const { result } = await this.execute(
      50_000,
      STAKED_TOKEN_BY_USER,
      client,
      args
    );
    const amount = result.getInt256(0);
    console.log(
      `- Vault#${STAKED_TOKEN_BY_USER}(): userAccount = ${userAccount.toString()}, Amount = ${amount.toString()}\n`
    );
    return amount;
  };

  getStakingTokenTotalSupply = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    const { result } = await this.execute(
      50_000,
      GET_STAKING_TOKEN_TOTAL_SUPPLY,
      client
    );
    const totalSupply = result.getInt256(0);
    console.log(
      `- Vault#${GET_STAKING_TOKEN_TOTAL_SUPPLY}(): amount = ${totalSupply}\n`
    );
    return totalSupply;
  };

  getStakingTokenLockingPeriod = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    const { result } = await this.execute(
      50_000,
      GET_STAKING_TOKEN_LOCKING_PERIOD,
      client
    );
    const lockingPeriod = result.getInt256(0);
    console.log(
      `- Vault#${GET_STAKING_TOKEN_LOCKING_PERIOD}(): period = ${lockingPeriod} sec\n`
    );
    return lockingPeriod;
  };

  getStakingTokenAddress = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    const { result } = await this.execute(
      50_000,
      GET_STAKING_TOKEN_ADDRESS,
      client
    );
    const address = "0x" + result.getAddress(0);
    console.log(`- Vault#${GET_STAKING_TOKEN_ADDRESS}(): token = ${address}\n`);
    return TokenId.fromSolidityAddress(address);
  };

  claimRewards = async (
    userAccount: AccountId,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addAddress(
      userAccount.toSolidityAddress()
    );
    const { record, result } = await this.execute(
      1_000_000,
      CLAIM_REWARDS,
      client,
      args
    );
    const offSet = result.getUint256(0).div(32).toNumber();
    const tokens = Helper.getAddressArray(result, offSet, offSet + 4)
      .filter((item: string) => !ethers.constants.AddressZero.includes(item))
      .join(",");
    const info = {
      alreadyClaimedCount: result.getUint256(offSet + 0).toNumber(),
      claimedRewardsCount: result.getUint256(offSet + 1).toNumber(),
      unclaimedRewardsCount: result.getUint256(offSet + 2).toNumber(),
      totalRewardsCount: result.getUint256(offSet + 3).toNumber(),
      tokens,
    };
    console.log(`- Vault#${CLAIM_REWARDS}():`);
    console.table({ ...info, TxnId: record.transactionId.toString() });
    console.log(`\n`);
  };

  canUserClaimRewards = async (
    userAccount: AccountId,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addAddress(
      userAccount.toSolidityAddress()
    );
    const { result } = await this.execute(
      3_00_000,
      CAN_USER_CLAIM_REWARDS,
      client,
      args
    );
    const hex = ethers.utils.hexlify(result.bytes);
    const canUserClaimRewards = result.getBool(0);
    console.log(
      `- Vault#${CAN_USER_CLAIM_REWARDS}(): userAccount = ${userAccount.toString()}, canUserClaimRewards = ${canUserClaimRewards}, hex = ${hex}\n`
    );
    return canUserClaimRewards;
  };
}
