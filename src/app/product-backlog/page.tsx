import { AppShell } from "@/components/layout/app-shell";
import { ProductBacklogView } from "@/features/product-backlog/components/product-backlog-view";
import type { ProductBacklogTab } from "@/domain/types/product-backlog";
import { productBacklogService } from "@/server/services/product-backlog/product-backlog.service";

interface ProductBacklogPageProps {
  searchParams: Promise<{ tab?: string }>;
}

function parseTab(tab: string | undefined): ProductBacklogTab {
  if (tab === "defects") return "defects";
  return "tasks";
}

export default async function ProductBacklogPage({
  searchParams,
}: ProductBacklogPageProps) {
  const params = await searchParams;
  const data = await productBacklogService.getData();

  return (
    <AppShell>
      <ProductBacklogView data={data} initialTab={parseTab(params.tab)} />
    </AppShell>
  );
}
