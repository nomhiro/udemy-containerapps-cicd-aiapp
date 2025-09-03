## 単体テストの実行方法

### 1. 仮想環境の有効化・依存インストール
（セットアップ済みの場合は省略可）
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. テスト実行
```powershell
pytest tests
```

### 3. テスト結果例
```
================================================== test session starts ===================================================
platform win32 -- Python 3.12.10, pytest-8.2.2, pluggy-1.6.0
rootdir: .../backend
collected 25 items

tests\test_conflict.py .
tests\test_cosmos_repo.py .
tests\test_e2e_cosmos_live.py .
tests\test_health.py ....
tests\test_todos.py ........
tests\test_validation.py ..........

============================================= 25 passed, 1 warning in 0.78s =============================================
```

### 備考
- テストはすべて非同期（@pytest.mark.asyncio）でAPIを網羅
- CosmosDB接続情報が未設定の場合、一部テストはスキップまたはInMemoryで実行
- テスト失敗時はエラー内容・レスポンスを確認してください

# Backend (FastAPI) - Azure Container Apps TODO API

シンプルな TODO 管理 API。FastAPI / Pydantic / pytest による TDD で実装し、最終的に Azure Container Apps + Cosmos DB で動作させます。

## 技術スタック
- Python 3.12+
- FastAPI / Starlette / Uvicorn
- Pydantic v2
- pytest / pytest-asyncio / httpx
- Azure Cosmos DB SDK (後続で導入)

## ディレクトリ構成 (現状)
```
backend/
  README.md            # このファイル
  requirements.txt     # 依存ライブラリ
  pytest.ini           # pytest 設定 (pythonpath=src)
  src/
    main.py                      # FastAPI エントリポイント / ルーティング
    domain/
      models/
        todo.py                  # ドメイン Todo モデル (PRIORITY_PATTERN 定義)
      repositories/
        todo_repository.py       # リポジトリ Protocol
    application/
      services/
        todo_service.py          # ビジネスロジック (部分更新等)
    infrastructure/
      repositories/
        in_memory_todo_repository.py  # 開発/テスト用
        cosmos_todo_repository.py     # Cosmos 用（簡易実装）
  tests/                      # pytest テスト群
    test_health.py
    test_todos.py
    test_conflict.py
    test_validation.py
    test_cosmos_repo.py

> NOTE: 旧 `models.py` は廃止しドメイン層へ移動済み。
```

## 環境変数 (予定含む)
| 変数 | 用途 | 例 | 必須 | 備考 |
|------|------|----|------|------|
| COSMOS_ENDPOINT | Cosmos DB エンドポイント | https://... | 後 | Bicep 出力で注入想定 |
| COSMOS_KEY | Cosmos Primary Key | (secret) | 後 | Key Vault 置換予定 |
| COSMOS_DATABASE | DB 名 | TodoApp | 後 | `main.bicep` パラメータ |
| LOG_LEVEL | ログレベル | INFO | 任意 | uvicorn ログ調整 |

## セットアップ (PowerShell)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```


## Cosmos DB 接続後の動作確認手順

1. `.env` に Cosmos の接続情報を記載
  - `COSMOS_CONNECTION_STRING=AccountEndpoint=...;AccountKey=...;`
  - `COSMOS_DATABASE=TodoApp`
  - `COSMOS_CONTAINER=Todos`

2. サーバ起動
```powershell
uvicorn --app-dir src main:app --reload --port 8000
```

3. ヘルスチェック
  - `http://localhost:8000/health` → `{ "status": "ok" }`
  - `http://localhost:8000/health/ready` → `{ "status": "ready" }` (Cosmos接続成功時)

4. Todo作成 (PowerShell例)
```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:8000/api/todos -ContentType "application/json" -Body '{"title":"cp test","priority":"normal"}'
```

5. 一覧取得
```powershell
Invoke-RestMethod http://localhost:8000/api/todos
```

6. 個別取得 (idは作成時レスポンスのid)
```powershell
Invoke-RestMethod http://localhost:8000/api/todos/<id>
```

7. 完了化
```powershell
Invoke-RestMethod -Method PATCH -Uri http://localhost:8000/api/todos/<id>/complete
```

8. 削除
```powershell
Invoke-RestMethod -Method DELETE -Uri http://localhost:8000/api/todos/<id>
```

9. Cosmos DB ポータルでデータ確認 (TodoApp / Todos)

10. エラー時はサーバログを確認 (datetime直列化/partition key/接続失敗など)

---
## 実行 (InMemory/テスト用)
```powershell
uvicorn --app-dir src main:app --reload --port 8000
```
アクセス: http://localhost:8000/health

## TDD ワークフロー
1. RED: 失敗するテストを追加 (仕様化)  
2. GREEN: 最小実装でテスト合格  
3. REFACTOR: 重複除去/責務分離 (リポジトリ層, サービス層)  

現状: `/health/ready` の初期テストで *not-ready* 期待 → 実装が *ready* を返し RED を観測済み。

Readiness 現状:
- InMemory リポジトリ利用時は `not-ready`
- `set_repo()` で `is_ready=True` を持つリポジトリ注入時に ready へ遷移
- 将来: Cosmos 接続成功 (コンテナ/DB/コンテナ存在検証) 後に ready 切替実装予定

## コア API (必須セット)
単一ユーザー前提 / userId 無し。

| メソッド | パス | 用途 | 主なレスポンス | エラー |
|---------|------|------|----------------|--------|
| POST | /api/todos | 作成 | 201 + Todo | 409 重複 / 422 |
| GET | /api/todos | 一覧取得 | 200 + Todo[] |  |
| GET | /api/todos/{id} | 単一取得 | 200 + Todo | 404 |
| PATCH | /api/todos/{id} | 部分更新 | 200 + Todo | 404 / 422 |
| PATCH | /api/todos/{id}/complete | 完了化 | 200 + Todo | 404 |
| PATCH | /api/todos/{id}/reopen | 再オープン | 200 + Todo | 404 |
| DELETE | /api/todos/{id} | 削除 | 204 | 404 |
| GET | /health | Liveness | 200 |  |
| GET | /health/ready | Readiness | 200 |  |

Todo モデル (レスポンス):
```
id, title, description?, priority(low|normal|high|urgent), dueDate?, tags[], completed, createdAt(サーバ生成), updatedAt(サーバ生成)
```

作成時入力 (CreateTodo ペイロード):
```
id?(任意: 省略でサーバ UUID 生成), title, description?, priority, dueDate?, tags[]
```
サーバは createdAt / updatedAt を UTC の現在時刻で設定し、completed は false 初期化。
状態変化 (complete / reopen / 部分更新) 実施時は updatedAt が再設定 (UTC now) される。

### エラーレスポンス仕様

| 状態 | 例 | 形式 |
|------|----|------|
| 404 Not Found | Todo 未存在 | `{ "detail": { "type": "not_found", "id": "<todo_id>" } }` |
| 409 Conflict | ID 重複 | `{ "detail": { "type": "duplicate_todo_id", "id": "<todo_id>" } }` |
| 422 Validation Error | priority 不正 | `{ "detail": { "type": "validation_error", "errors": [ { "field": "priority", "message": "...", "errorType": "string_pattern_mismatch" } ] } }` |
| 500 Internal Error | 想定外例外 | `{ "detail": { "type": "internal_server_error", "message": "Internal Server Error", "status": 500 } }` |

> 422 は独自ラップ済み (validation_error)。`errors[].errorType` は Pydantic `type` 値。

ルートプロジェクト側 README の簡易エラー例リストについては `../README.md` の API 仕様セクションも参照。

グローバルハンドラ:
- RequestValidationError: 422 validation_error 形式
- HTTPException: `detail` が dict ならそのまま、文字列なら `{type:http_error,message:...}` に正規化
- Exception: 500 internal_server_error (スタックはログ出力のみ)

## 未実装 / 拡張候補 (Planned)
| カテゴリ | 機能 | 概要 / メモ |
|----------|------|-------------|
| 集計 | GET /api/todos/stats | total / completed / overdue / byPriority |
| バルク | POST /api/todos/_bulk | 複数投入 (学習/初期データ) |
| バルク | DELETE /api/todos (全削除) | テスト / リセット用途 (認証後限定) |
| 観測 | /metrics | Prometheus 形式 (Starlette Middleware など) |
| エクスポート | GET /api/todos/export | JSON / CSV ダウンロード |
| 競合制御 | ETag / 楽観ロック | If-Match + バージョン or updatedAt 比較 |
| フィルタ | /api/todos?completed=&priority= | 現状未対応 (将来: クエリパラ) |
| ページング | limit / offset or cursor | 大量件数対策 |
| 検索 | keyword / tag | 軽量 in-memory or Cosmos クエリ |
| Readiness | Cosmos 接続検証 | 実 DB ポーリング / コンテナ存在確認 |
| Observability | 構造化ログ/Trace | request id, duration ms, correlation |

> 優先度目安: フィルタ → stats → pagination → bulk → metrics → export.

## テスト実行
```powershell
cd backend
python -m venv .venv  # 未作成の場合
.\.venv\Scripts\Activate.ps1
pytest -q
```
カバレッジ追加 (任意):
```powershell
pytest --cov=src --cov-report=term-missing
```

## 設計方針メモ
- ルータ分割: `routers/todos.py` などへ分離予定
- 依存性注入: `get_repository()` でインタフェース/実装切替
- Pydantic モデル: Create/Update/Response を分離 (過剰送信防止)

## 参考
- FastAPI Docs: https://fastapi.tiangolo.com/
- Cosmos SDK: https://learn.microsoft.com/azure/cosmos-db/

---
更新履歴
| 日付 | 版 | 内容 |
|------|----|------|
| 2025-08-31 | 0.1 | 初版作成 |
| 2025-09-01 | 0.2 | createdAt / updatedAt サーバ側生成 & CreateTodo 入力分離 |
| 2025-09-01 | 0.3 | 旧 models.py 廃止 / Priority パターン定数統一 / エラーレスポンス仕様追記 |
