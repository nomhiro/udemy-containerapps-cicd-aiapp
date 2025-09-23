// 汎用 Container App モジュール
// このモジュールは Azure Container Apps のアプリケーション（フロント/バックエンド）を作成します。
// - image, targetPort, 環境変数、シークレットなどをパラメータ化して呼び出し側から渡します。
// - ACR からのイメージプルは system-assigned managed identity を使う設定が可能です。
@description('Generic Container App')
param name string
param location string
// Container Apps の managed environment ID（env モジュールの出力を渡す）
param environmentId string
// コンテナイメージ（完全 FQDN または repository 名）
param image string
// アプリ内部でリッスンするポート（Container Apps の targetPort に紐づく）
param targetPort int
// インターネットに公開するかどうか
param external bool = true
// リビジョンのモード（Single or Multiple）
@allowed(['Single','Multiple'])
param revisionsMode string = 'Single'
// 環境変数配列。値または secretRef を渡せます。
param envVars array = [] // [{ name: '', value: '' } | { name:'', secretRef:'' }]
// シークレット配列（name/value）
param secrets array = [] // [{ name:'', value:'' }]
// スケール設定
param minReplicas int = 0
param maxReplicas int = 1
@description('HTTP concurrent requests threshold (string)')
param httpConcurrent string = '50'
// イメージプル用の managed identity を有効にするか
@description('Enable system-assigned managed identity for image pull & future RBAC')
param enableIdentity bool = true
@description('ACR login server (for registryCredentials)')
param registryServer string = ''
@description('Identity resource id or empty if system-assigned')
param userIdentityResourceId string = ''
@description('Use managed identity for image pull (true) or anonymous/public (false)')
param useManagedIdentityPull bool = true

// azd タグ付けサポート
@description('Logical azd service name (matches azure.yaml services key)')
param serviceName string
@description('azd environment name for tagging (envName param from root)')
param envName string

// Container App リソースの定義
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
      // registries: ACR の指定がある場合、registryServer と managed identity を構成
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
  // identity: システム割り当ての managed identity を有効化（イメージプルや RBAC 用）
  identity: enableIdentity ? {
    type: 'SystemAssigned'
  } : null
}

// 出力: FQDN / リソース ID / principalId 等
output fqdn string = app.properties.configuration.ingress.fqdn
output id string = app.id
output principalId string = enableIdentity ? app.identity.principalId : ''
output clientId string = enableIdentity ? app.identity.tenantId : ''
