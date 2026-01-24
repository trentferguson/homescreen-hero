import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
    React.ComponentRef<typeof AlertDialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Overlay
        ref={ref}
        className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=open]:duration-300 data-[state=closed]:duration-200",
            className
        )}
        {...props}
    />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
    React.ComponentRef<typeof AlertDialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
    <AlertDialogPortal>
        <AlertDialogOverlay />
        <AlertDialogPrimitive.Content
            ref={ref}
            className={cn(
                "fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-slate-800/80 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 shadow-2xl rounded-2xl",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "data-[state=closed]:zoom-out-[0.97] data-[state=open]:zoom-in-[0.97]",
                "data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-top-[2%]",
                "data-[state=open]:duration-300 data-[state=closed]:duration-200",
                className
            )}
            {...props}
        />
    </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogTitle = React.forwardRef<
    React.ComponentRef<typeof AlertDialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Title
        ref={ref}
        className={cn("text-lg font-bold text-white", className)}
        {...props}
    />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
    React.ComponentRef<typeof AlertDialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Description
        ref={ref}
        className={cn("text-sm text-slate-400", className)}
        {...props}
    />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
    React.ComponentRef<typeof AlertDialogPrimitive.Action>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Action
        ref={ref}
        className={cn(
            "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
            "bg-rose-500/15 text-rose-400 border border-rose-500/30",
            "hover:bg-rose-500/25 hover:border-rose-500/50",
            "focus:outline-none focus:ring-2 focus:ring-rose-500/50",
            className
        )}
        {...props}
    />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
    React.ComponentRef<typeof AlertDialogPrimitive.Cancel>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Cancel
        ref={ref}
        className={cn(
            "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
            "bg-slate-500/15 text-slate-300 border border-slate-500/30",
            "hover:bg-slate-500/25 hover:text-white hover:border-slate-500/50",
            "focus:outline-none focus:ring-2 focus:ring-slate-500/50",
            className
        )}
        {...props}
    />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

// Convenience wrapper component for simple confirm dialogs
type ConfirmDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    variant?: "danger" | "warning" | "default";
};

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    onConfirm,
    variant = "danger",
}: ConfirmDialogProps) {
    const variantStyles = {
        danger: "bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25 hover:border-rose-500/50",
        warning: "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25 hover:border-amber-500/50",
        default: "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25 hover:border-primary/50",
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogTitle>{title}</AlertDialogTitle>
                <AlertDialogDescription>{description}</AlertDialogDescription>
                <div className="flex items-center justify-end gap-3 mt-4">
                    <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
                    <AlertDialogPrimitive.Action
                        onClick={onConfirm}
                        className={cn(
                            "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-all",
                            "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900",
                            variantStyles[variant]
                        )}
                    >
                        {confirmLabel}
                    </AlertDialogPrimitive.Action>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export {
    AlertDialog,
    AlertDialogPortal,
    AlertDialogOverlay,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
};
