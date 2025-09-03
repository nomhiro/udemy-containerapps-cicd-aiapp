@description('Cosmos DB serverless (account + DB + container)')
param accountName string
param location string
param enableFreeTier bool = false
param databaseName string
param containerName string
param partitionKey string = '/id'

resource account 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: accountName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableFreeTier: enableFreeTier
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    capabilities: [
      { name: 'EnableServerless' }
    ]
    publicNetworkAccess: 'Enabled'
  }
}

resource db 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  name: databaseName
  parent: account
  properties: {
    resource: { id: databaseName }
  }
}

resource container 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  name: containerName
  parent: db
  properties: {
    resource: {
      id: containerName
      partitionKey: {
        paths: [ partitionKey ]
        kind: 'Hash'
        version: 2
      }
      defaultTtl: -1
    }
  }
}

var keys = account.listKeys()

output endpoint string = account.properties.documentEndpoint
@secure()
output primaryKey string = keys.primaryMasterKey
output database string = databaseName
output containerOut string = containerName
