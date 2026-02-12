import EditorErrorBoundary from '@/components/EditorErrorBoundary';
import MarkdownEditor from '@/components/MarkdownEditor';

export default async function PageView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <EditorErrorBoundary>
      <MarkdownEditor pageId={id} />
    </EditorErrorBoundary>
  );
}
