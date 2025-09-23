// ルート Orchestration Bicep
//   具体的には Log Analytics Workspace / Azure Container Registry /
//   Container Apps の Managed Environment / Cosmos DB をプロビジョンします。
//   Container Apps 本体（個々のアプリ）の作成は行いません。

@description('Azure location')
param location string = resourceGroup().location

@description('Environment short name (dev/stg/prod)')
param envName string

@description('Cosmos account unique name')
@minLength(3)
@maxLength(44)
// 既定: <envName>cosmos + 4文字サフィックス (uniqueString による短縮)
param cosmosAccountName string = toLower(replace(format('{0}cosmos{1}', envName, substring(uniqueString(resourceGroup().id, envName), 0, 4)),'-',''))

@description('Enable Cosmos Free Tier')
param enableCosmosFreeTier bool = false
param cosmosDatabaseName string = 'TodoApp'
param cosmosContainerName string = 'Todos'
param cosmosPartitionKey string = '/id'

@description('ACR name. If not provided, deterministic name generated.')
@maxLength(50)
param acrName string = toLower(replace(format('{0}acr{1}', envName, substring(uniqueString(resourceGroup().id, envName, 'acr'), 0, 4)),'-',''))
@description('ACR SKU')
param acrSku string = 'Basic'

// ACR の FQDN
var acrLoginServer = '${toLower(acrName)}.azurecr.io'

// --- モジュール呼び出し ---
module workspace './modules/workspace.bicep' = {
  name: 'workspace'
  params: {
    name: '${envName}-law'
    location: location
  }
}

module acr './modules/acr.bicep' = {
  name: 'acr'
  params: {
    name: acrName
    location: location
    sku: acrSku
  }
}

module env './modules/env.bicep' = {
  name: 'env'
  params: {
    name: '${envName}-cae'
    location: location
    logCustomerId: workspace.outputs.customerId
    logSharedKey: workspace.outputs.sharedKey
  }
}

module cosmos './modules/cosmos.bicep' = {
  name: 'cosmos'
  params: {
    accountName: cosmosAccountName
    location: location
    enableFreeTier: enableCosmosFreeTier
    databaseName: cosmosDatabaseName
    containerName: cosmosContainerName
    partitionKey: cosmosPartitionKey
  }
}

// --- 出力 ---
output cosmosEndpoint string = cosmos.outputs.endpoint
@secure()
output cosmosPrimaryKey string = cosmos.outputs.primaryKey
output acrLoginServer string = acrLoginServer
output environmentId string = env.outputs.id

