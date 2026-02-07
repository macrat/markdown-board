# ADR-0005: 共同編集カーソル付近の ProseMirror-separator を CSS で非表示にする

## ステータス

決定済み (2026-02-07)

## コンテキスト

ADR-0004 にてカスタム `cursorBuilder` を導入し、y-prosemirror のデフォルト実装が生成する不要なDOM要素（word joiner文字、ユーザー名div）を排除した。しかし、E2Eテストにより、カスタム `cursorBuilder` だけでは空行の高さが倍増する問題が完全に解消しないことが判明した。

### 残存する問題の原因

ProseMirror（prosemirror-view）は、テキストブロック末尾の `contentEditable="false"` 要素に対して、Chrome/Safari のカーソル描画バグ回避のためのハック要素 `<img class="ProseMirror-separator">` を自動挿入する（`viewdesc.ts` の `addTextblockHacks()`）。

y-prosemirror のカーソルウィジェットは `Decoration.widget()` で生成されるが、spec に `raw: true` が指定されていないため、ProseMirror が自動的に `contentEditable="false"` を付与する。リモートカーソルが行末や空行にあるとき、このウィジェットがテキストブロックの末尾子要素となり、separator が挿入される。結果として段落の高さが倍増する。

```
カーソルが行末にあるときのDOM:
<p>
  "テキスト"
  <span class="ProseMirror-yjs-cursor" contenteditable="false"></span>
  <img class="ProseMirror-separator" alt="">   ← これが高さを壊す
  <br class="ProseMirror-trailingBreak">
</p>
```

### 根本対処が困難な理由

根本原因は y-prosemirror の `createDecorations` 関数内で `Decoration.widget()` の spec に `raw: true` が渡されていないことにある。しかし、このオプションは y-prosemirror の API では公開されておらず、`@milkdown/plugin-collab` 経由でも設定できない。

根本的に対処するには以下のいずれかが必要だが、いずれもメンテナンスコストが高い:

1. **独自カーソルプラグインの実装**: y-prosemirror の `createDecorations` 相当のコード（約60行）を自前で持つ必要があり、y-prosemirror の更新への追従が必要になる
2. **patch-package によるパッチ**: 外部ツールへの依存が増え、パッケージ更新時にパッチの整合性を確認する必要がある
3. **y-prosemirror への PR**: マージまでの期間が不確定

## 決定

CSS の隣接兄弟セレクタで、共同編集カーソル直後の `img.ProseMirror-separator` を `display: none` にする。これは ADR-0004 の「CSSワークアラウンドは使用しない」方針の例外とする。

```css
.milkdown .ProseMirror-yjs-cursor + img.ProseMirror-separator {
  display: none;
}
```

## 理由

### ADR-0004 の方針は原則として正しいが、このケースには当てはまらない

ADR-0004 が退けた CSS ワークアラウンドは「複数の CSS プロパティの複雑な組み合わせ（`visibility: hidden` + `line-height: 0` + `height: 0`）で症状を隠す」というものだった。今回の対処は単一プロパティ `display: none` を隣接兄弟セレクタで限定的に適用するだけであり、複雑な相互作用のリスクが低い。

### 根本対処の代償がワークアラウンドの欠点を上回る

独自プラグインの実装やパッチの維持は、CSS 1ルールと比較して明らかにメンテナンスコストが高い。シンプルさを重視するプロジェクト方針（AGENTS.md）に照らしても、最小限の変更で問題を解消できる CSS アプローチが適切である。

### 影響範囲が限定的で安全性が高い

`ProseMirror-separator` は Chrome/Safari で `contentEditable="false"` 要素付近のカーソル描画を補助するためのハック要素である。非表示にする対象は「共同編集カーソル（`.ProseMirror-yjs-cursor`）の直後」に限定されており、通常のインライン非編集要素の separator には影響しない。共同編集カーソルはユーザーが直接操作する要素ではないため（`pointer-events: none`）、この separator を非表示にしても編集体験に悪影響はない。

## 影響

- `milkdown.css` に CSS ルール 1 件を追加する
- ADR-0004 で削除した trailing break 用の CSS ワークアラウンドとは異なり、本ルールは独立して機能する
- 将来 y-prosemirror が `Decoration.widget` の spec に `raw` オプションを渡すようになった場合、この CSS ルールは不要になる（separator 自体が生成されなくなるため）
