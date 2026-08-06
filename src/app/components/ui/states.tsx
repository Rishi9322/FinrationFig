import { ReactNode } from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Skeleton } from "./skeleton";

/**
 * Shared empty / loading / error states.
 *
 * These exist so a failed fetch can't render as an empty list, and a pending
 * one can't render as a bare spinner. Surfaces vary (dark customer app, light
 * admin), so colours come from `currentColor` and the caller's text colour
 * rather than being hardcoded per theme.
 */

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <Icon className="h-8 w-8 opacity-40" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-xs opacity-70 max-w-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <AlertCircle className="h-8 w-8 text-red-500" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-xs opacity-70 max-w-sm">{description}</p>}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border border-current/20 hover:bg-current/5 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * Skeleton rows rather than a spinner — a spinner communicates "wait",
 * a skeleton communicates "here is the shape of what is arriving", which
 * reads as faster even at identical latency.
 */
export function TableLoadingState({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="p-4 space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
