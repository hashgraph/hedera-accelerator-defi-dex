import { Client, AccountId, PrivateKey } from "@hashgraph/sdk";

import dotenv from "dotenv";
dotenv.config();

interface ClientsInfo {
  childProxyAdminId: AccountId;
  childProxyAdminKey: PrivateKey;
  childProxyAdminClient: Client;

  proxyAdminId: AccountId;
  proxyAdminKey: PrivateKey;
  proxyAdminClient: Client;

  operatorId: AccountId;
  operatorKey: PrivateKey;
  operatorClient: Client;

  treasureId: AccountId;
  treasureKey: PrivateKey;
  treasureClient: Client;

  operatorIdNoGODToken: AccountId;
  operatorKeyNoGODToken: PrivateKey;
  operatorIdNoGODTokenClient: Client;

  uiUserId: AccountId;
  uiUserKey: PrivateKey;
  uiUserClient: Client;
}

function initClientsInfo(): ClientsInfo {
  const _createClient = (id: AccountId, key: PrivateKey) => {
    return Client.forTestnet().setOperator(id, key);
  };

  const proxyAdminId = AccountId.fromString(process.env.PROXY_ADMIN_ID!);
  const proxyAdminKey = PrivateKey.fromString(process.env.PROXY_ADMIN_KEY!);

  const treasureId = AccountId.fromString(process.env.TREASURE_ID!);
  const treasureKey = PrivateKey.fromString(process.env.TREASURE_KEY!);

  const operatorId = AccountId.fromString(process.env.OPERATOR_ID!);
  const operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY!);

  const uiUserId = AccountId.fromString(process.env.UI_USER_ID!);
  const uiUserKey = PrivateKey.fromString(process.env.UI_USER_KEY!);

  const operatorIdNoGODToken = AccountId.fromString(
    process.env.OPERATOR_ID_WITH_NO_GOD_TOKEN!,
  );

  const operatorKeyNoGODToken = PrivateKey.fromString(
    process.env.OPERATOR_KEY_WITH_NO_GOD_TOKEN!,
  );

  const childProxyAdminId = AccountId.fromString(
    process.env.CHILD_PROXY_ADMIN_ID!,
  );

  const childProxyAdminKey = PrivateKey.fromString(
    process.env.CHILD_PROXY_ADMIN_KEY!,
  );

  return {
    proxyAdminId,
    proxyAdminKey,
    proxyAdminClient: _createClient(proxyAdminId, proxyAdminKey),

    treasureId,
    treasureKey,
    treasureClient: _createClient(treasureId, treasureKey),

    operatorId,
    operatorKey,
    operatorClient: _createClient(operatorId, operatorKey),

    uiUserId,
    uiUserKey,
    uiUserClient: _createClient(uiUserId, uiUserKey),

    operatorIdNoGODToken,
    operatorKeyNoGODToken,
    operatorIdNoGODTokenClient: _createClient(
      operatorIdNoGODToken,
      operatorKeyNoGODToken,
    ),

    childProxyAdminId,
    childProxyAdminKey,
    childProxyAdminClient: _createClient(childProxyAdminId, childProxyAdminKey),
  };
}

const clientsInfo = initClientsInfo();
export { clientsInfo };
