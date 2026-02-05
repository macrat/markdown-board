# Markdown Board

A collaborative markdown editing board built with Next.js, SQLite, and Milkdown.

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
│   └── page.tsx          # Home page
├── components/           # React components
│   ├── PageList.tsx      # Active pages list
│   ├── ArchiveList.tsx   # Archived pages list
│   └── MarkdownEditor.tsx # Milkdown editor
├── lib/
│   ├── db.ts            # Database connection
│   └── types.ts         # TypeScript types
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

## Collaborative Editing (Optional)

To enable real-time collaborative editing, you need to set up a WebSocket server for Yjs. Uncomment the WebSocket provider code in `components/MarkdownEditor.tsx` and set up a WebSocket server (e.g., using `y-websocket` server).

## Building for Production

```bash
npm run build
npm start
```

## License

MIT

## Author

macrat
