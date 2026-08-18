# SQLite Explorer

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-sqlite-explorer/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-sqlite-explorer/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](https://ttomohisa.github.io/htmlapps-sqlite-explorer/)
[![Read only](https://img.shields.io/badge/v1.0-read%20only-16624f)](#読み取り専用設計)

[English README](README.md)

知らないSQLiteファイルを開いたときに、**「どんなDBなのか」を素早く理解するための、プライバシー重視の単一HTMLアプリ**です。

テーブルを見るだけではなく、DB全体の概要、ER図、未定義リレーションの推定、列プロファイル、読み取り専用SQL、Query Planまで、ブラウザー内だけで確認できます。

## 🚀 デモ

### [GitHub PagesでSQLite Explorerを開く](https://ttomohisa.github.io/htmlapps-sqlite-explorer/)

GitHub Pagesから最初のHTMLを読み込んだ後、SQLiteの読み込み、テーブル閲覧、プロファイル、リレーション推定、SQL実行、Query Plan解析、CSV / JSON出力は端末内で処理されます。選択したSQLiteファイルが、このアプリからサーバーへアップロードされることはありません。

インストールやアカウント登録は不要です。

## 主な機能

- `.db`、`.sqlite`、`.sqlite3` などの標準SQLiteファイルをブラウザーで開く
- テーブル、View、Index、Trigger、総行数、ページサイズ、EncodingなどをまとめたDatabase Overview
- 行数・列数・Index数・FK数・PK有無をまとめて見られる **「テーブル規模」**
- Overviewのテーブル一覧からData Explorerへ直接移動
- テーブル全体をDOMへ展開せず、100行単位でページング表示
- テーブルやSQL結果をCSV / JSONへ書き出し
- Schema / DDL表示
- 定義済み外部キーを可視化するER図
- **Relationship inference**：列名・SQLiteの型Affinity・サンプル値の重なりから未定義の関係候補を推定
- 定義済みFKは実線、推定リレーションは点線で表示
- NULL件数・NULL率・Distinct・上位値・型・PKを確認できるColumn Profiler
- `Ctrl` / `⌘` + `Enter` で実行できる読み取り専用SQL Editor
- `EXPLAIN QUERY PLAN` の可視化
- Overviewから実行できる `PRAGMA quick_check`
- 1つのHTML内で日本語 / Englishを切り替え
- PCではDBツールらしい2カラムUI、スマートフォンでは下部ナビによるタッチ操作
- SVG faviconをHTMLへ内包
- 固定バージョンの `sql.js` を配布HTMLへ内包
- Content Security Policyで実行時のネットワーク接続を遮断

## すぐに使う

### Webで使う

[デモを開く](https://ttomohisa.github.io/htmlapps-sqlite-explorer/)だけで利用できます。SQLiteファイルを選択すると、そのまま解析が始まります。

選択したデータベースは、このアプリから外部へアップロードされません。

### 完全オフラインで使う

1. このリポジトリをダウンロードまたはクローンします。
2. Windowsで `build-standalone.bat` をダブルクリックします。
3. 初回だけ、`dependencies.json` で固定された `sql.js` を取得します。
4. 生成された `dist/index.html` を開きます。
5. そのHTML 1ファイルを任意の場所へコピーすれば、以降はインターネット接続なしでも利用できます。

Python、Node.js、ローカルWebサーバーは不要です。Windows標準のPowerShellと `tar.exe` を使用します。

自己解凍版の `dist/index.self-extract.html` も同時に生成されます。

## 使い方

1. 起動画面へSQLiteファイルをドロップするか、ファイル選択から開きます。
2. **概要** でDB全体の特徴を確認します。
3. **データ** でテーブル / Viewの中身を閲覧し、必要ならCSV / JSONへ書き出します。
4. **スキーマ** でDDL、ER図、定義済みFK、推定リレーションを確認します。
5. **解析** で列ごとのNULL、Distinct、上位値などをプロファイルします。
6. **SQL** で読み取り専用クエリを実行し、`EXPLAIN QUERY PLAN` を確認します。

### 概要

Overviewは、テーブルを1つずつ開く前に **「これはどんなDBなのか？」を把握するためのダッシュボード**です。

以下をまとめて確認できます。

- Tables / Views / Indexes / Rows
- SQLiteのPage size、EncodingなどのDatabase情報
- 行数・列数・Index・FK・PK有無を一覧できる「テーブル規模」
- 定義済みFKと推定リレーション
- 主キーがないテーブルや、FK列に対応するIndexが見当たらない場合などの確認候補
- `PRAGMA quick_check`

「テーブル規模」の行をクリックすると、そのテーブルをData Explorerで直接開けます。

### Data Explorer

- ナビゲーションまたはセレクターからTable / Viewを選択
- 100行単位でページング表示
- `NULL` やBLOBを元データを書き換えずに確認
- 選択したテーブルをCSV / JSONとして書き出し

### Schema & Relationships

SQLite Explorerでは、リレーションを2種類に分けて表示します。

- **Defined FK** — SQLiteに実際に定義されている外部キー
- **Inferred** — 列名、型の互換性、サンプル値の一致率から推定した関係候補

たとえばDB側にFOREIGN KEY制約がなくても、`orders.user_id` の値が `users.id` と高い割合で一致する場合、関係候補として提示できます。

定義済みFKはER図上で実線、推定リレーションは点線で表示し、推定側にはConfidenceを表示します。

**推定リレーションは探索を助けるための補助情報であり、実際の外部キーを保証するものではありません。**

### Column Profiler

**解析** からテーブルを選択すると、列ごとに以下を確認できます。

- SQLite type
- Primary Key
- NULL件数 / NULL率
- Distinct件数
- 出現回数の多い値

仕様書がないSQLiteファイルや、初めて見るDBのデータ構造を把握するときに便利です。

### SQL + Query Plan

SQL画面は読み取り専用です。

実行できる主なSQLは以下です。

- `SELECT`
- `WITH`
- `EXPLAIN`
- 明示的に許可している読み取り専用 `PRAGMA`

通常の `SELECT` / `WITH` では、結果と一緒に `EXPLAIN QUERY PLAN` を実行し、SQLiteがどのようにテーブルやIndexを参照する予定なのかを表示します。

#### キーボード操作

| ショートカット | 操作 |
| --- | --- |
| `Ctrl` / `⌘` + `Enter` | SQLを実行 |
| `Tab` | SQL Editorへスペース2個を挿入 |

## 読み取り専用設計

SQLite Explorer v1.0は、**知らないDBを安心して調べること**を優先して、意図的に読み取り専用にしています。

`INSERT`、`UPDATE`、`DELETE`、`CREATE`、`ALTER`、`DROP`、`REPLACE`、`VACUUM`、`ATTACH` など、DBを変更するSQLは実行前にブロックします。

また、読み取りSQLの後ろへ書き込みSQLをつなげる複文もチェックし、`SELECT ...; DELETE ...` のような入力で読み取り専用を回避できないようにしています。

元のSQLiteファイルへ書き戻す処理もありません。

## GitHub Pagesで公開する

このリポジトリには、固定した依存から完全内包HTMLをビルドし、GitHub Pagesへ公開するワークフローが含まれています。

1. リポジトリ名を `htmlapps-sqlite-explorer` としてGitHubへプッシュします。
2. **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選択します。
3. `main` ブランチへプッシュするか、Actions画面から **Deploy standalone app to GitHub Pages** を手動実行します。
4. ビルド成功後、`https://ttomohisa.github.io/htmlapps-sqlite-explorer/` で利用できます。

`main` へプッシュすると、固定バージョンの依存から `dist/index.html` を再生成し、単一HTMLとしての検証を通してからPagesへ公開します。

GitHub Pagesがまだ有効になっていない場合は、HTMLのビルド自体を失敗扱いにせず、PagesのデプロイだけをスキップしてWorkflow Summaryへ設定手順を表示します。

## 開発とビルド

```text
.
├─ src/index.template.html       # アプリ本体の正本
├─ app.config.json               # アプリ情報・ビルド設定
├─ dependencies.json             # 固定した外部依存
├─ build-standalone.bat          # Windows用ビルド入口
├─ build-standalone.ps1          # 完全内包HTML生成処理
├─ scripts/
│  ├─ check-repository.ps1       # リポジトリ・ビルド検証
│  ├─ verify-standalone.ps1      # 単一HTMLの検証
│  ├─ build-self-extract.ps1     # 自己解凍HTML生成
│  └─ verify-self-extract.ps1    # 自己解凍版の検証
├─ dist/
│  ├─ index.html                 # 生成される単一HTMLアプリ
│  ├─ index.self-extract.html    # 生成される自己解凍版
│  └─ dependency-manifest.json   # 依存ハッシュ・ビルド情報
└─ .github/workflows/
   ├─ build-standalone.yml       # Pull Request時のビルド検証
   └─ deploy-pages.yml           # mainからPagesへ自動公開
```

`src/index.template.html` が正本です。生成された `dist/index.html` を直接編集しないでください。

### ビルド

Windows 10 / 11で以下を実行します。

```bat
build-standalone.bat
```

依存キャッシュを破棄して再取得する場合：

```bat
build-standalone.bat -ForceDownload
```

PowerShellから実行する場合：

```powershell
.\build-standalone.ps1 -ForceDownload
```

自己解凍版を生成しない場合：

```powershell
.\build-standalone.ps1 -SkipSelfExtract
```

ビルド処理は以下を自動で行います。

- npmレジストリから固定バージョンの `sql.js` を取得
- 必要なasm.jsアセットを1つのHTMLへ内包
- パッケージと内包アセットのSHA-256をdependency manifestへ記録
- アプリ設定・ビルド情報のプレースホルダーを置換
- CSPで実行時通信が遮断されていることを検証
- 未置換プレースホルダーを検出した場合はビルド失敗
- `dist/index.html` を生成
- `dist/index.self-extract.html` を生成
- `dist/dependency-manifest.json` を生成

## プライバシーと通信防止

SQLite Explorerは、データベースの内容を端末内に留めることを前提に作っています。

- SQLite処理はHTMLへ内包した `sql.js` で実行
- 選択したSQLiteファイルはブラウザー内へ読み込み、このアプリからアップロードしない
- 実行に必要な外部ライブラリも配布HTMLへ内包
- Content Security Policyに `connect-src 'none'` を指定
- 生成された `dist/index.html` は `file://` から直接起動可能

GitHub Pages版では、最初にHTMLを表示するための通信は発生します。ただし、その後に選択したSQLiteファイルをこのアプリがサーバーへ送信する必要はありません。

ネットワークを完全に切った環境で使用する場合は、生成済みの `dist/index.html` をローカルで開いてください。

オフライン検証の考え方は [VERIFY_OFFLINE.md](VERIFY_OFFLINE.md) を確認してください。

## 制限事項

- `sql.js` はSQLiteファイル全体をブラウザーのメモリへ読み込みます。非常に大きなDBは端末・ブラウザーの利用可能メモリに依存し、遅くなったり開けない場合があります。
- 内包する `sql-asm.js` はビルド時にgzip圧縮し、ブラウザー内で展開します。単一HTML・完全オフラインの構成は変わりません。
- 大きなテーブルが多いDBでは、行数取得、Relationship inference、Column Profilerに時間がかかる場合があります。
- 推定リレーションは列名・型・サンプル値から計算するヒューリスティックです。Confidenceが高くても、本物の外部キーであることを保証しません。
- v1.0は読み取り専用です。レコード編集やSQLiteファイルへの変更保存には対応していません。
- 非常に大きなテーブルをCSV / JSONへ書き出す場合、ブラウザー内で出力データを生成するためメモリを多く使用します。
- BLOBは画像などとして詳細プレビューするのではなく、DB構造・テーブルデータの確認を中心にしています。
- SQLCipherなどで暗号化されたDBや、標準SQLiteではない独自形式には対応していません。
- テーブル数が非常に多いDBではER図が密集して見づらくなる場合があります。

## 使用ライブラリ

| ライブラリ | バージョン | ライセンス | 用途 |
| --- | ---: | --- | --- |
| sql.js | 1.14.1 | MIT | JavaScriptでSQLiteを動作させるエンジン。asm.js版を単一HTMLへ内包 |
| SQLite | sql.jsに含まれる | Public Domain | データベースエンジン |

単一HTMLから別の `.wasm` ファイルを読み込まなくて済むように、`sql.js` のasm.js版を使用しています。詳細は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を確認してください。

## コントリビューション

バグ報告や機能提案はGitHub Issuesからお願いします。開発への参加方法は [CONTRIBUTING.md](CONTRIBUTING.md) を確認してください。

## ライセンス

Copyright © 2026 ttomohisa

このプロジェクトは [MIT License](LICENSE) で公開されています。
