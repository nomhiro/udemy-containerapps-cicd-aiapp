// ルートの Orchestration Bicep
// このファイルはモジュールを組み合わせて環境全体（Log Analytics / ACR / Managed Environment / Cosmos / Container Apps）を作成します。
// - azd の `provision` 相当で実行されるエントリポイントです。
// - 各モジュールは下位の modules/*.bicep に分離されています。

@description('Azure location')
param location string = resourceGroup().location

@description('Environment short name (dev/stg/prod)')
param envName string

@description('Frontend container image')
// Provision 時はプレースホルダーイメージを使用し、デプロイ（CI）で実際のイメージに差し替えるワークフローを想定しています。
param frontendImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Backend container image')
param backendImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Cosmos account unique name')
@minLength(3)
@maxLength(44)
// 既定: <envName>cosmos + 4文字サフィックス (uniqueString による決定的短縮) で衝突回避
// uniqueString は英数字 (16進) を返すため Cosmos アカウント命名要件を満たす
// 明示指定したい場合はパラメータ上書き / azd の対話で入力
param cosmosAccountName string = toLower(replace(format('{0}cosmos{1}', envName, substring(uniqueString(resourceGroup().id, envName), 0, 4)),'-',''))

param enableCosmosFreeTier bool = false
param cosmosDatabaseName string = 'TodoApp'
param cosmosContainerName string = 'Todos'
param cosmosPartitionKey string = '/id'

// Container Apps 内のコンテナがリッスンするポート（既定 80）
param frontendPort int = 80
param backendPort int = 80

@description('ACR name. If not provided, deterministic name generated.')
@maxLength(50)
param acrName string = toLower(replace(format('{0}acr{1}', envName, substring(uniqueString(resourceGroup().id, envName, 'acr'), 0, 4)),'-',''))

@description('ACR SKU')
param acrSku string = 'Basic'

// ACR の FQDN
var acrLoginServer = '${toLower(acrName)}.azurecr.io'
// AcrPull roleDefinitionId (built-in role)
var acrPullRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions','7f951dda-4ed3-4680-a7ca-43fe172d538d')

// 指定ContainerImageが既にレジストリ(FQDN)を含む場合はそのまま利用し、含まない場合のみ ACR プレフィックス付与
var backendImageResolved = contains(backendImage, '/') ? backendImage : '${acrLoginServer}/${backendImage}'
var frontendImageResolved = contains(frontendImage, '/') ? frontendImage : '${acrLoginServer}/${frontendImage}'

// Modules の呼び出し（下位モジュールで実際のリソースを定義）
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

// RoleAssignment 用に ACR リソースを参照（existing）
resource acrRef 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
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

// Backend App 作成
module backend './modules/app.bicep' = {
  name: 'backendApp'
  params: {
    name: '${envName}-backend'
    location: location
    environmentId: env.outputs.id
    image: backendImageResolved
    targetPort: backendPort
    registryServer: acrLoginServer
    serviceName: 'backend'
    envName: envName
    envVars: [
      {
        name: 'COSMOS_ENDPOINT'
        value: cosmos.outputs.endpoint
      }
      {
        name: 'COSMOS_KEY'
        secretRef: 'cosmos-key'
      }
      {
        name: 'COSMOS_DATABASE'
        value: cosmosDatabaseName
      }
    ]
    secrets: [
      {
        name: 'cosmos-key'
        value: cosmos.outputs.primaryKey
      }
    ]
  }
}

// Frontend App 作成
module frontend './modules/app.bicep' = {
  name: 'frontendApp'
  params: {
    name: '${envName}-frontend'
    location: location
    environmentId: env.outputs.id
    image: frontendImageResolved
    targetPort: frontendPort
    registryServer: acrLoginServer
    serviceName: 'frontend'
    envName: envName
    // Proxy パターン: クライアントは /api を叩き、Next.js の API routes がサーバ側で backend にフォワードする
    envVars: [
      {
        name: 'NEXT_PUBLIC_API_BASE_URL'
        value: '/api'
      }
      {
        name: 'BACKEND_API_BASE'
        value: 'https://${backend.outputs.fqdn}'
      }
    ]
  }
}

// ACR からイメージを pull するためのロール割当 (Managed Identity に AcrPull を付与)
// 注意: principalId はモジュール出力から参照しています。
resource backendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(subscription().id, acrName, 'backendAcrPull')
  scope: acrRef
  properties: {
    roleDefinitionId: acrPullRoleDefinitionId
    principalId: backend.outputs.principalId
    principalType: 'ServicePrincipal'
  }
}

resource frontendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(subscription().id, acrName, 'frontendAcrPull')
  scope: acrRef
  properties: {
    roleDefinitionId: acrPullRoleDefinitionId
    principalId: frontend.outputs.principalId
    principalType: 'ServicePrincipal'
  }
}

// 出力: 各アプリの URL、Cosmos のエンドポイント、ACR の FQDN
output frontendUrl string = 'https://${frontend.outputs.fqdn}'
output backendUrl string = 'https://${backend.outputs.fqdn}'
output cosmosEndpoint string = cosmos.outputs.endpoint
@secure()
output cosmosPrimaryKey string = cosmos.outputs.primaryKey
output acrLoginServer string = acrLoginServer
