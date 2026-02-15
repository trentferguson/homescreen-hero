import { Listbox } from "@headlessui/react";
import { Check, ChevronDown } from "lucide-react";
import type { PlexLibraryConfig } from "../../../types/integrations";

interface LibrarySelectProps {
    value: string;
    onChange: (value: string) => void;
    libraries: PlexLibraryConfig[];
    disabled?: boolean;
}

export function LibrarySelect({ value, onChange, libraries, disabled }: LibrarySelectProps) {
    return (
        <Listbox value={value} onChange={onChange} disabled={disabled}>
            <div className="relative w-44">
                <Listbox.Button className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/70 disabled:opacity-60 flex items-center justify-between">
                    <span className={value ? "text-slate-100" : "text-slate-500"}>
                        {value || "Select Plex library"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                </Listbox.Button>
                <Listbox.Options anchor="bottom start" className="z-50 mt-1 w-[var(--button-width)] rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-lg focus:outline-none max-h-60 overflow-auto">
                    {libraries.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-500">
                            No enabled Plex libraries configured.
                        </div>
                    ) : (
                        libraries.map((lib) => (
                            <Listbox.Option
                                key={lib.name}
                                value={lib.name}
                                className="cursor-pointer px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 data-[selected]:bg-primary/20 data-[selected]:font-semibold flex items-center justify-between"
                            >
                                {({ selected }) => (
                                    <>
                                        <span>{lib.name}</span>
                                        {selected && <Check className="h-4 w-4 text-primary" />}
                                    </>
                                )}
                            </Listbox.Option>
                        ))
                    )}
                </Listbox.Options>
            </div>
        </Listbox>
    );
}
