import Base from "./Base";
import BigNumber from "bignumber.js";

import { ethers } from "ethers";
import { clientsInfo } from "../../utils/ClientManagement";
import {
  Client,
  TokenId,
  AccountId,
  ContractFunctionParameters,
} from "@hashgraph/sdk";

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

  stake = async (amount: BigNumber | number, client: Client) => {
    const args = new ContractFunctionParameters().addUint256(amount);
    const { record } = await this.execute(5_00_000, STAKE, client, args);
    console.log(
      `- Vault#${STAKE}(): done, amount = ${amount.toString()}, TxnId = ${record.transactionId.toString()}\n`
    );
  };

  unstake = async (amount: BigNumber | number, client: Client) => {
    const args = new ContractFunctionParameters().addUint256(amount);
    const { record } = await this.execute(9_00_000, UNSTAKE, client, args);
    console.log(
      `- Vault#${UNSTAKE}(): done, amount = ${amount.toString()}, TxnId = ${record.transactionId.toString()}\n`
    );
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
    const { record } = await this.execute(
      1_000_000,
      CLAIM_REWARDS,
      client,
      args
    );
    console.log(
      `- Vault#${CLAIM_REWARDS}(): done, TxnId = ${record.transactionId.toString()}\n`
    );
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
