import type { SyncStatus } from "../../../types/integrations";

interface SyncStatusBadgeProps {
    status: SyncStatus;
}

export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
    switch (status) {
        case "success":
            return (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900/50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-100 border border-emerald-700">
                    Success
                </span>
            );
        case "error":
            return (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-900/50 px-1.5 py-0.5 text-[10px] font-medium text-rose-100 border border-rose-700">
                    Error
                </span>
            );
        case "pending":
            return (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-900/50 px-1.5 py-0.5 text-[10px] font-medium text-amber-100 border border-amber-700">
                    Pending
                </span>
            );
        case "never_synced":
        default:
            return (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/50 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 border border-slate-700">
                    Never Synced
                </span>
            );
    }
}
