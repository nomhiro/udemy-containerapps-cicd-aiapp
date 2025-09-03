@description('Generic Container App')
param name string
param location string
param environmentId string
param image string
param targetPort int
param external bool = true
@allowed(['Single','Multiple'])
param revisionsMode string = 'Single'
param envVars array = [] // [{ name: '', value: '' } | { name:'', secretRef:'' }]
param secrets array = [] // [{ name:'', value:'' }]
param minReplicas int = 0
param maxReplicas int = 1
@description('HTTP concurrent requests threshold (string)')
param httpConcurrent string = '50'
@description('Enable system-assigned managed identity for image pull & future RBAC')
param enableIdentity bool = true
@description('ACR login server (for registryCredentials)')
param registryServer string = ''
@description('Identity resource id or empty if system-assigned')
param userIdentityResourceId string = ''
@description('Use managed identity for image pull (true) or anonymous/public (false)')
param useManagedIdentityPull bool = true

// azd tagging support
@description('Logical azd service name (matches azure.yaml services key)')
param serviceName string
@description('azd environment name for tagging (envName param from root)')
param envName string

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  tags: {
    'azd-service-name': serviceName
    'azd-env-name': envName
  }
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      ingress: {
        external: external
        targetPort: targetPort
        transport: 'auto'
      }
      secrets: secrets
      activeRevisionsMode: revisionsMode
      registries: length(registryServer) > 0 ? [
        {
          server: registryServer
          identity: useManagedIdentityPull ? (empty(userIdentityResourceId) ? 'system' : userIdentityResourceId) : null
        }
      ] : []
    }
    template: {
      containers: [
        {
          name: name
          image: image
          env: envVars
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http'
            http: {
              metadata: {
                concurrentRequests: httpConcurrent
              }
            }
          }
        ]
      }
    }
  }
  identity: enableIdentity ? {
    type: 'SystemAssigned'
  } : null
}

output fqdn string = app.properties.configuration.ingress.fqdn
output id string = app.id
output principalId string = enableIdentity ? app.identity.principalId : ''
output clientId string = enableIdentity ? app.identity.tenantId : ''
