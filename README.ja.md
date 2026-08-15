# SQLite Explorer

SQLite ファイルを、ブラウザーだけで開いて理解するための単一 HTML アプリです。

- ファイルは外部へ送信しません
- 配布版は `dist/index.html` 1 ファイル
- `file://` から直接起動可能
- 日本語 / English 切り替え
- v1.0 は読み取り専用
- `sql.js` をビルド時に固定バージョンで内包

## 主な機能

### Database Overview
テーブル、ビュー、インデックス、総行数、ページサイズ、エンコーディングなどを表示します。
行数の多いテーブルや、主キー・インデックスに関する確認候補もまとめます。

### Data Browser
テーブルを 100 行ずつページングして閲覧できます。CSV / JSON への書き出しも可能です。

### Schema & Relationships
SQLite に定義された外部キーを ER 図で表示します。
さらに、`user_id -> users.id` のような名前、型、サンプル値の重なりから「未定義の関係候補」を推定し、点線で表示します。

### Column Profiler
列ごとに以下を確認できます。

- NULL 件数 / NULL 率
- DISTINCT 件数
- 上位の値
- 型 / 主キー

### SQL Query + Query Plan
`SELECT` / `WITH` / `EXPLAIN` / 読み取り専用 `PRAGMA` を実行できます。
`SELECT` / `WITH` では `EXPLAIN QUERY PLAN` も自動表示します。

## 安全性

v1.0 では書き込み SQL を実行しません。`INSERT`、`UPDATE`、`DELETE`、`CREATE`、`DROP` などはブロックします。
元の SQLite ファイルへ書き戻す処理もありません。

## ビルド

Windows 10 / 11 の PowerShell で実行します。

```bat
build-standalone.bat
```

初回ビルド時だけ npm から `sql.js` の固定バージョンを取得します。
取得した依存は `.cache/` に保存され、配布 HTML に Base64 で内包されます。

生成物:

```text
dist/index.html
dist/index.self-extract.html
dist/dependency-manifest.json
```

依存を再取得する場合:

```powershell
.\build-standalone.ps1 -ForceDownload
```

自己解凍版を作らない場合:

```powershell
.\build-standalone.ps1 -SkipSelfExtract
```

## オフライン確認

`VERIFY_OFFLINE.md` を参照してください。

## 開発時の正本

`src/index.template.html` が正本です。`dist/index.html` を直接編集しないでください。

## 技術

- SQLite engine: [sql.js](https://github.com/sql-js/sql.js)
- UI / build contract: [ttomohisa/htmlapps-template](https://github.com/ttomohisa/htmlapps-template)
- License: MIT

## 注意

`sql.js` は SQLite ファイル全体をメモリへ読み込む方式です。大きなデータベースではブラウザーや端末の利用可能メモリに影響されます。
推定リレーションは補助情報であり、実際の外部キーを保証するものではありません。
