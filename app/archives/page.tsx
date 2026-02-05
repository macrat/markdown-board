import ArchiveList from '@/components/ArchiveList';

export default function ArchivesPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#574a46' }}>
            Archived Pages
          </h1>
          <p className="text-lg" style={{ color: '#574a46', opacity: 0.7 }}>
            Archives are kept for 30 days
          </p>
        </header>
        <ArchiveList />
      </div>
    </div>
  );
}
