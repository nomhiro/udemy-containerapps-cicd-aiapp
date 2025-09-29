# Azure Container Apps TODO管理アプリ

クラウドネイティブ開発を学習するための実践的なTODO管理アプリケーションです。フロントエンドとバックエンドを分離したマイクロサービスアーキテクチャを採用し、Azure Container Appsでホストします。

## アーキテクチャ概要
主要コンポーネントとデータフローを Mermaid 図で示します。

### 基本コンポーネント構成
```mermaid
flowchart LR
  user([利用者<br/>Browser]) -->|HTTPS| fe[Frontend<br/>Next.js]
  fe -->|REST API| be[Backend API<br/>FastAPI]
  be --> cosmos[(Azure Cosmos DB)]
  be --> appins[(Application Insights)]
  be --> kv[(Azure Key Vault)]
  subgraph Azure Container Apps Environment
    fe
    be
  end
  registry[(Azure Container Registry)] --> deploy[Container Apps デプロイ]
  deploy --> fe
  deploy --> be
```

### コンテナビルド / デプロイ CI/CD パイプライン
```mermaid
graph TD
  dev[Developer Push] --> gh[GitHub Actions]
  gh --> lint[Lint/Type Check]
  gh --> test[Unit / Integration Tests]
  test --> build[Build & Push Image]
  lint --> build
  build --> acr[(ACR)]
  acr --> release[az containerapp update]
  release --> canary{Blue/Green ?}
  canary -->|Blue 90%| appBlue[App v1]
  canary -->|Green 10%| appGreen[App v2]
  appBlue --> ai[(App Insights)]
  appGreen --> ai
```

### スケーリング（リクエスト/メトリクスベース）
```mermaid
flowchart LR
  metric[HTTP QPS / CPU / Custom Metrics] --> scaler[KEDA Scaler]
  scaler --> replicas{Replica Count}
  replicas --> beReplica[Backend Pods]
  beReplica --> cosmos[(Cosmos DB)]
```

### データモデル（概要）
```mermaid
classDiagram
  class Todo {
    string id
    string title
    string? description
    Priority priority
    datetime dueDate
    string[] tags
    bool completed
    datetime createdAt
    datetime updatedAt
  }
  class StatsResponse {
    int total
    int completed
    int overdue
    map<Priority,int> byPriority
  }
  Todo <.. StatsResponse : 集計対象
```

> Blue/Green デプロイ時は `trafficWeights` を利用して段階的に新バージョン (Green) へトラフィックを移行します。

## 機能一覧

- **タスク管理**: CRUD操作（作成・読込・更新・削除）
- **優先度管理**: 4段階の優先度設定（低・中・高・緊急）
- **期限管理**: 期限設定と期限切れアラート
- **タグ機能**: カテゴリ分類とフィルタリング
- **検索・フィルタ**: 条件に基づくタスク検索
- **統計表示**: 完了率とタスク統計の可視化
- **レスポンシブUI**: デスクトップ・タブレット・モバイル対応

## 技術スタック

### フロントエンド
- **Next.js 15+**: Reactベースのフレームワーク (SSR / SSG / ISR)
- **TypeScript**: 型安全な開発
- **React 18+**: UIライブラリ
- **SWR**: クライアントデータフェッチ & キャッシュ
- **Axios**: APIクライアント
- **Tailwind CSS** (任意): スタイリング
- **Node.js 20+ / npm**: 実行・パッケージ管理

### バックエンド
- **FastAPI**: 高性能Python Webフレームワーク
- **Pydantic**: データバリデーション・シリアライゼーション
- **Azure Cosmos SDK**: Cosmos DBクライアント
- **Uvicorn**: ASGIサーバー

### データベース
- **Azure Cosmos DB**: NoSQLデータベース（Serverlessモード）
-- **パーティション戦略**: 単一パーティション (userId 廃止)

### インフラ・DevOps
- **Azure Container Apps**: サーバーレスコンテナプラットフォーム
- **Azure Container Registry**: コンテナイメージリポジトリ
- **GitHub Actions**: CI/CDパイプライン
- **Application Insights**: アプリケーション監視

## プロジェクト構成

```
todo-app/
├── frontend/                    # Next.js フロントエンド
│   ├── src/
│   │   ├── app/                # App Router (または pages/)
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/         # 再利用 UIコンポーネント
│   │   ├── lib/                # APIクライアント・ユーティリティ
│   │   ├── hooks/              # カスタムフック
│   │   ├── types/              # 型定義 (Todo, APIレスポンス)
│   │   └── styles/             # グローバル/モジュールCSS
│   ├── public/                 # 画像・静的アセット
│   ├── next.config.mjs         # Next.js 設定
│   ├── package.json            # 依存関係
│   ├── tsconfig.json           # TypeScript設定
│   ├── tailwind.config.js      # Tailwind設定 (使用時)
│   ├── postcss.config.js       # PostCSS設定
│   ├── .env.example            # 環境変数サンプル
│   └── Dockerfile              # コンテナ設定
├── backend/                    # FastAPI バックエンド
│   ├── src/
│   │   ├── main.py                 # ルーティング/アプリ (例外ハンドラ含む)
│   │   ├── domain/
│   │   │   ├── models/todo.py      # ドメイン Todo モデル
│   │   │   └── repositories/todo_repository.py
│   │   ├── application/services/todo_service.py
│   │   └── infrastructure/repositories/
│   │       ├── in_memory_todo_repository.py
│   │       └── cosmos_todo_repository.py (簡易)
│   ├── tests/
│   │   ├── test_health.py
│   │   ├── test_todos.py
│   │   ├── test_conflict.py
│   │   ├── test_validation.py
│   │   └── test_cosmos_repo.py
│   ├── requirements.txt
│   └── Dockerfile
├── infra/                     # インフラストラクチャ
│   ├── bicep/                # Bicepテンプレート
│   │   ├── main.bicep
│   │   ├── container-apps.bicep
│   │   └── cosmos-db.bicep
│   └── scripts/              # デプロイメントスクリプト
│       ├── deploy.sh
│       └── blue-green-deploy.sh
├── .github/                  # GitHub Actions
│   └── workflows/
│       ├── ci.yml           # 継続的インテグレーション
│       ├── cd.yml           # 継続的デプロイメント
│       └── monitoring.yml   # 監視設定自動化
├── docs/                    # ドキュメント
│   ├── ARCHITECTURE.md      # アーキテクチャ詳細
│   ├── DEVELOPMENT.md       # 開発ガイド
│   └── DEPLOYMENT.md        # デプロイメントガイド
├── docker-compose.yml       # ローカル開発環境
├── .gitignore
└── README.md               # このファイル
```

フロントエンド詳細設計/要件: `frontend/README.md` を参照。

## 開発環境セットアップ

### 前提条件

- Node.js 20以上 (Frontend)
- Python 3.12以上 (Backend)
- Docker Desktop
- Azure CLI 2.56以上
- Git

### ローカル開発環境構築

1. **リポジトリのクローン**
```bash
git clone https://github.com/yourusername/azure-container-apps-todo.git
cd azure-container-apps-todo
```

2. **依存関係インストール**
```bash
# バックエンド (FastAPI)
cd backend
python -m venv venv
# Windows PowerShell
venv\\Scripts\\Activate.ps1
pip install -r requirements.txt

# フロントエンド (Next.js)
cd frontend
npm install   # または: npm ci (lockfile ありの場合)
```

3. **環境変数の設定**
```bash
# backend/.env
COSMOS_CONNECTION_STRING="COSMOSDBの接続文字列"
COSMOS_DATABASE="TodoApp"
COSMOS_CONTAINER="Todos"
COSMOS_PARTITION_KEY="/id"
LOG_LEVEL="INFO"

# frontend/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

4. **ローカル実行**
```bash
# バックエンド起動 (Hot Reload)
cd backend
uvicorn src.main:app --reload --port 8000

# フロントエンド起動 (Next.js Dev Server)
cd frontend
npm run dev -- --port 3000
```

5. **動作確認**
- フロントエンド: http://localhost:3000
- バックエンドAPI: http://localhost:8000
- API ドキュメント: http://localhost:8000/docs

### Docker Compose による開発環境

```bash
# 全サービス起動
docker-compose up --build

# バックグラウンド実行
docker-compose up -d

# ログ確認
docker-compose logs -f

# 停止・クリーンアップ
docker-compose down -v
```

## ローカル動作確認詳細ガイド（コンテナ未使用 / Docker Compose）

ホスト実行 (Python / Node を直接起動) と Docker Compose の2通りを選択できます。高速なコード検証はホスト、コンテナ間通信や本番に近い挙動検証は Compose を利用してください。

### 環境変数ファイル整理

| 用途 | パス | 例 | 備考 |
|------|------|----|------|
| Backend (ホスト) | `backend/.env` | COSMOS_DISABLE=1 | `python-dotenv` が自動読込 |
| Backend (Compose) | `backend/.env.container` | COSMOS_CONNECTION_STRING=... | `docker-compose.yml` の `env_file` で利用可能 |
| Frontend (ホスト) | `frontend/.env.local` | NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 | Next.js 自動読込 |
| Frontend (Compose) | `frontend/.env.local.container` | NEXT_PUBLIC_API_BASE_URL=http://todo-backend:8000 | DNS 名はサービス名 (container_name) |

Cosmos を使わないフェーズでは `COSMOS_DISABLE=1` を設定して in-memory リポジトリで軽量起動します。

---
### A. コンテナを使わないホスト実行手順

1. Backend 依存インストール
  ```powershell
  cd backend
  python -m venv .venv
  .venv\\Scripts\\Activate.ps1
  pip install -r requirements.txt
  ```
2. `backend/.env` 作成 (最小例)
  ```env
  LOG_LEVEL=INFO
  COSMOS_DISABLE=1
  ```
3. Backend 起動
  ```powershell
  uvicorn src.main:app --reload --port 8000
  ```
4. Frontend 依存インストール & 起動 (別ターミナル)
  ```powershell
  cd frontend
  npm install
  echo NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 > .env.local
  npm run dev
  ```
5. 動作確認
  - http://localhost:3000 で UI
  - http://localhost:8000/health で 200
  - http://localhost:8000/docs で OpenAPI
6. Cosmos 利用へ切替
  - `.env` の `COSMOS_DISABLE` を削除し接続情報 (ENDPOINT/KEY など) を追記 → 再起動
7. テスト
  ```powershell
  cd backend
  pytest -q
  ```

#### ホスト実行 利点 / 注意
| 観点 | 利点 | 注意 |
|------|------|------|
| 起動/反映 | 最速 | 本番 OS レイヤ差異は再現されない |
| デバッガ | VS Code ブレークポイント容易 | PYTHONPATH 問題が出たら `uvicorn src.main:app` 形式厳守 |

---
### B. Docker Compose 実行手順

1. 環境ファイル準備 (任意)
  ```text
  backend/.env.container
    COSMOS_DISABLE=1
  frontend/.env.local.container
    NEXT_PUBLIC_API_BASE_URL=http://todo-backend:8000
  ```
2. `docker-compose.yml` へ env_file を追加する場合の例
  ```yaml
  services:
    backend:
     env_file:
      - backend/.env.container
    frontend:
     env_file:
      - frontend/.env.local.container
  ```
3. 起動
  ```powershell
  docker compose up --build -d
  ```
4. ログ確認
  ```powershell
  docker compose logs -f backend
  docker compose logs -f frontend
  ```
5. 疎通確認 (frontend コンテナ→backend)
  ```powershell
  docker exec todo-frontend sh -c "apk add --no-cache curl >/dev/null 2>&1 || true; curl -s http://todo-backend:8000/health"
  ```
6. 変更反映
  - Python: `--reload` により即時反映
  - Next.js: dev サーバがホットリロード
7. 停止 / クリーンアップ
  ```powershell
  docker compose down            # ボリューム保持
  docker compose down -v         # 依存キャッシュも削除
  ```

#### Compose 利点 / 注意
| 観点 | 利点 | 注意 |
|------|------|------|
| 本番近似 | コンテナ境界 / DNS 名解決再現 | 初回ビルド時間がかかる |
| チーム統一 | Dockerfile による再現性 | node_modules/venv ボリューム差異で不整合時は `down -v` |

---
### トラブルシュート (ローカル)

| 症状 | 原因 | 対処 |
|------|------|------|
| 502 fetch failed (Compose) | `NEXT_PUBLIC_API_BASE_URL` が localhost | `http://todo-backend:8000` に修正 |
| ImportError domain.* | PYTHONPATH 未設定 | Compose: `PYTHONPATH=/app/src` / ホスト: `uvicorn src.main:app` |
| Cosmos 初期化遅延 | 接続情報不足 | 一旦 `COSMOS_DISABLE=1` で無効化 |
| 変更反映されない | キャッシュイメージ | `docker compose build --no-cache <service>` |

---
### 選択ガイド

| シナリオ | 推奨 |
|----------|------|
| 早い反復 | ホスト |
| 本番類似検証 | Compose |
| Dockerfile 最適化 | Compose |
| デバッグ集中 | ホスト |

不足あれば Issue で提案してください。

## API仕様

### エンドポイント一覧

| Method | Endpoint | Description | 備考 |
|--------|----------|-------------|------|
| POST | `/api/todos` | 作成 | createdAt/updatedAt サーバ生成 |
| GET | `/api/todos` | 一覧 | フィルタ/ページング未実装 |
| GET | `/api/todos/{id}` | 取得 | 404 when not found |
| PATCH | `/api/todos/{id}` | 部分更新 | title/description/priority/dueDate/tags |
| PATCH | `/api/todos/{id}/complete` | 完了化 | 冪等 / updatedAt 更新 |
| PATCH | `/api/todos/{id}/reopen` | 未完へ戻す | 冪等 / updatedAt 更新 |
| DELETE | `/api/todos/{id}` | 削除 | 204 / 404 |
| GET | `/health` | Liveness |  |
| GET | `/health/ready` | Readiness | Cosmos 接続後 ready 化予定 |

### リクエスト例

```bash
# TODO作成
curl -X POST "http://localhost:8000/api/todos" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Container Apps学習",
    "description": "Azure Container Appsの基礎を学習する",
    "priority": "high",
    "dueDate": "2025-08-15T18:00:00Z",
    "tags": ["学習", "Azure"]
  }'

# TODO一覧取得（現在フィルタ未対応）
curl "http://localhost:8000/api/todos"
```

エラーフォーマット例:
```
404: {"detail":{"type":"not_found","id":"<id>"}}
409: {"detail":{"type":"duplicate_todo_id","id":"<id>"}}
422: {"detail":{"type":"validation_error","errors":[{"field":"priority","message":"...","errorType":"string_pattern_mismatch"}]}}
500: {"detail":{"type":"internal_server_error","message":"Internal Server Error","status":500}}
```

詳細なAPI仕様は http://localhost:8000/docs で確認できます。エラーフォーマットの完全な仕様は [backend/README.md のエラーレスポンス仕様](backend/README.md#エラーレスポンス仕様) を参照してください。

## テスト

### 単体テスト実行

```bash
# バックエンドテスト
cd backend
pytest tests/ -v --cov=src

# カバレッジレポート生成
pytest tests/ --cov=src --cov-report=html
```

### 統合テスト実行

```bash
# Docker環境でのE2Eテスト
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
```


## Azure環境へのデプロイ

### 前提条件

- Azureアカウント
- Azure CLI ログイン済み
- Container Registry へのアクセス権限

### リソース払い出し

```powershell
az login
az account show
```

```powershell
azd auth login
```

### azd で「環境のみ」を払い出す手順

このリポジトリの `infra/main.bicep` はコンテナアプリ本体を作成せず、Log Analytics / ACR / Container Apps Managed Environment / Cosmos DB などの「環境部分」のみを作成する構成になっています。`azd` を使って環境を払い出す手順を示します。

ワークフローの意図:
- まず azd で環境のみを払い出す（ACR にイメージが無くても失敗しない）
- イメージをビルドして ACR に push
- Container Apps 本体は CLI（`az containerapp create` / `az containerapp update`）で作成または更新する

前提: `azure.yaml` がリポジトリにあり、azd がプロジェクトのインフラを参照できる状態であること

1) azd にログインしてサブスクリプションを選択

```powershell
az login
az account set --subscription <SUBSCRIPTION_ID>
azd auth login
```

2) azd 環境変数を用意（対話を避けるためローカル env に設定）

例: `dev` 環境名で払い出す場合

```powershell
# 環境名
azd env set --local envName dev

# (任意) ACR 名を明示する場合
azd env set --local acrName myuniquearc0123

# Cosmos の Free Tier を使う場合
azd env set --local enableCosmosFreeTier true

# 必要な他のパラメータも同様に azd env set --local <name> <value>
```

3) 環境のみを払い出す

```powershell
# azd up は infra を払い出し、コードビルドやイメージpushも行います。
# 本テンプレートはアプリ本体を作らないため、azd up を実行すると環境のみが作成されます。
azd up

# あるいは non-interactive にしたい場合 (既に env に値を設定済みなら):
azd up --no-wait
```

4) 出力値や設定値の確認

```powershell
# ACR の FQDN
azd env get-value acrLoginServer

# Container Apps Environment の ID
azd env get-value environmentId

# Cosmos のエンドポイント (シークレットは azd が secure に扱います)
azd env get-value cosmosEndpoint
```

5) イメージをビルドして ACR に push

```powershell
az acr login --name $(azd env get-value acrName)
docker build -f backend/Dockerfile -t $(azd env get-value acrLoginServer)/backend:latest ./backend
docker push $(azd env get-value acrLoginServer)/backend:latest

docker build -f frontend/Dockerfile -t $(azd env get-value acrLoginServer)/frontend:latest ./frontend
docker push $(azd env get-value acrLoginServer)/frontend:latest
```

前提:
- Azure CLI にログイン済み (az login)
- ACR 名 (例: myuniquearc0123) または ACR の login server (例: myuniquearc0123.azurecr.io) を把握していること

基本フロー:
1. ACR にログイン
2. docker compose でイメージをビルド（または既にビルド済み）
3. ローカルイメージに ACR の FQDN を使ってタグ付け（または Compose の image を FQDN にしておく）
4. ACR に push

```powershell
# 変数を設定
$ACR_NAME = "myuniquearc0123"
# ACR の login server を取得し、先頭/末尾の空白を除去
$ACR_LOGIN_SERVER = (az acr show -n $ACR_NAME --query loginServer -o tsv).Trim()

# ACR にログイン（az が内部で docker login を実行します）
az acr login --name $ACR_NAME

# docker compose でビルド（または既にビルド済み）
docker compose build

# ローカルイメージ名を確認（オプション）
docker images --format "{{.Repository}}:{{.Tag}}\t{{.ID}}" | Select-String "frontend|backend"

# 例: ローカルイメージが 'frontend:latest' / 'backend:latest' の場合、ACR 用にタグ付けして push
docker tag udemy-containerapps-cicd-aiapp-frontend:latest $ACR_LOGIN_SERVER/frontend:latest
docker tag udemy-containerapps-cicd-aiapp-backend:latest  $ACR_LOGIN_SERVER/backend:latest

docker push $ACR_LOGIN_SERVER/frontend:latest
docker push $ACR_LOGIN_SERVER/backend:latest
```

1) Container Apps の Managed Identity に ACR から pull する権限を付与
- Container Apps の Managed Identity に `AcrPull` ロールを付与する必要があります。azd のプロビジョンで自動付与が行われる場合もありますが、必要に応じて以下のように手動実行できます。

```powershell
az role assignment create --assignee-object-id <APP_PRINCIPAL_ID> --role AcrPull --scope $(az acr show -n $(azd env get-value acrName) --query id -o tsv)
```

---

```powershell
(.venv) AzureContainerApps\src > azd up
? Enter a unique environment name: todoapp

New environment 'todoapp' created and set as default
? Select an Azure Subscription to use:  1. shirokuma (f80766c9-6be7-43f9-8369-d492efceff1e)
? Enter a value for the 'backendImage' infrastructure parameter: [? for help] backend
? Enter a value for the 'backendImage' infrastructure parameter: backend
? Enter a value for the 'envName' infrastructure parameter: learn
? Enter a value for the 'frontendImage' infrastructure parameter: frontend
? Pick a resource group to use: 1. Create a new resource group
? Enter a name for the new resource group: (rg-todoapp)

? Enter a name for the new resource group: rg-todoapp
```

### Azure Container Apps

2) Container Apps 本体を作成または既存アプリを更新

リソース名やタグなど可変な値は事前に PowerShell の環境変数に設定しておくと、手順が読みやすくなりミスを減らせます。以下は推奨される手順例です。


```powershell
# --- 事前に設定する変数（例） ---
$RESOURCE_GROUP      = $(azd env get-value AZURE_RESOURCE_GROUP)      # azd を使っている場合
$ENV_NAME            = "dev"                                          # Managed Environment 接頭辞
$ACR_LOGIN_SERVER    = "{ACRのリソース名称}.azurecr.io"            # ACR の FQDN
$ACR_NAME            = "{ACRのリソース名称}"                    # ACR 名（AcrPull ロール付与用）
$FRONTEND_APP_NAME   = "todo-frontend"                               # 任意の App 名
$BACKEND_APP_NAME    = "todo-backend"                                # 任意の App 名
$FRONTEND_IMAGE_TAG  = "frontend:latest"                             # またはリリースタグ
$BACKEND_IMAGE_TAG   = "backend:latest"

# --- 共通リソース ID を取得 ---
$ENV_ID = az containerapp env show --name "${ENV_NAME}-cae" --resource-group $RESOURCE_GROUP --query id -o tsv
$ACR_RESOURCE_ID = az acr show --name $ACR_NAME --query id -o tsv

# --- Backend の Azure Container Apps を、Azure Container Registry のイメージで作成する手順 ---
az containerapp create `
  --name $BACKEND_APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --environment $ENV_ID `
  --image $ACR_LOGIN_SERVER/$BACKEND_IMAGE_TAG `
  --ingress external `
  --target-port 80 `
  --system-assigned `
  --secrets "cosmos-connection-string=<COSMOSDBの接続文字列>" `
  --env-vars "COSMOS_CONNECTION_STRING=secretref:cosmos-connection-string" "COSMOS_DATABASE=TodoApp" "COSMOS_CONTAINER=Todos" "COSMOS_PARTITION_KEY=/id" "LOG_LEVEL=INFO"

# --- Frontend の Azure Container Apps を、Azure Container Registry のイメージで作成する ---
az containerapp create `
  --name $FRONTEND_APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --environment $ENV_ID `
  --image $ACR_LOGIN_SERVER/$FRONTEND_IMAGE_TAG `
  --ingress external `
  --target-port 80 `
  --system-assigned `
  --env-vars "NEXT_PUBLIC_API_BASE_URL=/api" "BACKEND_API_BASE=URL=https://$BACKEND_APP_NAME.$ENV_NAME.azurecontainerapps.io"
```

### トラブルシュート (azd)
| 症状 | 原因候補 | 対処 |
|------|----------|------|
| Image pull error | AcrPull 未反映 / イメージ未 Push | `az acr repository list -n <acr>` で確認、`az role assignment list` 再確認 |
| Cosmos 認証失敗 | KEY 未同期 | `azd deploy` 再実行、シークレット値ローテーション確認 |
| The subscription is not registered | プロバイダ未登録 | `az provider register -n Microsoft.App` 他を登録 |

### クリーンアップ
```powershell
# 作成されたリソースグループを削除 (不可逆)
az group delete --name <RESOURCE_GROUP> --yes --no-wait
```

## CI/CD パイプライン

### ワークフロー

1. **CI（継続的インテグレーション）**
   - コード品質チェック（Black、flake8、mypy）
   - セキュリティスキャン（Bandit、Trivy）
   - 単体テスト・統合テスト実行
   - Dockerイメージビルド・レジストリプッシュ

2. **CD（継続的デプロイメント）**
   - ステージング環境デプロイ
   - 統合テスト実行
   - 本番環境ブルーグリーンデプロイ
   - ヘルスチェック・ロールバック

> GitHub Actions の詳細な設定手順は [GITHUB_ACTIONS_SETTINGS.md](./docs/GITHUB_ACTIONS_SETTINGS/GITHUB_ACTIONS_SETTINGS.md) を参照してください。

## トラブルシューティング

### よくある問題

1. **Cosmos DB接続エラー**
   ```
   解決方法: 環境変数COSMOS_ENDPOINTとCOSMOS_KEYを確認
   ```

2. **フロントエンドでAPIエラー**
   ```
   解決方法: CORS設定とAPI_BASE_URL環境変数を確認
   ```

3. **コンテナ起動失敗**
   ```
   解決方法: dockerイメージのヘルスチェック設定を確認
   ```

## コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Requestを作成

## 参考資料

- [Azure Container Apps Documentation](https://docs.microsoft.com/azure/container-apps/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Azure Cosmos DB Documentation](https://docs.microsoft.com/azure/cosmos-db/)
- [講座学習ガイド](docs/COURSE_GUIDE.md)

