// Log Analytics Workspace を作成するモジュール
// - Container Apps のログを収集するために使用します。
// - retentionInDays でログ保存期間を制御できます。
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

// Log Analytics のキーを取得（sharedKey は機密扱い）
var keys = law.listKeys()

// 出力: workspace の id / customerId / primarySharedKey
output id string = law.id
output customerId string = law.properties.customerId
@secure()
output sharedKey string = keys.primarySharedKey
