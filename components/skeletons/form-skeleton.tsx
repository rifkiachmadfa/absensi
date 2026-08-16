import { Skeleton } from "@/components/ui/skeleton";
import { FormFieldsSkeleton } from "./form-fields-skeleton";

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <FormFieldsSkeleton fields={fields} />
    </div>
  );
}