// Azure Container Registry (ACR) を作成するモジュール
// - ACR はコンテナイメージのプライベートレジストリです。
// - CI/CD でイメージを push/pull する用途に使います。
@description('Azure Container Registry')
param name string
// リソース作成場所
param location string
// SKU: Basic/Standard/Premium
@allowed(['Basic','Standard','Premium'])
param sku string = 'Basic'
// 管理ユーザー（ユーザ名/パスワード）を有効化するか。通常はサービス主体または managed identity を使用するため false 推奨
param adminUserEnabled bool = false

// ACR リソース本体
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: name
  location: location
  sku: {
    name: sku
  }
  properties: {
    adminUserEnabled: adminUserEnabled
    // パブリック ネットワークアクセスを許可（必要に応じて Private Endpoint に変更可）
    publicNetworkAccess: 'Enabled'
  }
}

// 出力: レジストリの FQDN とリソース ID
output loginServer string = acr.properties.loginServer
output id string = acr.id
