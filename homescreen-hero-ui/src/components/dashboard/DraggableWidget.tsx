import { useSortable, defaultAnimateLayoutChanges } from "@dnd-kit/sortable";
import type { AnimateLayoutChanges } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Maximize2, Minimize2 } from "lucide-react";

interface DraggableWidgetProps {
    id: string;
    isEditMode: boolean;
    colSpan?: number;
    isResizable?: boolean;
    onResize?: () => void;
    onHide?: () => void;
    children: React.ReactNode;
}

// Custom animation config - always animate layout changes for smooth reordering
const animateLayoutChanges: AnimateLayoutChanges = (args) => {
    const { isSorting, wasDragging } = args;
    // Always animate, including when sorting
    if (isSorting || wasDragging) {
        return defaultAnimateLayoutChanges(args);
    }
    return true;
};

export function DraggableWidget({
    id,
    isEditMode,
    colSpan,
    isResizable,
    onResize,
    onHide,
    children,
}: DraggableWidgetProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id,
        disabled: !isEditMode,
        animateLayoutChanges,
    });

    // Apply transform and transition for smooth movement
    // Use Transform (not Translate) to get proper sorting animations
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition: transition || "transform 350ms cubic-bezier(0.25, 1, 0.5, 1)",
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : "auto",
    };

    const colSpanClass =
        colSpan === 4
            ? "col-span-full"
            : colSpan === 2
              ? "sm:col-span-2"
              : "";

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative ${colSpanClass} ${isEditMode && !isDragging ? "edit-mode-widget" : ""}`}
        >
            {isEditMode && (
                <>
                    <div
                        {...attributes}
                        {...listeners}
                        className="absolute top-2 left-2 z-10 p-1.5 rounded-lg bg-slate-800/90 border border-slate-600 cursor-grab active:cursor-grabbing shadow-lg hover:bg-slate-700 hover:border-slate-500 transition-colors backdrop-blur-sm"
                    >
                        <GripVertical className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="absolute top-2 right-2 z-10 flex gap-1.5">
                        {isResizable && onResize && (
                            <button
                                onClick={onResize}
                                className="p-1.5 rounded-lg bg-slate-800/90 border border-slate-600 shadow-lg hover:bg-primary/20 hover:border-primary/50 hover:text-primary transition-colors text-slate-400 backdrop-blur-sm"
                                title={colSpan === 1 ? "Expand to 2 columns" : "Shrink to 1 column"}
                            >
                                {colSpan === 1 ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                            </button>
                        )}
                        {onHide && (
                            <button
                                onClick={onHide}
                                className="p-1.5 rounded-lg bg-slate-800/90 border border-slate-600 shadow-lg hover:bg-red-900/80 hover:border-red-700 hover:text-red-300 transition-colors text-slate-400 backdrop-blur-sm"
                                title="Hide widget"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </>
            )}
            <div
                className={
                    isEditMode
                        ? "ring-2 ring-dashed ring-slate-600 rounded-xl"
                        : ""
                }
            >
                {children}
            </div>
        </div>
    );
}
