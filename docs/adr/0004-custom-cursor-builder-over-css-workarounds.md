# ADR-0004: 共同編集カーソルの空行問題にカスタムcursorBuilderで対処する

## ステータス

決定済み (2026-02-07)

## コンテキスト

GitHub Issue #69 にて、他のユーザーのカーソルが空行にあるとき、その行の下に不自然な空白が発生する問題が報告された。

原因は y-prosemirror の `defaultCursorBuilder` が生成するカーソル要素の構造にある。デフォルト実装は以下のDOM要素を生成する:

```html
<span class="ProseMirror-yjs-cursor">
  "\u2060"
  <!-- word joiner文字 -->
  <div>ユーザー名</div>
  "\u2060"
  <!-- word joiner文字 -->
</span>
```

このプロジェクトではユーザー名ラベルを表示しない方針（ADR-0003）のため、内部の `<div>` はCSSで `display: none` にしていた。しかし、word joiner文字はテキストコンテンツとして残るため、空行においてProseMirrorの trailing break（`<br>`）と干渉し、段落の高さが通常より大きくなっていた。

この問題に対して、以下の2つのアプローチが考えられた:

1. **CSSワークアラウンド**: trailing breakに `visibility: hidden; line-height: 0; height: 0` や `display: none` を適用して症状を抑える
2. **カスタムcursorBuilder**: `@milkdown/plugin-collab` の `yCursorOpts` を通じて、問題の原因となるDOM要素を生成しないカーソルビルダーを提供する

## 決定

カスタム `cursorBuilder` による根本的な対処を採用する。CSSワークアラウンドは使用しない。

## 理由

### 小手先の対応はコードの見通しを悪くする

CSSワークアラウンドは「ライブラリが生成する不要なDOM要素を後からCSSで隠す」というアプローチであり、コードの意図が読み取りにくくなる。なぜ特定の要素を隠す必要があるのか、なぜ `display: none` でなければならないのか（`visibility: hidden` では不十分なのか）といった背景知識がなければ、将来メンテナンスする際に理解が困難になる。

### CSSの複雑な動作はUXを悪化させるリスクがある

`visibility: hidden` と `line-height: 0` の組み合わせのように、CSSプロパティの複雑な相互作用に依存する対処は、ブラウザごとの挙動差やレンダリングパフォーマンスへの悪影響が懸念される。ユーザーの思考を妨げない滑らかな動作を保つためには、レンダリング処理を不必要に複雑にすべきではない。

### 根本原因を断つことでCSSルールも削減できる

カスタム `cursorBuilder` で不要なDOM要素の生成自体を止めることで、ユーザー名 `<div>` を隠すCSSルール、trailing breakを補正するCSSルールの両方が不要になる。結果として、コードの総量が減り、CSSとDOMの関係がシンプルになる。

## 影響

- `MarkdownEditor.tsx` で `collabService.mergeOptions()` を通じてカスタム `cursorBuilder` を設定する
- カーソル要素は `ProseMirror-yjs-cursor` クラスのみを持つ最小限の `<span>` となる
- カーソルの見た目（色、太さ、位置）は従来通りCSSクラスで制御する
- trailing breakやユーザー名divに対するCSSワークアラウンドは全て削除する
