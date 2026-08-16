import { Skeleton } from "@/components/ui/skeleton";

export function FormFieldsSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="max-w-lg space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-9 w-32" />
    </div>
  );
}