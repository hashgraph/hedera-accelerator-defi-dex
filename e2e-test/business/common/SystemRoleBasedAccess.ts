import Base from "../Base";
import dex from "../../../deployment/model/dex";

import { clientsInfo } from "../../../utils/ClientManagement";
import { ContractService } from "../../../deployment/service/ContractService";
import { Client, AccountId } from "@hashgraph/sdk";

const INITIALIZE = "initialize";

export default class SystemRoleBasedAccess extends Base {
  protected getContractName(): string {
    return ContractService.SYSTEM_ROLE_BASED_ACCESS;
  }

  public initialize = async (client: Client = clientsInfo.operatorClient) => {
    if (await this.isInitializationPending()) {
      const data = {
        _systemUsers: this.getSystemUsersAddressArray(),
      };
      const { bytes, hex } = await this.encodeFunctionData(
        this.getContractName(),
        INITIALIZE,
        Object.values(data)
      );
      await this.execute(2_00_000, INITIALIZE, client, bytes);
      console.log(
        `- SystemRoleBasedAccess#${INITIALIZE}(): done with hex-data = ${hex}\n`
      );
      return;
    }
    console.log(`- SystemRoleBasedAccess#${INITIALIZE}(): already done\n`);
  };

  public async checkIfChildProxyAdminRoleGiven(
    accountId: AccountId = clientsInfo.childProxyAdminId
  ) {
    await this.getRoleAdmin(dex.ROLES.CHILD_PROXY_ADMIN_ROLE);
    return await this.hasRole(dex.ROLES.CHILD_PROXY_ADMIN_ROLE, accountId);
  }

  private getSystemUsersAddressArray() {
    return Object.values({
      superAdmin: clientsInfo.operatorId.toSolidityAddress(),
      proxyAdmin: clientsInfo.proxyAdminId.toSolidityAddress(),
      childProxyAdmin: clientsInfo.childProxyAdminId.toSolidityAddress(),
    });
  }
}
