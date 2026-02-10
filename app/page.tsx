import PageBoard from '@/components/PageBoard';

export default function Home() {
  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 sm:mb-12">
          <h1
            className="text-2xl sm:text-4xl font-bold mb-2"
            style={{ color: 'var(--foreground)' }}
          >
            Markdown Board
          </h1>
          <p
            className="text-lg"
            style={{ color: 'var(--foreground)', opacity: 0.7 }}
          >
            共同編集できるMarkdownメモ
          </p>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--foreground)', opacity: 0.5 }}
          >
            URLを共有するだけで、誰でも一緒に編集できます
          </p>
        </header>
        <PageBoard />
      </div>
    </div>
  );
}
