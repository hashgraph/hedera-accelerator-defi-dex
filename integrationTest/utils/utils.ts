import {
  AccountId,
  PrivateKey,
  Client,
} from "@hashgraph/sdk";

export default class ClientManagement {
    private accountId = AccountId.fromString("0.0.47710057");
    private accountKey = PrivateKey.fromString("3030020100300706052b8104000a04220420d38b0ed5f11f8985cd72c8e52c206b512541c6f301ddc9d18bd8b8b25a41a80f");

    private treasure = AccountId.fromString("0.0.47645191");
    private treasureKey = PrivateKey.fromString("308ed38983d9d20216d00371e174fe2d475dd32ac1450ffe2edfaab782b32fc5");

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