// ---------------------------------------------------------------------------
// Cosmos DB モジュール
// これは Cosmos DB のアカウント（serverless）、データベース、コンテナーを作成する Bicep モジュールです。
// - account: Cosmos DB アカウント (Serverless を有効化)
// - db: SQL データベース
// - container: データ格納用のコンテナー（パーティションキーを指定）
//
// パラメータは module 呼び出し元から渡してください。モジュール単独でデプロイ可能です。
// ---------------------------------------------------------------------------
@description('Cosmos DB serverless (account + DB + container)')
// Cosmos アカウント名（モジュール外で一意に決める）
param accountName string
// リソース作成場所（例: japaneast 等）
param location string
// FreeTier を有効にするか（既定 false）
param enableFreeTier bool = false
// 作成する SQL データベース名
param databaseName string
// 作成するコンテナー名
param containerName string
// コンテナーのパーティションキー（デフォルト '/id'）。アプリのアクセスパターンに合わせて変更してください。
param partitionKey string = '/id'

// Cosmos DB アカウントの作成
// - Serverless を有効化するために 'EnableServerless' capability を設定しています。
// - enableFreeTier が true の場合、Free Tier を試用できます（利用条件あり）。
resource account 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: accountName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    // SKU 相当の指定
    databaseAccountOfferType: 'Standard'
    enableFreeTier: enableFreeTier
    // 単一リージョン構成（必要に応じて複数リージョンを渡す）
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    // 一貫性レベルは Session を採用（アプリ要件に応じて変更可能）
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    capabilities: [
      // Serverless モードを使うためのフラグ
      { name: 'EnableServerless' }
    ]
    // パブリックアクセスを許可（セキュリティ要件により変更可能）
    publicNetworkAccess: 'Enabled'
  }
}

// SQL データベースを作成（Cosmos アカウントの配下）
resource db 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  name: databaseName
  parent: account
  properties: {
    resource: { id: databaseName }
  }
}

// コンテナー（コレクション）を作成
// - partitionKey でデータのパーティショニングを定義します。適切なパスを選んでください。
// - defaultTtl: -1 は TTL 無効（必要に応じて秒数を指定して有効化できます）
resource container 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  name: containerName
  parent: db
  properties: {
    resource: {
      id: containerName
      partitionKey: {
        paths: [ partitionKey ]
        kind: 'Hash'
        version: 2
      }
      defaultTtl: -1
    }
  }
}

// アカウントのキーを取得（デプロイ時にキーを出力してアプリ側で使用可能にします）
// 注意: 出力されたキーは機密情報なので、呼び出し元で secure() を使用するなど扱いに注意してください。
var keys = account.listKeys()

// エンドポイントなどを出力
// - endpoint: Cosmos の接続エンドポイント URL
// - primaryKey: マスターキー（secure 出力推奨）
// - database / containerOut: 作成した DB / コンテナー名の確認用出力
output endpoint string = account.properties.documentEndpoint
@secure()
output primaryKey string = keys.primaryMasterKey
output database string = databaseName
output containerOut string = containerName
