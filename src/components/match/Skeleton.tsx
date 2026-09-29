import { Skeleton } from "../ui.tsx";

/** Placeholder da lista de partidas enquanto carrega pela primeira vez. */
export function MatchListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando partidas"
      className="mt-4 rounded-2xl border border-border bg-surface shadow-card overflow-hidden divide-y divide-border"
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-7 w-10" />
          <div className="flex-1 flex items-center justify-center gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>
      ))}
    </div>
  );
}
