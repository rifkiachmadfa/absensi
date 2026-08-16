import { Skeleton } from "@/components/ui/skeleton";
import { FormFieldsSkeleton } from "./form-fields-skeleton";

export function DetailSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
      <div className="rounded-lg border p-4">
        <Skeleton className="mb-4 h-4 w-32" />
        <FormFieldsSkeleton fields={fields} />
      </div>
    </div>
  );
}