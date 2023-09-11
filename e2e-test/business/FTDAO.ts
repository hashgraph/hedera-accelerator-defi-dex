import dex from "../../deployment/model/dex";
import BaseDao from "./BaseDao";
import GodHolder from "./GodHolder";
import NFTHolder from "./NFTHolder";

import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { AddressHelper } from "../../utils/AddressHelper";
import { Client, TokenId } from "@hashgraph/sdk";

const INITIALIZE = "initialize";
const GET_GOVERNOR_TOKEN_TRANSFER_CONTRACT_ADDRESSES =
  "getGovernorContractAddresses";

export const DEFAULT_DESCRIPTION = "description";
export const DEFAULT_LINK = "https://defi-ui.hedera.com/governance";
export const DEFAULT_QUORUM_THRESHOLD_IN_BSP = 500;
export const DEFAULT_VOTING_DELAY = 0; // blocks
export const DEFAULT_VOTING_PERIOD = 100; // blocks means 3 minutes as per test
export const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
export const NFT_TOKEN_ID = dex.NFT_TOKEN_ID;
export const DEFAULT_NFT_TOKEN_SERIAL_ID = 19;

export default class FTDAO extends BaseDao {
  public async initialize(
    admin: string,
    name: string,
    url: string,
    desc: string,
    webLinks: string[],
    tokenHolder: GodHolder | NFTHolder,
    client: Client = clientsInfo.operatorClient,
    defaultQuorumThresholdValue: number = DEFAULT_QUORUM_THRESHOLD_IN_BSP,
    votingDelay: number = DEFAULT_VOTING_DELAY,
    votingPeriod: number = DEFAULT_VOTING_PERIOD,
    tokenId: TokenId = GOD_TOKEN_ID,
    holderTokenId: TokenId = GOD_TOKEN_ID,
  ) {
    await tokenHolder.initialize(client, holderTokenId.toSolidityAddress());
    if (await this.isInitializationPending()) {
      const godHolderProxyAddress = await AddressHelper.idToEvmAddress(
        tokenHolder.contractId,
      );
      const contractService = new ContractService();
      const data = {
        inputs: Object.values({
          admin,
          name,
          url,
          tokenAddress: tokenId.toSolidityAddress(),
          quorumThreshold: defaultQuorumThresholdValue,
          votingDelay,
          votingPeriod,
          isPrivate: false,
          description: desc,
          webLinks,
        }),
        governor: Object.values({
          tokenTransferLogic: contractService.getContract(
            ContractService.GOVERNOR_TT,
          ).address,
          textLogic: contractService.getContract(ContractService.GOVERNOR_TEXT)
            .address,
          contractUpgradeLogic: contractService.getContract(
            ContractService.GOVERNOR_UPGRADE,
          ).address,
          createTokenLogic: contractService.getContract(
            ContractService.GOVERNOR_TOKEN_CREATE,
          ).address,
        }),
        common: Object.values({
          hederaService: this.htsAddress,
          iTokenHolder: godHolderProxyAddress,
        }),
        _iSystemRoleBasedAccess: this.getSystemBasedRoleAccessContractAddress(),
      };

      const { hex, bytes } = await this.encodeFunctionData(
        ContractService.FT_DAO,
        INITIALIZE,
        Object.values(data),
      );

      const { receipt } = await this.execute(
        70_00_000,
        INITIALIZE,
        client,
        bytes,
      );

      console.log(
        `- FTDAO#${INITIALIZE}(): hex-data = ${hex}, status = ${receipt.status}\n`,
      );
      return;
    }
    console.log(`- FTDAO#${INITIALIZE}(): already done\n`);
  }

  protected getContractName() {
    return ContractService.FT_DAO;
  }

  public getGovernorTokenTransferContractAddresses = async (
    client: Client = clientsInfo.operatorClient,
  ) => {
    const { result } = await this.execute(
      2_000_000,
      GET_GOVERNOR_TOKEN_TRANSFER_CONTRACT_ADDRESSES,
      client,
    );
    const addresses = {
      governorTokenTransferProxy: result.getAddress(0),
      governorTextProposalProxy: result.getAddress(1),
      governorUpgradeProxy: result.getAddress(2),
      governorTokenCreateProxy: result.getAddress(3),
      governorTokenTransferProxyId: await AddressHelper.addressToIdObject(
        result.getAddress(0),
      ),
      governorTextProposalProxyId: await AddressHelper.addressToIdObject(
        result.getAddress(1),
      ),
      governorUpgradeProxyId: await AddressHelper.addressToIdObject(
        result.getAddress(2),
      ),
      governorTokenCreateProxyId: await AddressHelper.addressToIdObject(
        result.getAddress(3),
      ),
    };
    console.table({
      ...addresses,
      governorTokenTransferProxyId:
        addresses.governorTokenTransferProxyId.toString(),
      governorTextProposalProxyId:
        addresses.governorTextProposalProxyId.toString(),
      governorUpgradeProxyId: addresses.governorUpgradeProxyId.toString(),
      governorTokenCreateProxyId:
        addresses.governorTokenCreateProxyId.toString(),
    });
    return addresses;
  };
}
