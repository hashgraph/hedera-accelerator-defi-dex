import {
  AccountId,
  PrivateKey,
  Client,
} from "@hashgraph/sdk";
import dotenv from "dotenv";

dotenv.config();

export default class ClientManagement {
    private accountId = AccountId.fromString(process.env.ADMIN_ID!);
    private accountKey = PrivateKey.fromString(process.env.ADMIN_KEY!);

    private treasure = AccountId.fromString(process.env.TREASURE_ID!);
    private treasureKey = PrivateKey.fromString(process.env.TREASURE_KEY!);

    public createClientAsAdmin = (): Client => { 
        return this.doCreateClient(this.accountId, this.accountKey);
    };
    
    public createClient = (): Client => {
        return this.doCreateClient(this.treasure, this.treasureKey);
    };
    
    private doCreateClient = (accountId: AccountId, privateKey: PrivateKey): Client => {
        const client = Client.forTestnet();
        client.setOperator(accountId, privateKey);
        return client;
    }

    public getAdmin = () =>  {
        return {
            adminId: this.accountId,
            adminKey: this.accountKey
        }
    }

    public getTreasure = () =>  {
        return {
            treasureId: this.treasure,
            treasureKey: this.treasureKey
        }
    }
}