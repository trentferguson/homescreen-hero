import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;

const SheetTrigger = DialogPrimitive.Trigger;

const SheetPortal = DialogPrimitive.Portal;

const SheetClose = DialogPrimitive.Close;

const SheetOverlay = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            "fixed inset-0 z-50 bg-black/60",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=open]:duration-300 data-[state=closed]:duration-200",
            className
        )}
        {...props}
    />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

type SheetContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: "right" | "left";
};

const SheetContent = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Content>,
    SheetContentProps
>(({ className, children, side = "right", ...props }, ref) => (
    <SheetPortal>
        <SheetOverlay />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                "fixed z-50 flex flex-col h-full w-[380px] max-w-[90vw]",
                "border-slate-800/80 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-2xl",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=open]:duration-300 data-[state=closed]:duration-200",
                side === "right" && [
                    "inset-y-0 right-0 border-l",
                    "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
                ],
                side === "left" && [
                    "inset-y-0 left-0 border-r",
                    "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
                ],
                className
            )}
            {...props}
        >
            {children}
        </DialogPrimitive.Content>
    </SheetPortal>
));
SheetContent.displayName = DialogPrimitive.Content.displayName;

const SheetHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex items-center justify-between p-5 border-b border-slate-800/80",
            className
        )}
        {...props}
    />
);
SheetHeader.displayName = "SheetHeader";

const SheetTitle = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn("text-lg font-bold text-white", className)}
        {...props}
    />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn("text-xs text-slate-400 mt-0.5", className)}
        {...props}
    />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

const SheetBody = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn("flex-1 overflow-y-auto p-5 space-y-6", className)}
        {...props}
    />
);
SheetBody.displayName = "SheetBody";

const SheetFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex items-center gap-3 p-5 border-t border-slate-800/80",
            className
        )}
        {...props}
    />
);
SheetFooter.displayName = "SheetFooter";

const SheetCloseButton = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Close>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Close
        ref={ref}
        className={cn(
            "rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/70",
            className
        )}
        {...props}
    >
        <X size={18} />
        <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
));
SheetCloseButton.displayName = "SheetCloseButton";

export {
    Sheet,
    SheetPortal,
    SheetOverlay,
    SheetClose,
    SheetTrigger,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetBody,
    SheetFooter,
    SheetCloseButton,
};
