import { AccountId, PrivateKey, Client } from "@hashgraph/sdk";
import dotenv from "dotenv";

dotenv.config();

export default class ClientManagement {
    private accountId = AccountId.fromString(process.env.ADMIN_ID!);
    private accountKey = PrivateKey.fromString(process.env.ADMIN_KEY!);

    private treasure = AccountId.fromString(process.env.TREASURE_ID!);
    private treasureKey = PrivateKey.fromString(process.env.TREASURE_KEY!);

    private tokenUserId = AccountId.fromString(process.env.TOKEN_USER_ID!);
    private tokenUserKey = PrivateKey.fromString(process.env.TOKEN_USER_KEY!);

    private dexOwnerId = AccountId.fromString(process.env.DEX_CONTRACT_OWNER_ID!);
    private dexOwnerKey = PrivateKey.fromString(process.env.DEX_CONTRACT_OWNER_KEY!);

    public createClientAsAdmin = (): Client => {
        return this.doCreateClient(this.accountId, this.accountKey);
    };

    public createClient = (): Client => {
        return this.doCreateClient(this.treasure, this.treasureKey);
    };

    public createOperatorClient = (): Client => {
        return this.doCreateClient(this.tokenUserId, this.tokenUserKey);
    };

    public dexOwnerClient = (): Client => {
        return this.doCreateClient(this.dexOwnerId, this.dexOwnerKey);
    };

    private doCreateClient = (accountId: AccountId, privateKey: PrivateKey): Client => {
        const client = Client.forTestnet();
        client.setOperator(accountId, privateKey);
        return client;
    }

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

    public getTokenUser = () => {
        return {
            tokenUserId: this.tokenUserId,
            tokenUserKey: this.tokenUserKey,
        };
    };

    public getOperator = () => {
        return {
            id: this.tokenUserId,
            key: this.tokenUserKey,
        };
    };

    public getDexOwner = () => {
        return {
            id: this.dexOwnerId,
            key: this.dexOwnerKey
        }
    }
}
