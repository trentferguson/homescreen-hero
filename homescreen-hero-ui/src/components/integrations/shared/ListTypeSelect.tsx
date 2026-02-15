import { Listbox } from "@headlessui/react";
import { Check, ChevronDown, Loader2 } from "lucide-react";

export interface ListTypeOption {
    value: string;
    label: string;
    is_custom?: boolean;
}

const DEFAULT_LIST_TYPES: ListTypeOption[] = [
    { value: "", label: "All Lists" },
    { value: "watching", label: "Watching" },
    { value: "completed", label: "Completed" },
    { value: "planning", label: "Planning" },
    { value: "paused", label: "Paused" },
    { value: "dropped", label: "Dropped" },
];

interface ListTypeSelectProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    options?: ListTypeOption[];
    loading?: boolean;
    showAllOption?: boolean;
}

export function ListTypeSelect({ value, onChange, disabled, options, loading, showAllOption = true }: ListTypeSelectProps) {
    // Use dynamic options if provided, otherwise fall back to defaults
    const allOption: ListTypeOption = { value: "", label: "All Lists" };
    const listOptions = options
        ? (showAllOption ? [allOption, ...options] : options)
        : DEFAULT_LIST_TYPES;

    const selected = listOptions.find((t) => t.value === value);

    return (
        <Listbox value={value} onChange={onChange} disabled={disabled || loading}>
            <div className="relative w-40">
                <Listbox.Button className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70 disabled:opacity-60 flex items-center justify-between">
                    <span className={value !== undefined ? "text-slate-100" : "text-slate-500"}>
                        {loading ? "Loading…" : (selected?.label ?? "All Lists")}
                    </span>
                    {loading ? (
                        <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                </Listbox.Button>
                <Listbox.Options anchor="bottom start" className="z-50 mt-1 w-[var(--button-width)] min-w-max rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-lg focus:outline-none max-h-60 overflow-auto">
                    {listOptions.map((type) => (
                        <Listbox.Option
                            key={type.value}
                            value={type.value}
                            className="cursor-pointer px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 data-[selected]:bg-primary/20 data-[selected]:font-semibold flex items-center justify-between gap-3"
                        >
                            {({ selected: isSelected }) => (
                                <>
                                    <span>
                                        {type.label}
                                        {type.is_custom && (
                                            <span className="ml-1.5 text-[10px] text-slate-500">custom</span>
                                        )}
                                    </span>
                                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                                </>
                            )}
                        </Listbox.Option>
                    ))}
                </Listbox.Options>
            </div>
        </Listbox>
    );
}
