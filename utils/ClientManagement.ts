import { AccountId, PrivateKey, Client, Hbar } from "@hashgraph/sdk";

import dotenv from "dotenv";
dotenv.config();

export default class ClientManagement {
  private accountId = AccountId.fromString(process.env.PROXY_ADMIN_ID!);
  private accountKey = PrivateKey.fromString(process.env.PROXY_ADMIN_KEY!);

  private treasure = AccountId.fromString(process.env.TREASURE_ID!);
  private treasureKey = PrivateKey.fromString(process.env.TREASURE_KEY!);

  private tokenUserId = AccountId.fromString(process.env.OPERATOR_ID!);
  private tokenUserKey = PrivateKey.fromString(process.env.OPERATOR_KEY!);

  private uiUserId = AccountId.fromString(process.env.UI_USER_ID!);
  private uiUserKey = PrivateKey.fromString(process.env.UI_USER_KEY!);

  private tokenUserIdNoGODToken = AccountId.fromString(
    process.env.OPERATOR_ID_WITH_NO_GOD_TOKEN!
  );

  private tokenUserKeyNoGODToken = PrivateKey.fromString(
    process.env.OPERATOR_KEY_WITH_NO_GOD_TOKEN!
  );

  private dexOwnerId = AccountId.fromString(process.env.CHILD_PROXY_ADMIN_ID!);
  private dexOwnerKey = PrivateKey.fromString(
    process.env.CHILD_PROXY_ADMIN_KEY!
  );

  public createUIUserClient = (): Client => {
    return this.doCreateClient(this.uiUserId, this.uiUserKey);
  };

  public createClientAsAdmin = (): Client => {
    return this.doCreateClient(this.accountId, this.accountKey);
  };

  public createClient = (): Client => {
    return this.doCreateClient(this.treasure, this.treasureKey);
  };

  public createOperatorClient = (): Client => {
    return this.doCreateClient(this.tokenUserId, this.tokenUserKey);
  };

  public createOperatorClientNoGODToken = (): Client => {
    return this.doCreateClient(
      this.tokenUserIdNoGODToken,
      this.tokenUserKeyNoGODToken
    );
  };

  public dexOwnerClient = (): Client => {
    return this.doCreateClient(this.dexOwnerId, this.dexOwnerKey);
  };

  private doCreateClient = (
    accountId: AccountId,
    privateKey: PrivateKey
  ): Client => {
    const client = Client.forTestnet();
    client.setOperator(accountId, privateKey);
    return client;
  };

  public getAdmin = () => {
    return {
      adminId: this.accountId,
      adminKey: this.accountKey,
    };
  };

  public getTreasure = () => {
    return {
      treasureId: this.treasure,
      treasureKey: this.treasureKey,
    };
  };

  public getOperator = () => {
    return {
      id: this.tokenUserId,
      key: this.tokenUserKey,
    };
  };

  public getOperatorNoToken = () => {
    return {
      idNoGODToken: this.tokenUserIdNoGODToken,
      keyNoGODToken: this.tokenUserKeyNoGODToken,
    };
  };

  public getDexOwner = () => {
    return {
      id: this.dexOwnerId,
      key: this.dexOwnerKey,
    };
  };

  public getUIUser = () => {
    return {
      uiUserId: this.uiUserId,
      uiUserKey: this.uiUserKey,
    };
  };
}

interface ClientsInfo {
  dexOwnerClient: Client;
  dexOwnerId: AccountId;
  dexOwnerKey: PrivateKey;

  adminClient: Client;
  adminId: AccountId;
  adminKey: PrivateKey;

  operatorClient: Client;
  operatorId: AccountId;
  operatorKey: PrivateKey;

  treasureClient: Client;
  treasureId: AccountId;
  treasureKey: PrivateKey;

  uiUserClient: Client;
  uiUserId: AccountId;
  uiUserKey: PrivateKey;
}

function initClientsInfo(): ClientsInfo {
  const cm = new ClientManagement();
  const adminClient = cm.createClientAsAdmin();
  const operatorClient = cm.createOperatorClient();
  const treasureClient = cm.createClient();
  const dexOwnerClient = cm.dexOwnerClient();
  const uiUserClient = cm.createUIUserClient();

  const uiUser = cm.getUIUser();
  const uiUserId = uiUser.uiUserId;
  const uiUserKey = uiUser.uiUserKey;

  const dexOwner = cm.getDexOwner();
  const dexOwnerId = dexOwner.id;
  const dexOwnerKey = dexOwner.key;

  const admin = cm.getAdmin();
  const adminId = admin.adminId;
  const adminKey = admin.adminKey;

  const operator = cm.getOperator();
  const operatorId = operator.id;
  const operatorKey = operator.key;

  const treasure = cm.getTreasure();
  const treasureId = treasure.treasureId;
  const treasureKey = treasure.treasureKey;

  return {
    dexOwnerClient,
    dexOwnerId,
    dexOwnerKey,
    adminClient,
    adminId,
    adminKey,
    operatorClient,
    operatorId,
    operatorKey,
    treasureClient,
    treasureId,
    treasureKey,
    uiUserClient,
    uiUserId,
    uiUserKey,
  };
}

const clientsInfo = initClientsInfo();

export { clientsInfo };
