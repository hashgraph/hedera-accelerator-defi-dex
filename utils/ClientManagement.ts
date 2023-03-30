import { AccountId, PrivateKey, Client, Hbar } from "@hashgraph/sdk";

import dotenv from "dotenv";
dotenv.config();

export default class ClientManagement {
  private accountId = AccountId.fromString(process.env.ADMIN_ID!);
  private accountKey = PrivateKey.fromString(process.env.ADMIN_KEY!);

  private treasure = AccountId.fromString(process.env.TREASURE_ID!);
  private treasureKey = PrivateKey.fromString(process.env.TREASURE_KEY!);

  private tokenUserId = AccountId.fromString(process.env.TOKEN_USER_ID!);
  private tokenUserKey = PrivateKey.fromString(process.env.TOKEN_USER_KEY!);

  private uiUserId = AccountId.fromString(process.env.UI_USER_ID!);
  private uiUserKey = PrivateKey.fromString(process.env.UI_USER_KEY!);

  private e2eOperatorId = AccountId.fromString(process.env.E2E_OPERATOR_ID!);
  private e2eOperatorKey = PrivateKey.fromString(process.env.E2E_OPERATOR_KEY!);

  private tokenUserIdNoGODToken = AccountId.fromString(
    process.env.TOKEN_USER_ID_WITH_NO_GOD_TOKEN!
  );

  private tokenUserKeyNoGODToken = PrivateKey.fromString(
    process.env.TOKEN_USER_KEY_WITH_NO_GOD_TOKEN!
  );

  private dexOwnerId = AccountId.fromString(process.env.DEX_CONTRACT_OWNER_ID!);
  private dexOwnerKey = PrivateKey.fromString(
    process.env.DEX_CONTRACT_OWNER_KEY!
  );

  public createUIUserClient = (): Client => {
    return this.doCreateClient(this.uiUserId, this.uiUserKey);
  };

  public createe2eOperatorClient = (): Client => {
    return this.doCreateClient(this.e2eOperatorId, this.e2eOperatorKey);
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

  e2eOperatorClient: Client;
  e2eOperatorId: AccountId;
  e2eOperatorKey: PrivateKey;
}

function initClientsInfo(): ClientsInfo {
  const cm = new ClientManagement();
  const adminClient = cm.createClientAsAdmin();
  const operatorClient = cm.createOperatorClient();
  const treasureClient = cm.createClient();
  const dexOwnerClient = cm.dexOwnerClient();
  const uiUserClient = cm.createUIUserClient();
  const e2eOperatorClient = cm.createe2eOperatorClient();

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

  const e2eOperator = cm.getTreasure();
  const e2eOperatorId = e2eOperator.treasureId;
  const e2eOperatorKey = e2eOperator.treasureKey;

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
    e2eOperatorClient,
    e2eOperatorId,
    e2eOperatorKey,
  };
}

const clientsInfo = initClientsInfo();

export { clientsInfo };
