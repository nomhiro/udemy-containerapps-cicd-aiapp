# アプリケーション基本設計書 (Azure Container Apps TODO管理アプリ)

最終更新: 2025-08-31
作成目的: 本システム (学習用 TODO 管理アプリ) の機能要件・非機能要件・構成・設計指針を統一し、拡張/運用の基盤とする。

---
## 1. 概要
| 項目 | 内容 |
|------|------|
| システム名 | Azure Container Apps TODO管理アプリ |
| 目的 | 学習/デモ用にクラウドネイティブ構成・CI/CD・スケーリング・監視を包括的に体験 |
| 利用者 | 開発者 / 受講者 |
| ユースケース | タスク登録・検索・統計表示 |
| 提供方式 | Web (Frontend: Next.js, Backend: FastAPI, API JSON) |

---
## 2. スコープ
- 対象: TODO CRUD / 統計算出 / 基本検索フィルタ / ステータス切替
- 非対象 (将来候補): 認証(AAD B2C), 共有/権限, 通知(メール/Push), タグ高度分析, カレンダー統合

---
## 3. 全体アーキテクチャ
- フロントエンド (Next.js) → REST API (FastAPI) → Cosmos DB (Serverless)
- コンテナ実行: Azure Container Apps (Consumption)
- コンテナイメージ: Azure Container Registry (任意、指定時 private pull + AcrPull ロール)
- 監視: Log Analytics (+ 将来 Application Insights 拡張可)
- IaC: Bicep (モジュール構成) / `azure.yaml` + `azd`
- デプロイ: `azd up` / GitHub Actions (将来 CI/CD ワークフロー)

README の Mermaid 図を参照。

---
## 4. 機能要件 (概要)
| ID | 名称 | 説明 | 優先度 |
|----|------|------|--------|
| F-1 | タスク登録 | タイトル/説明/優先度/期限/タグ | High |
| F-2 | タスク取得 | 一覧 + フィルタ (completed, priority, tag) | High |
| F-3 | タスク更新 | 部分/全体更新 | High |
| F-4 | タスク削除 | 論理削除不要 → 物理削除 | Medium |
| F-5 | 完了切替 | toggle エンドポイント | High |
| F-6 | 統計取得 | total/completed/overdue/byPriority | Medium |
| F-7 | ヘルスチェック | /health, /health/ready | High |

---
## 5. ドメインモデル (概略)
```
Todo(id, title, description?, priority, dueDate, tags[], completed, createdAt, updatedAt)
Stats(total, completed, overdue, byPriority<Map>)
```
- `priority`: enum { low, normal, high, urgent }
- `dueDate` UTC ISO8601
- `tags`: 文字列配列 (小文字正規化案)

---
## 6. データ設計 (Cosmos DB)
| 項目 | 内容 |
|------|------|
| アカウント | Serverless / Free Tier (可能なら) |
| DB 名 | `TodoApp` (param) |
| コンテナ | `Todos` |
| パーティションキー | 単一パーティション (userId 廃止) |
| TTL | 設定なし (クリーンアップ将来検討) |
| インデックス | 既定 (性能問題発生時にカスタム) |
| 楽観ロック | `_etag` 利用 (将来) |

### アクセスパターン
| 操作 | RU 目安 | 説明 |
|------|---------|------|
| PK & id 取得 | ~1 | 単一読み取り |
| 一覧 (ユーザー + フィルタ) | 1～数 | パーティション内クエリ |
| 集計 | 数 | サーバー側クエリ (単純 COUNT / FILTER) |

### 6.1 アイテム JSON 定義
Cosmos DB に保存する TODO アイテムの JSON Schema は `docs/COSMOS_TODO_ITEM.schema.json` を参照。

サンプル:
```json
{
	"id": "todo_01HZYX9A1",
	"title": "Container Apps 学習",
	"description": "Bicep/azd で IaC",
	"priority": "high",
	"dueDate": "2025-09-15T12:00:00Z",
	"tags": ["azure", "learning"],
	"completed": false,
	"createdAt": "2025-08-31T09:12:30Z",
	"updatedAt": "2025-08-31T09:12:30Z"
}
```

バリデーション方針:
- API 層 (FastAPI + Pydantic) で JSON Schema と整合するモデル (Enum, Optional) を定義。
- 追加フィールドは `additionalProperties=false` により拒否 (互換性が必要になったら Schema 側を緩和)。
- 更新時 `updatedAt` をサーバ側で強制上書き。楽観ロック導入時は `_etag` を If-Match に利用。

## 7. API 設計 (サマリ)
| メソッド | パス | 概要 |
|----------|------|------|
| GET | /api/todos | フィルタ可能一覧 |
| POST | /api/todos | 作成 |
| GET | /api/todos/{id} | 取得 |
| PUT | /api/todos/{id} | 更新 |
| DELETE | /api/todos/{id} | 削除 |
| POST | /api/todos/{id}/toggle | 完了切替 |
| GET | /api/todos/stats | 統計 |
| GET | /health | Liveness |
| GET | /health/ready | Readiness |

### リクエスト/レスポンス要点
- JSON UTF-8, snake_case or camel_case (内部: Pydantic モデルで統一)
- バリデーションエラー: HTTP 422
- NotFound: HTTP 404
- ビジネス例外 (予期済) は 400/409 (将来)

---
## 8. シーケンス (例: Todo 作成)
```
Client -> Frontend API route (Next.js) -> Backend FastAPI -> Cosmos SDK -> Cosmos DB
Backend <- 成功 (201 JSON) <- Cosmos DB
Frontend キャッシュ更新 (SWR mutate)
```

---
## 9. エラーハンドリング方針
| レイヤ | 方針 |
|--------|------|
| Frontend | SWR `onErrorRetry` / ユーザー向け Toast |
| Backend | 統一例外ハンドラ -> JSON {errorCode, message} |
| DB | Cosmos エラーコードマッピング / リトライ (429) backoff |
| ネットワーク | タイムアウト設定 (クライアント/サーバ) |

---
## 10. 環境変数 / 設定
| 名称 | 用途 | 供給元 |
|------|------|--------|
| COSMOS_ENDPOINT | Cosmos 接続URL | Bicep 出力 | 
| COSMOS_KEY | プライマリキー | Bicep シークレット (将来 Key Vault) |
| COSMOS_DATABASE | DB 名 | 環境設定 |
| NEXT_PUBLIC_API_BASE_URL | フロント API ルート | デプロイ時注入 |
| LOG_LEVEL | ログレベル | .env / 環境 |
| PORT (backend) | Uvicorn ポート | コンテナ定義 |

将来: MI + RBAC 化により KEY 削除 / Key Vault 参照化。

---
## 11. ロギング / モニタリング
| 項目 | 方針 |
|------|------|
| 形式 | JSON 構造化 (timestamp, level, msg, context) |
| 集約 | Container Apps → Log Analytics |
| APM | Application Insights (拡張予定) |
| 健康監視 | /health /health/ready, Container Apps probes |
| 指標 | リクエスト数, レイテンシ, エラー率, Cosmos RU, スケールイベント |

---
## 12. スケーリング設計
| 項目 | 内容 |
|------|------|
| ルール | HTTP 同時処理数 (concurrentRequests) 基準 (初期: 50) |
| 最小レプリカ | 0 (Cost 最小) |
| 最大レプリカ | 1~3 (学習段階) |
| 将来 | CPU% / カスタムメトリクス (Queue 等) 追加 |

---
## 13. セキュリティ設計
| 項目 | 現状 | 将来案 |
|------|------|-------|
| シークレット | 環境変数 (Bicep) | Key Vault + MI |
| ACR Pull | Managed Identity + AcrPull | 変わらず |
| 認証/認可 | 未実装 | Azure AD B2C / Entra ID |
| 通信 | HTTPS (Ingress) | Private Ingress + WAF (上流) |
| RBAC | 最小権限 (AcrPull) | Cosmos RBAC / Key Vault RBAC |

---
## 14. デプロイ / リリース戦略
| ステップ | 説明 |
|---------|------|
| Build | Docker (backend/frontend) |
| Push | ACR (任意) or Public Registry |
| Provision | `azd up` (Bicep) |
| Deploy | `azd deploy` / CI/CD ワークフロー |
| Blue/Green | Container Apps `trafficWeights` (将来) |
| Rollback | 旧 Revision トラフィック 100% 戻し |

---
## 15. テスト戦略
| レイヤ | 内容 |
|--------|------|
| Unit | Pydantic モデル / サービスロジック |
| API | FastAPI TestClient / pytest |
| Integration | Cosmos Emulator or Live (Serverless) with isolated DB |
| E2E | Front ↔ API (Playwright 予定) |
| 監視テスト | Synthetic ping (将来) |

---
## 16. 変更履歴
| 日付 | 版 | 変更概要 |
|------|----|----------|
| 2025-08-31 | 0.1 | 初版作成 |
