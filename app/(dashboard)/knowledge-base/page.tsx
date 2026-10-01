import { ArticleForm } from "@/components/phase5/forms";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPhase5Context } from "@/lib/db/phase5";
import { visibleArticles } from "@/lib/phase5/domain";

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const { user, state } = await getPhase5Context();
  const profile = state.profiles.find((item) => item.id === user.id);
  const articles = profile ? visibleArticles(state.knowledgeBaseArticles, profile) : [];
  const filtered = articles.filter((article) => {
    const matchesQuery = !q || `${article.title} ${article.summary ?? ""} ${article.content}`.toLowerCase().includes(q.toLowerCase());
    const matchesCategory = !category || article.categoryId === category;
    return matchesQuery && matchesCategory;
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Knowledge base" description="Policies, training, and how-to articles filtered by audience." />
      <form className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
        <input name="q" defaultValue={q} placeholder="Search articles" className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
        <select name="category" defaultValue={category} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">All categories</option>
          {state.knowledgeBaseCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground">Search</button>
      </form>
      {user.permissions.includes("knowledge.manage") ? (
        <Card>
          <CardHeader><CardTitle>Publish article</CardTitle></CardHeader>
          <CardContent><ArticleForm categories={state.knowledgeBaseCategories} /></CardContent>
        </Card>
      ) : null}
      {filtered.map((article) => (
        <Card key={article.id}>
          <CardHeader><CardTitle>{article.title}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{state.knowledgeBaseCategories.find((item) => item.id === article.categoryId)?.name} · {article.updatedAt.slice(0, 10)}</p>
            <p>{article.summary}</p>
            <p className="whitespace-pre-wrap">{article.content}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
