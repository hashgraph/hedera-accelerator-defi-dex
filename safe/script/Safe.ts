import Base from "../../e2e-test/business/Base";
import { clientsInfo } from "../../utils/ClientManagement";
import { Client, ContractFunctionParameters } from "@hashgraph/sdk";
import { BigNumber } from "bignumber.js";
import { Address } from "cluster";
import Web3 from "web3";

const GET_CHAIN_ID = "getChainId";
const SETUP = "setup";
const EXEC_TRANSACTION = "execTransaction";

export default class Safe extends Base {
  getChainId = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(
      9000000,
      GET_CHAIN_ID,
      client,
      undefined
    );
    const chainId = result.getUint256(0);
    console.log(`- Factory#${GET_CHAIN_ID}(): ${chainId}\n`);
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
    console.log(`- Factory#${SETUP}(): Done\n`);
  };

  /// @dev Allows to execute a Safe transaction confirmed by required number of owners and then pays the account that submitted the transaction.
  ///      Note: The fees are always transferred, even if the user transaction fails.
  /// @param to Destination address of Safe transaction.
  /// @param value Ether value of Safe transaction.
  /// @param data Data payload of Safe transaction.
  /// @param operation Operation type of Safe transaction.
  /// @param safeTxGas Gas that should be used for the Safe transaction.
  /// @param baseGas Gas costs that are independent of the transaction execution(e.g. base transaction fee, signature check, payment of the refund)
  /// @param gasPrice Gas price that should be used for the payment calculation.
  /// @param gasToken Token address (or 0 if ETH) that is used for the payment.
  /// @param refundReceiver Address of receiver of gas payment (or 0 if tx.origin).
  /// @param signatures Packed signature data ({bytes32 r}{bytes32 s}{uint8 v})

  execTransaction = async (
    to: string,
    value: BigNumber,
    data: Uint8Array,
    operation: number,
    safeTxGas: BigNumber,
    baseGas: BigNumber,
    gasPrice: BigNumber,
    gasToken: string,
    refundReceiverAddress: string,
    signatures: Uint8Array,
    client: Client = clientsInfo.adminClient
  ) => {
    const web3 = new Web3();
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
    console.log(`- Factory#${EXEC_TRANSACTION}():`);
    console.log(`- Response length = ${result.asBytes().length}`);
    console.log(
      `- Response hex = ${web3.utils.bytesToHex(Array.from(result.asBytes()))}`
    );
  };
}
