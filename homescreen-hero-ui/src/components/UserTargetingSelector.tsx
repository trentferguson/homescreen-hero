import { Listbox } from "@headlessui/react";
import { Check, ChevronDown, Loader2, Users } from "lucide-react";
import type { PlexUser } from "../hooks/useTargetableUsers";

type Props = {
    mode: "everyone" | "specific";
    selectedUsernames: string[];
    users: PlexUser[];
    loading: boolean;
    onModeChange: (mode: "everyone" | "specific") => void;
    onSelectionChange: (usernames: string[]) => void;
};

export function UserTargetingSelector({
    mode,
    selectedUsernames,
    users,
    loading,
    onModeChange,
    onSelectionChange,
}: Props) {
    const selectedCount = selectedUsernames.length;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <label className="text-base font-medium text-white">Audience</label>
            </div>
            <p className="text-xs text-slate-400">Choose who can see collections from this group.</p>

            {/* Everyone / Specific Users toggle */}
            <div className="grid grid-cols-2 gap-2">
                {(["everyone", "specific"] as const).map((opt) => {
                    const isSelected = mode === opt;
                    const label = opt === "everyone" ? "Everyone" : "Specific Users";
                    return (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => onModeChange(opt)}
                            className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 transition-all duration-200 ${
                                isSelected
                                    ? "border-primary bg-primary/15"
                                    : "border-slate-700 bg-slate-900 hover:border-slate-600"
                            }`}
                        >
                            <span className={`text-sm font-medium ${isSelected ? "text-white" : "text-slate-300"}`}>
                                {label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Multi-select dropdown (animated expand/collapse) */}
            <div
                className={`grid transition-all duration-300 ease-in-out ${
                    mode === "specific" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
            >
                <div className={mode === "specific" ? "overflow-visible" : "overflow-hidden"}>
                    <div className="pt-1">
                        {loading ? (
                            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5">
                                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                <span className="text-sm text-slate-400">Loading users...</span>
                            </div>
                        ) : (
                            <Listbox
                                value={selectedUsernames}
                                onChange={onSelectionChange}
                                multiple
                            >
                                <div className="relative">
                                    <Listbox.Button className="flex items-center gap-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/70 transition-colors">
                                        <span className="flex-1 text-left">
                                            {selectedCount === 0
                                                ? <span className="text-slate-500">No users selected</span>
                                                : `${selectedCount} user${selectedCount === 1 ? "" : "s"} selected`
                                            }
                                        </span>
                                        <ChevronDown className="h-4 w-4 text-slate-400" />
                                    </Listbox.Button>
                                    <Listbox.Options className="absolute left-0 z-10 mt-1 w-full max-h-48 overflow-y-auto scrollbar-thin rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg focus:outline-none">
                                        {users.length === 0 ? (
                                            <div className="px-3 py-2 text-sm text-slate-400">No users found</div>
                                        ) : (
                                            users.map((user) => (
                                                <Listbox.Option
                                                    key={user.id}
                                                    value={user.username}
                                                    className="cursor-pointer px-3 py-2 text-sm text-white hover:bg-slate-700 flex items-center gap-2.5"
                                                >
                                                    {user.thumb ? (
                                                        <img
                                                            src={user.thumb}
                                                            alt=""
                                                            className="h-6 w-6 rounded-full object-cover shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="h-6 w-6 rounded-full bg-slate-600 flex items-center justify-center shrink-0">
                                                            <span className="text-xs text-slate-300">
                                                                {(user.title || user.username).charAt(0).toUpperCase()}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <span className="flex-1 truncate">
                                                        {user.title || user.username}
                                                    </span>
                                                    {selectedUsernames.includes(user.username) && (
                                                        <Check className="h-4 w-4 text-primary shrink-0" />
                                                    )}
                                                </Listbox.Option>
                                            ))
                                        )}
                                    </Listbox.Options>
                                </div>
                            </Listbox>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
