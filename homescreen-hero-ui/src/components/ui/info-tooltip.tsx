import { Info } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";

export function InfoTooltip({ text }: { text: string }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button type="button" className="text-slate-500 hover:text-slate-300 transition-colors">
                    <Info className="h-3.5 w-3.5" />
                </button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-auto max-w-56 px-3 py-2">
                <p className="text-xs text-slate-300">{text}</p>
            </PopoverContent>
        </Popover>
    );
}
