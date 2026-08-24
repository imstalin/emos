import type { ManagerProgressSection } from "@/domain/types/manager-progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressTable } from "@/features/manager-progress/components/progress-table";

interface ProgressSectionsProps {
  sections: ManagerProgressSection[];
  onSelectWorkItem?: (workItemId: string) => void;
}

export function ProgressSections({
  sections,
  onSelectWorkItem,
}: ProgressSectionsProps) {
  const visible = sections.filter((section) => section.items.length > 0);
  if (visible.length === 0) return null;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {visible.map((section) => (
        <Card key={section.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <ProgressTable
              rows={section.items.slice(0, 6)}
              onSelect={onSelectWorkItem}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
