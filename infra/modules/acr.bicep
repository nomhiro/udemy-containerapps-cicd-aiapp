@description('Azure Container Registry')
param name string
param location string
@allowed(['Basic','Standard','Premium'])
param sku string = 'Basic'
param adminUserEnabled bool = false

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: name
  location: location
  sku: {
    name: sku
  }
  properties: {
    adminUserEnabled: adminUserEnabled
  publicNetworkAccess: 'Enabled'
  }
}

output loginServer string = acr.properties.loginServer
output id string = acr.id
