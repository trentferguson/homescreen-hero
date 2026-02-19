import { useState } from "react";
import { fetchWithAuth } from "../utils/api";
import { Check, X, ShieldCheck, ShieldEllipsis, User, Trash2 } from "lucide-react";
import { ConfirmDialog } from "./ui/confirm-dialog";

type UserListItem = {
    id: number;
    plex_username: string | null;
    plex_email: string | null;
    plex_thumb: string | null;
    role: string;
    status: string;
    created_at: string;
    last_login_at: string | null;
};

interface UserRowProps {
    user: UserListItem;
    currentUsername: string | null;
    onUpdate: () => void;
}

export default function UserRow({ user, currentUsername, onUpdate }: UserRowProps) {
    const [loading, setLoading] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<{
        title: string;
        description: string;
        confirmLabel: string;
        variant: "danger" | "warning" | "default";
        onConfirm: () => void;
    } | null>(null);

    const isSelf = user.plex_username === currentUsername;
    const isPending = user.status === "pending";
    const displayName = user.plex_username || "this user";

    async function updateUser(body: Record<string, string>) {
        setLoading(true);
        try {
            const r = await fetchWithAuth(`/api/auth/users/${user.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!r.ok) {
                const err = await r.json().catch(() => ({ detail: "Failed" }));
                alert(err.detail || "Failed to update user");
                return;
            }
            onUpdate();
        } finally {
            setLoading(false);
        }
    }

    async function deleteUser() {
        setLoading(true);
        try {
            const r = await fetchWithAuth(`/api/auth/users/${user.id}`, { method: "DELETE" });
            if (!r.ok) {
                const err = await r.json().catch(() => ({ detail: "Failed" }));
                alert(err.detail || "Failed to remove user");
                return;
            }
            onUpdate();
        } finally {
            setLoading(false);
        }
    }

    function confirmRoleChange() {
        const newRole = user.role === "admin" ? "user" : "admin";
        const isPromotion = newRole === "admin";
        setConfirmDialog({
            title: isPromotion ? `Promote ${displayName}?` : `Demote ${displayName}?`,
            description: isPromotion
                ? `This will give ${displayName} full admin access to the dashboard.`
                : `This will remove admin access from ${displayName}. They will only have basic user access.`,
            confirmLabel: isPromotion ? "Promote to Admin" : "Demote to User",
            variant: isPromotion ? "warning" : "default",
            onConfirm: () => updateUser({ role: newRole }),
        });
    }

    function confirmDelete() {
        setConfirmDialog({
            title: isPending ? `Deny ${displayName}?` : `Remove ${displayName}?`,
            description: isPending
                ? `This will deny access for ${displayName}. They will need to sign in again if you change your mind.`
                : `This will remove ${displayName} and revoke their access. They will be signed out immediately.`,
            confirmLabel: isPending ? "Deny Access" : "Remove User",
            variant: "danger",
            onConfirm: deleteUser,
        });
    }

    // Format relative time
    const lastLogin = user.last_login_at
        ? new Date(user.last_login_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
        : "Never";

    return (
        <>
            <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                isPending
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-slate-700/50 bg-slate-800/30"
            } ${loading ? "opacity-50 pointer-events-none" : ""}`}>
                {/* Avatar */}
                {user.plex_thumb ? (
                    <img
                        src={user.plex_thumb}
                        alt={user.plex_username || "User"}
                        className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                    />
                ) : (
                    <div className="h-9 w-9 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-slate-300">
                            {(user.plex_username || "?")[0].toUpperCase()}
                        </span>
                    </div>
                )}

                {/* Name + email */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-100 truncate">
                            {user.plex_username || "Unknown"}
                        </span>
                        {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">You</span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                        Last login: {lastLogin}
                    </p>
                </div>

                {/* Status badge (pending only) */}
                {isPending && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium flex-shrink-0">
                        Pending
                    </span>
                )}

                {/* Role badge (display only) */}
                <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    user.role === "admin"
                        ? "bg-blue-500/15 text-blue-400"
                        : "bg-slate-700/50 text-slate-400"
                }`}>
                    {user.role === "admin" ? <ShieldCheck size={12} /> : <User size={12} />}
                    {user.role === "admin" ? "Admin" : "User"}
                </span>

                {/* Actions */}
                {!isSelf && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {isPending && (
                            <button
                                type="button"
                                onClick={() => updateUser({ status: "approved" })}
                                title="Approve user"
                                className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-500/10 transition"
                            >
                                <Check size={15} />
                            </button>
                        )}
                        {!isPending && (
                            <button
                                type="button"
                                onClick={confirmRoleChange}
                                title={user.role === "admin" ? "Demote to user" : "Promote to admin"}
                                className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700/50 transition"
                            >
                                <ShieldEllipsis size={14} />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={confirmDelete}
                            title={isPending ? "Deny user" : "Remove user"}
                            className="p-1.5 rounded-md text-rose-400 hover:bg-rose-500/10 transition"
                        >
                            {isPending ? <X size={15} /> : <Trash2 size={14} />}
                        </button>
                    </div>
                )}
            </div>

            {/* Confirmation dialog */}
            {confirmDialog && (
                <ConfirmDialog
                    open={!!confirmDialog}
                    onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}
                    title={confirmDialog.title}
                    description={confirmDialog.description}
                    confirmLabel={confirmDialog.confirmLabel}
                    variant={confirmDialog.variant}
                    onConfirm={() => {
                        confirmDialog.onConfirm();
                        setConfirmDialog(null);
                    }}
                />
            )}
        </>
    );
}
