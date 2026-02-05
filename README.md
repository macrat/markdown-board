# Markdown Board

A collaborative markdown editing board built with Next.js, SQLite, and Milkdown.

---

## プロダクトコンセプト

### ビジョン

**「悩む」から「考える」へ**

Markdown Board は、紙のノートやホワイトボードのように「深く考えずに様々なことを書き出せる」ミニマルなメモツールです。頭の中のモヤモヤを書き出すことで、「悩んでいる」状態から「考えている」状態へと変化する——その瞬間を生み出すことがこのプロダクトの価値です。

### コア哲学

#### 1. ノイズの排除
ユーザーの思考を妨げるあらゆるノイズを排除します：
- **UIの複雑さ**: ボタンやメニューは最小限に
- **保存・同期の意識**: 自動保存、シームレスな同期
- **フォーマットの強制**: 構造を強いらない、自由に書ける

#### 2. 即座に始められる
開いた瞬間から書き始められることが最重要です。学習コストをゼロに近づけ、何も考えずに使い始められる直感性を追求します。

#### 3. ミニマリズム
機能は必要最小限に。「あったら便利かも」は追加しない。本当に必要な機能だけを、美しいUIで提供します。

#### 4. リアルタイムの共有体験
複数人が同時に編集できることで、ホワイトボードを囲んでいるような体験を提供します。固定チームではなく、その場その場で柔軟にコラボレーションできることを重視します。

### Markdownを採用する理由

- **構造と自由のバランス**: 最低限の構造を提供しつつ、自由に書ける
- **軽量さ**: テキストベースでデータが軽く、扱いやすい
- **アクセシビリティ**: 知らなくても普通に使える、知っていればより便利に

### UIデザイン原則

- **余白と静謐**: 空白を大切にし、静かで落ち着いた印象
- **機能美**: 装飾ではなく、機能そのものが生み出す美しさ

---

## 開発ガイドライン

### やるべきこと（Do's）

- ✅ 開いた瞬間から使える即時性を守る
- ✅ 保存や同期をユーザーに意識させない設計
- ✅ 機能追加の前に「本当に必要か」を問う
- ✅ シンプルさを維持するためのコードレビュー
- ✅ ユーザーの思考の流れを妨げないUX

### やってはいけないこと（Don'ts）

- ❌ **機能の肥大化**: 「便利そう」という理由で機能を追加しない
- ❌ **カスタマイズ設定の追加**: ユーザーに選択を強いない
- ❌ **ワークフローの強制**: 特定の使い方を押し付けない
- ❌ **複雑な整理機能**: シンプルさを損なう階層化やタグ付けの過剰導入
- ❌ **学習を要するUI**: 説明が必要なインターフェースは設計の失敗

### ターゲットユーザー

- **メイン**: 個人での思考整理やメモ
- **サブ**: 2〜5人程度の柔軟なコラボレーション（固定チームより、その都度の共同作業）

---

## Features

- **Page Management**: Create, view, and organize markdown pages
- **Archive System**: Archive pages and automatically delete them after 30 days
- **WYSIWYG Markdown Editor**: Powered by Milkdown for a seamless editing experience
- **Collaborative Editing**: Built with Yjs for real-time collaboration (WebSocket server setup required)
- **Simple & Modern Design**: Clean interface with a custom color scheme
- **No Authentication**: Open access for anyone with the URL
- **UUIDv7**: Each page gets a unique, time-sortable ID

## Tech Stack

- **Next.js 16**: React framework with App Router
- **SQLite**: Lightweight database using better-sqlite3
- **Milkdown**: WYSIWYG markdown editor
- **Yjs**: CRDT for collaborative editing
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun

### Installation

1. Clone the repository:
```bash
git clone https://github.com/macrat/markdown-board.git
cd markdown-board
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

This will start both the Next.js application (port 3000) and the WebSocket server (port 1234) for collaborative editing.

4. Open [http://localhost:3000](http://localhost:3000) in your browser

The SQLite database will be automatically created in the `data/` directory on first run.

## Project Structure

```
markdown-board/
├── app/
│   ├── api/              # API routes
│   │   ├── pages/        # Page CRUD operations
│   │   └── archives/     # Archive management
│   ├── archives/         # Archive list page
│   ├── page/[id]/        # Individual page view
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout component
│   ├── milkdown.css      # Milkdown editor styles
│   └── page.tsx          # Home page
├── components/           # React components
│   ├── PageList.tsx      # Active pages list
│   ├── ArchiveList.tsx   # Archived pages list
│   └── MarkdownEditor.tsx # Milkdown editor
├── lib/
│   ├── db.ts            # Database connection
│   └── types.ts         # TypeScript types
├── server/
│   └── websocket.js     # WebSocket server for Yjs
├── scripts/
│   └── cleanup-archives.js # Scheduled cleanup script
└── data/                # SQLite database (auto-created)
```

## API Routes

- `GET /api/pages` - List all active pages
- `POST /api/pages` - Create a new page
- `GET /api/pages/[id]` - Get a specific page
- `PATCH /api/pages/[id]` - Update a page
- `DELETE /api/pages/[id]` - Delete a page
- `POST /api/pages/[id]/archive` - Archive a page
- `POST /api/pages/[id]/unarchive` - Unarchive a page
- `GET /api/archives` - List all archived pages
- `DELETE /api/archives` - Delete archives older than 30 days

## Archive Cleanup

To automatically clean up archives older than 30 days, you can set up a cron job:

```bash
# Run cleanup daily at 2 AM
0 2 * * * cd /path/to/markdown-board && node scripts/cleanup-archives.js
```

Or use the API endpoint directly:
```bash
curl -X DELETE http://localhost:3000/api/archives
```

## Color Scheme

- **Background**: `#f5eae6`
- **Text**: `#574a46`
- **Accent**: `#c42776`
- **Accent Light**: `#e893c2`

## Collaborative Editing

Real-time collaborative editing is enabled out of the box! The WebSocket server for Yjs runs automatically when you start the application.

- **Development**: WebSocket server runs on `ws://localhost:1234`
- **Production**: WebSocket server runs alongside the Next.js app

Multiple users can edit the same page simultaneously, and changes will be synchronized in real-time across all connected clients.

## Building for Production

```bash
npm run build
npm start
```

The `npm start` command will start both the Next.js production server and the WebSocket server for collaborative editing.

## License

MIT

## Author

macrat
