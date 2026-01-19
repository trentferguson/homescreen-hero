import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn("p-3", className)}
            classNames={{
                root: "relative",
                months: "flex flex-col sm:flex-row gap-4",
                month: "flex flex-col gap-4",
                month_caption: "flex justify-center items-center h-7 relative",
                caption_label: "text-sm font-medium text-white hidden",
                dropdowns: "flex items-center gap-2",
                dropdown: "appearance-none bg-slate-800 border border-slate-700 rounded-md text-white text-sm pl-2 pr-6 py-1 focus:outline-none focus:ring-2 focus:ring-primary/70 cursor-pointer",
                dropdown_root: "relative",
                months_dropdown: "appearance-none bg-slate-800 border border-slate-700 rounded-md text-white text-sm pl-2 pr-6 py-1 focus:outline-none focus:ring-2 focus:ring-primary/70 cursor-pointer",
                years_dropdown: "appearance-none bg-slate-800 border border-slate-700 rounded-md text-white text-sm pl-2 pr-6 py-1 focus:outline-none focus:ring-2 focus:ring-primary/70 cursor-pointer",
                nav: "flex items-center gap-1",
                button_previous: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-7 w-7 bg-transparent p-0 text-slate-400 hover:text-white hover:bg-slate-800 absolute left-0 top-0"
                ),
                button_next: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-7 w-7 bg-transparent p-0 text-slate-400 hover:text-white hover:bg-slate-800 absolute right-0 top-0"
                ),
                month_grid: "w-full border-collapse",
                weekdays: "flex",
                weekday: "text-slate-500 w-9 font-normal text-[0.8rem] text-center",
                week: "flex w-full mt-1",
                day: "h-9 w-9 text-center text-sm p-0 relative flex items-center justify-center",
                day_button: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-8 w-8 p-0 font-normal text-white hover:bg-slate-700 rounded-md"
                ),
                selected: "[&>button]:bg-primary [&>button]:text-white [&>button]:hover:bg-primary [&>button]:hover:text-white",
                today: "[&>button]:bg-slate-800 [&>button]:text-white",
                outside: "[&>button]:text-slate-600 [&>button]:opacity-50",
                disabled: "[&>button]:text-slate-600 [&>button]:opacity-50 [&>button]:cursor-not-allowed",
                hidden: "invisible",
                range_start: "day-range-start",
                range_end: "day-range-end",
                range_middle: "[&>button]:bg-primary/20 [&>button]:text-white",
                chevron: "h-4 w-4",
                ...classNames,
            }}
            components={{
                Chevron: ({ orientation }) =>
                    orientation === "left" ? (
                        <ChevronLeft className="h-4 w-4" />
                    ) : (
                        <ChevronRight className="h-4 w-4" />
                    ),
            }}
            {...props}
        />
    );
}
Calendar.displayName = "Calendar";

export { Calendar };
