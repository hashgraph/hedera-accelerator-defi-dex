import Base from "../../e2e-test/business/Base";
import { clientsInfo } from "../../utils/ClientManagement";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";
import { BigNumber } from "bignumber.js";
import { ethers } from "hardhat";

const GET_CHAIN_ID = "getChainId";
const SETUP = "setup";
const EXEC_TRANSACTION = "execTransaction";

export default class Safe extends Base {
  getChainId = async (client: Client = clientsInfo.ecdsaClient) => {
    const { result } = await this.execute(
      9000000,
      GET_CHAIN_ID,
      client,
      undefined
    );
    const chainId = result.getUint256(0);
    console.log(`- Safe#${GET_CHAIN_ID}(): ${chainId}\n`);
    return chainId;
  };

  /// @dev Setup function sets initial storage of contract.
  /// @param _owners List of Safe owners.
  /// @param _threshold Number of required confirmations for a Safe transaction.
  /// @param to Contract address for optional delegate call.
  /// @param data Data payload for optional delegate call.
  /// @param fallbackHandler Handler for fallback calls to this contract
  /// @param paymentToken Token that should be used for the payment (0 is ETH)
  /// @param payment Value that should be paid
  /// @param paymentReceiver Adddress that should receive the payment (or 0 if tx.origin)

  setup = async (
    owners: Array<string>,
    thresholdCount: number,
    to: string,
    data: Uint8Array,
    fallbackHandlerAddress: string,
    paymentTokenAddress: string,
    payment: BigNumber,
    paymentReceiverAddress: string,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addAddressArray(owners)
      .addUint256(thresholdCount)
      .addAddress(to)
      .addBytes(data)
      .addAddress(fallbackHandlerAddress)
      .addAddress(paymentTokenAddress)
      .addUint256(payment)
      .addAddress(paymentReceiverAddress);

    await this.execute(9000000, SETUP, client, args);
    console.log(`- Safe#${SETUP}(): Done\n`);
  };

  execTransaction = async (
    to: string,
    value: number | BigNumber,
    data: Uint8Array,
    operation: number,
    safeTxGas: BigNumber,
    baseGas: BigNumber,
    gasPrice: BigNumber,
    gasToken: string,
    refundReceiverAddress: string,
    signatures: Uint8Array,
    client: Client = clientsInfo.ecdsaClient
  ) => {
    // address to,
    // uint256 value,
    // bytes calldata data,
    // Enum.Operation operation,
    // uint256 safeTxGas,
    // uint256 baseGas,
    // uint256 gasPrice,
    // address gasToken,
    // address payable refundReceiver,
    // bytes memory signatures

    const args = new ContractFunctionParameters()
      .addAddress(to)
      .addUint256(value)
      .addBytes(data)
      .addUint8(operation)
      .addUint256(safeTxGas)
      .addUint256(baseGas)
      .addUint256(gasPrice)
      .addAddress(gasToken)
      .addAddress(refundReceiverAddress)
      .addBytes(signatures);

    const { result } = await this.execute(
      9000000,
      EXEC_TRANSACTION,
      client,
      args
    );
    console.log(`- Safe#${EXEC_TRANSACTION}(): result ${result.getBool(0)} \n`);
  };

  //function getSign(bytes memory signatures) external pure returns (uint8, bytes32, bytes32) {

  getSign = async (
    signatures: Uint8Array,
    client: Client = clientsInfo.ecdsaClient
  ) => {
    const args = new ContractFunctionParameters().addBytes(signatures);

    const { result } = await this.execute(9000000, "getSign", client, args);
    console.log(
      `- Safe#getSign(): result ${result.getUint8(0)}  
      ${ethers.utils.hexlify(result.getBytes32(1))} ${ethers.utils.hexlify(
        result.getBytes32(2)
      )}\n`
    );

    console.log(
      `- Safe#splitSign(): result ${result.getUint8(0)}  
      ${JSON.stringify(ethers.utils.splitSignature(signatures))}\n`
    );
  };
}
