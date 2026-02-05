import PageList from '@/components/PageList';

export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#574a46' }}>
            Markdown Board
          </h1>
          <p className="text-lg" style={{ color: '#574a46', opacity: 0.7 }}>
            Collaborative markdown editing
          </p>
        </header>
        <PageList />
      </div>
    </div>
  );
}
