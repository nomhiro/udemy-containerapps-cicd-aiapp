@description('Container Apps managed environment')
param name string
param location string
param logCustomerId string
@secure()
param logSharedKey string

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: name
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logCustomerId
        sharedKey: logSharedKey
      }
    }
  }
}

output id string = env.id
