# Frontend (Next.js) - TODO App

単一ページ (Task Board) で一覧 / 作成 / 編集 / 完了 / 再オープン / 削除を行うクライアント実装。Next.js API ルート経由で FastAPI バックエンドへプロキシします。

## 1. 技術スタック (採用済み)
| 区分 | ライブラリ | 用途 |
|------|------------|------|
| Framework | Next.js 15 (App Router) | SSR/CSR 混在・開発基盤 |
| Language | TypeScript | 型安全 |
| State (Server) | SWR | キャッシュ/再検証/楽観的更新 |
| Forms | react-hook-form | 軽量フォーム制御 |
| Validation | zod | スキーマ & 型推論 |
| Date | date-fns | 日付処理 |
| Style | Tailwind CSS v4 | ユーティリティCSS |
| API 型生成 | openapi-typescript | バックエンド OpenAPI 連携 |

## 2. 起動 & 環境変数
```bash
npm run dev
# http://localhost:3000
```

`.env.local` (ルート直下) 例:
```
NEXT_PUBLIC_API_BASE_URL=/api      # フロントからは常に相対 /api 経由
BACKEND_API_BASE=http://localhost:8000  # Next.js サーバが FastAPI へフォワード
```
作成手順:
1. ルートに `.env.local` 作成
2. FastAPI ポート変更時は `BACKEND_API_BASE` 修正
3. `npm run dev` 再起動 (env は一部ホットリロードされない)
4. ブラウザ DevTools → Network で `/api/todos` リクエストの実際の転送先を確認

フロー: Browser → `/api/todos` (Next.js) → Fetch `${BACKEND_API_BASE}/api/todos` (FastAPI)

FastAPI CORS 例:
```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
  CORSMiddleware,
  allow_origins=["http://localhost:3000"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)
```

## 3. ディレクトリ追加予定 (まだ未作成)
```
src/
  app/
    page.tsx                # Task Board (一覧 & アクション)
  components/
    todos/
      TodoCard.tsx
      TodoList.tsx
      TodoForm.tsx
      PriorityBadge.tsx
    ui/
      Modal.tsx
      Button.tsx
      Input.tsx
      Select.tsx
      Spinner.tsx
      Toast.tsx
  lib/
    api/client.ts           # fetch ラッパ (共通エラーハンドリング)
    api/todos.ts            # CRUD 呼び出し (SWR key 定義)
    swrConfig.ts            # グローバル SWR 設定
    types/todo.ts           # 生成型 or ラップ型
    utils/date.ts
```

## 4. SWR キー / API インターフェース
| 用途 | key | HTTP | パス |
|------|-----|------|------|
| 一覧 | 'todos' | GET | /api/todos |
| 単体 (必要なら) | `todo:{id}` | GET | /api/todos/{id} |

基本は一覧キャッシュを基準にローカル更新 (mutate) で差分反映:
```ts
mutate('todos', prev => prev?.map(t => t.id === id ? updated : t), false)
```

## 5. 楽観的更新パターン例
完了化:
1. mutate で対象 completed=true, updatedAt=仮 now へ即時書換
2. API PATCH 成功 → サーバ値で再度 mutate
3. 失敗 → rollback (キャプチャした prev 差し戻し) + トースト

## 6. フォームバリデーション (zod スキーマ案)
```ts
import { z } from 'zod'
export const todoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().or(z.literal('')),
  priority: z.enum(['low','normal','high','urgent']).default('normal'),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional()
})
export type TodoFormValues = z.infer<typeof todoSchema>
```

## 7. エラー処理方針
| type | UI 表示 |
|------|---------|
| validation_error | フィールド単位エラー setError |
| not_found | トースト + 一覧再取得 |
| duplicate_todo_id | 再生成して再送 (内部) |
| internal_server_error | トースト + Retry ボタン |

## 8. 実装タスク (進行順)
1. 基盤: swrConfig / api client / 型生成スクリプト
2. TodoList (読み取り & Skeleton)
3. TodoForm (作成) + モーダル
4. 完了/再オープン/削除 (楽観的更新)
5. 編集 (モーダル流用) → inline Title/Priority へ拡張
6. トースト & エラーバウンダリ
7. ダークモード・アクセシビリティ調整

## 9. OpenAPI 型生成スクリプト (追加予定)
`package.json` scripts:
```json
{
  "scripts": {
    "gen:api": "openapi-typescript %NEXT_PUBLIC_API_BASE_URL%/openapi.json -o src/types/api.d.ts"
  }
}
```
※ Windows PowerShell では環境変数参照を適宜調整 (事前に $Env:NEXT_PUBLIC_API_BASE_URL 設定 or 直接 URL 埋め込み)。

## 10. 更新履歴
| 日付 | 版 | 内容 |
|------|----|------|
| 2025-09-03 | 0.1 | Scaffold 生成 & 設計 README 初版 |
| 2025-09-03 | 0.2 | OpenAPI 型生成スクリプト `gen:api` 追加 / `src/lib/api/types.ts` |
| 2025-09-03 | 0.3 | プロキシ方式 (Next.js API → FastAPI) / Apple 風 UI リファイン |
| 2025-09-03 | 0.4 | 単体テスト基盤 (Vitest) / 楽観更新 & フォーム境界テスト追加 |

## 11. 単体テスト (Vitest + Testing Library)

### 実行コマンド
```bash
# 全テスト (CI 用)
npm test

# ウォッチ (変更監視)
npm test -- --watch

# 対象ファイルのみ
npm test -- --run src/components/todos/__tests__/TodoForm.test.tsx

# カバレッジ
npm test -- --coverage
```

### 仕様メモ
- ランタイム: jsdom 環境。CSS/Tailwind はテスト時に PostCSS 無効化 (速度向上/不要エラー回避)。
- エイリアス: `@` → `src`。テストでも `vitest.config.ts` で解決。 
- コンポーネント/フォーム: React 18。必要なら `import React` を明示。 
- SWR: 楽観的更新は `mutate` の呼び出し回数を検証する軽量テスト。副作用 rollback は失敗パスで `mutate(KEY)` 単独呼び出しを確認。 
- フォーム: Zod バリデーション。境界長テスト (title 200/201, description 1000/1001) 実装。タグ/期限は送信時に正規化。 
- API クライアント: fetch をモックし 200 / 204 / エラー JSON を検証。非 JSON エラー追加時は HTML Response を返して `unknown_error` を期待するテストを追加想定。 

### テスト追加ガイド
1. `__tests__` ディレクトリ or `*.test.ts(x)` で配置。 
2. 外部通信は必ず `fetch` / `apiClient` をモック。統合テストが必要なら MSW 導入検討。 
3. アクセシビリティ: 可能な限り `getByRole / getByLabelText` を使用 (id/htmlFor が貼られている前提)。 
4. タイムゾーン依存値 (dueDate など) は厳密文字列ではなく ISO パターン正規表現で判定。 
5. 楽観的更新: 期待する mutate 呼び出しシーケンス (optimistic → commit / rollback) のみを最小検証。 

### 失敗例デバッグ
```bash
# 直近失敗テストのみ再実行
npm test -- --bail --run src/lib/api/__tests__/client.test.ts
```

### 将来の拡張候補
- GitHub Actions で `npm ci && npm run typecheck && npm test -- --coverage` 実行
- MSW による API ルート統合テスト
- カバレッジ閾値 (branches/statements > 70%) 設定
- E2E (Playwright) で CRUD とダークモード切替の回帰検証
