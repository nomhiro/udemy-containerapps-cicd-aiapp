@description('Log Analytics workspace for minimal monitoring')
param name string
param location string
param retentionInDays int = 30

resource law 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: name
  location: location
  properties: {
    retentionInDays: retentionInDays
  }
}

var keys = law.listKeys()

output id string = law.id
output customerId string = law.properties.customerId
@secure()
output sharedKey string = keys.primarySharedKey
