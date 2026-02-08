# ADR-0007: Yjs Persistence with LevelDB

## Status

Accepted

## Context

サーバーを再起動すると、ページ内のデータが消えてしまう問題が発生していた。ページ一覧の表示はそのままで、ページコンテンツだけが復元できないという状態だった。

### 問題の原因

1. Yjsドキュメント（共同編集のためのCRDTデータ構造）はWebSocketサーバーのメモリ上にのみ存在していた
2. サーバー再起動時に、Yjsドキュメントがすべて失われる
3. SQLiteにはエディタの変更が1秒のデバウンス後に保存されるが、以下の問題があった：
   - デバウンス中にサーバーが再起動すると、最新の編集内容が失われる
   - Yjsドキュメントが空の状態で起動するため、SQLiteの内容を初期値として使用する仕組みが必要

### データフロー

**変更前:**

```
クライアント編集 → Yjs(メモリ) → (1秒デバウンス) → SQLite
サーバー再起動 → Yjs消失 → SQLiteから復元（デバウンス中の変更は消失）
```

**変更後:**

```
クライアント編集 → Yjs(メモリ + LevelDB) → (1秒デバウンス) → SQLite
サーバー再起動 → LevelDBからYjs復元 → データ保持
```

## Decision

`@y/websocket-server` パッケージが提供する組み込みのLevelDB永続化機能を有効化することにした。

### 実装内容

1. **環境変数の追加**: `YPERSISTENCE` 環境変数を設定することで、Yjsドキュメントを指定ディレクトリに永続化
2. **npm scriptsの更新**: `dev` と `start` コマンドで `YPERSISTENCE=.yjs` を設定
3. **.gitignoreの更新**: `.yjs` ディレクトリを除外対象に追加
4. **ドキュメントの更新**: `.env.example` と README.md に永続化設定を追加

### 技術的な詳細

- `@y/websocket-server` は `y-leveldb` パッケージを内部で使用
- 環境変数 `YPERSISTENCE` が設定されている場合、自動的にLevelDB永続化を有効化
- Yjsドキュメントの更新は即座にLevelDBに書き込まれる
- サーバー起動時、既存のYjsドキュメントがLevelDBから自動的に復元される

## Consequences

### Positive

- サーバー再起動時にページ内容が保持される
- デバウンス中の編集内容も失われない
- 既存の `@y/websocket-server` の機能を活用するため、追加のコードは最小限
- パフォーマンスへの影響は軽微（LevelDBは高速）

### Negative

- ディスクスペースの使用量が増加（ただし、Yjsドキュメントは圧縮されているため軽量）
- `.yjs` ディレクトリの管理が必要（バックアップ、クリーンアップ等）
- ローカル開発環境では `.yjs` ディレクトリが作成される（.gitignoreで除外済み）

### Trade-offs

- **SQLite vs LevelDB 2重永続化**: 現在、YjsドキュメントはLevelDBに、マークダウンテキストはSQLiteに保存される。SQLiteはマークダウンの検索や一覧表示に使用されるため、両方の永続化層が必要
- **代替案の検討**: すべてをSQLiteに統合することも考えられたが、`@y/websocket-server` のLevelDB統合が既に存在し、十分に安定しているため、既存の実装を活用する方が適切と判断

## Notes

- この変更は既存のE2Eテスト「should restore content from SQLite after server restart」をパスする
- LevelDBディレクトリのクリーンアップやバックアップ戦略については、将来的に検討が必要
