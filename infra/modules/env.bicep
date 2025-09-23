// Container Apps の Managed Environment を作成するモジュール
// - Managed Environment は Container Apps の実行基盤で、同一環境内のアプリは相互に通信できます。
// - ここでは Log Analytics へのログ出力を設定しています（customerId / sharedKey を受け取る）。
@description('Container Apps managed environment')
param name string
param location string
// Log Analytics ワークスペースの customerId（workspace モジュールの出力を渡す）
param logCustomerId string
@secure()
// Log Analytics の shared key（機密）
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

// 出力: managed environment のリソース ID
output id string = env.id
