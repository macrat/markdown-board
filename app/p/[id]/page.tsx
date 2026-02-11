import MarkdownEditor from '@/components/MarkdownEditor';

export default async function PageView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <MarkdownEditor pageId={id} />;
}
