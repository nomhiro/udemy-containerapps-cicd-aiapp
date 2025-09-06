// Modular orchestration for minimal Container Apps + Cosmos DB
@description('Azure location')
param location string = resourceGroup().location
@description('Environment short name (dev/stg/prod)')
param envName string
@description('Frontend container image')
// Placeholder image (provision first, real image applied at deploy step)
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
param frontendPort int = 80
param backendPort int = 80
@description('ACR name. If not provided, deterministic name generated.')
@maxLength(50)
param acrName string = toLower(replace(format('{0}acr{1}', envName, substring(uniqueString(resourceGroup().id, envName, 'acr'), 0, 4)),'-',''))
@description('ACR SKU')
param acrSku string = 'Basic'

var acrLoginServer = '${toLower(acrName)}.azurecr.io'
var acrPullRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions','7f951dda-4ed3-4680-a7ca-43fe172d538d')

// 指定ContainerImageが既にレジストリ(FQDN)を含む場合はそのまま利用し、含まない場合のみ ACR プレフィックス付与
var backendImageResolved = contains(backendImage, '/') ? backendImage : '${acrLoginServer}/${backendImage}'
var frontendImageResolved = contains(frontendImage, '/') ? frontendImage : '${acrLoginServer}/${frontendImage}'

// Modules
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

// Lightweight existing resource reference for role assignment scope (Bicep cannot use module symbol as scope)
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
    // Proxy pattern: client uses /api (Next.js API routes). Server-side API routes forward to backend.
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

// Role assignments (AcrPull) for container app managed identities (only when ACR is used)
// Note: principalId depends on container app deployment; role assignment needs data-plane principal -> use existing outputs OK because apps are same deployment.
// Use deterministic GUID from subscription + acrName + static strings (avoid late-bound principal for name requirement)
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

// Outputs
output frontendUrl string = 'https://${frontend.outputs.fqdn}'
output backendUrl string = 'https://${backend.outputs.fqdn}'
output cosmosEndpoint string = cosmos.outputs.endpoint
@secure()
output cosmosPrimaryKey string = cosmos.outputs.primaryKey
output acrLoginServer string = acrLoginServer
