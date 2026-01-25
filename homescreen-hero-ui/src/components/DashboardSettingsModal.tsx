import { Switch } from "@headlessui/react";
import { RotateCcw } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogCloseButton,
} from "./ui/dialog";
import {
    sectionInfo,
    getWidgetsBySection,
    STATUS_BAR_MAX_WIDGETS,
    type WidgetSection,
} from "../widgets/registry";

interface DashboardSettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    visibilityMap: Record<string, boolean>;
    onToggle: (widgetId: string) => void;
    onReset: () => void;
    isWidgetAvailable: (widgetId: string) => boolean;
    canEnableWidget: (widgetId: string) => boolean;
    enabledStatusBarCount: number;
}

export default function DashboardSettingsModal({
    open,
    onOpenChange,
    visibilityMap,
    onToggle,
    onReset,
    isWidgetAvailable,
    canEnableWidget,
    enabledStatusBarCount,
}: DashboardSettingsModalProps) {
    const widgetsBySection = getWidgetsBySection();

    // Sort sections by their defined order
    const sortedSections = (Object.keys(widgetsBySection) as WidgetSection[]).sort(
        (a, b) => sectionInfo[a].order - sectionInfo[b].order
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <div className="flex-1">
                        <DialogTitle>Dashboard Widgets</DialogTitle>
                        <DialogDescription>
                            Choose which widgets to display on your dashboard
                        </DialogDescription>
                    </div>
                    <DialogCloseButton />
                </DialogHeader>

                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-hover-only">
                    {sortedSections.map((section) => {
                        const widgets = widgetsBySection[section];
                        if (widgets.length === 0) return null;

                        const isStatusBar = section === "status-bar";

                        return (
                            <div key={section}>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                                        {sectionInfo[section].label}
                                    </h3>
                                    {isStatusBar && (
                                        <span className="text-xs text-slate-500">
                                            {enabledStatusBarCount}/{STATUS_BAR_MAX_WIDGETS} slots used
                                        </span>
                                    )}
                                </div>
                                {sectionInfo[section].description && (
                                    <p className="text-xs text-slate-500 mb-3 -mt-1">
                                        {sectionInfo[section].description}
                                    </p>
                                )}
                                <div className="space-y-2">
                                    {widgets.map((widget) => {
                                        const isAvailable = isWidgetAvailable(widget.id);
                                        const isVisible = visibilityMap[widget.id] ?? false;
                                        const canEnable = canEnableWidget(widget.id);

                                        // Widget is disabled if: not available OR (not visible and can't enable due to limit)
                                        const isDisabled = !isAvailable || (!isVisible && !canEnable);

                                        // Determine the reason for being disabled
                                        let disabledReason = "";
                                        if (!isAvailable) {
                                            disabledReason = `Requires ${widget.requiresIntegration} integration`;
                                        } else if (!canEnable && !isVisible) {
                                            disabledReason = "Status bar is full (max 4)";
                                        }

                                        return (
                                            <div
                                                key={widget.id}
                                                className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                                                    isDisabled
                                                        ? "border-slate-800 bg-slate-900/50 opacity-60"
                                                        : "border-slate-700 bg-slate-800/50"
                                                }`}
                                            >
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <p
                                                        className={`text-sm font-medium ${
                                                            isDisabled
                                                                ? "text-slate-400"
                                                                : "text-white"
                                                        }`}
                                                    >
                                                        {widget.name}
                                                    </p>
                                                    <p className="text-xs text-slate-500 truncate">
                                                        {disabledReason || widget.description}
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={isVisible}
                                                    onChange={() => onToggle(widget.id)}
                                                    disabled={isDisabled}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                                        isDisabled
                                                            ? "bg-slate-700 cursor-not-allowed"
                                                            : isVisible
                                                            ? "bg-primary"
                                                            : "bg-slate-600"
                                                    }`}
                                                >
                                                    <span
                                                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                                            isVisible ? "translate-x-5" : "translate-x-1"
                                                        }`}
                                                    />
                                                </Switch>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-end p-6 border-t border-slate-800/80">
                    <button
                        onClick={onReset}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        <RotateCcw size={16} />
                        Reset to Defaults
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
