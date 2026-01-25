import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

interface DroppableSectionProps {
    id: string;
    items: string[];
    children: React.ReactNode;
}

export function DroppableSection({ id, items, children }: DroppableSectionProps) {
    return (
        <SortableContext id={id} items={items} strategy={rectSortingStrategy}>
            {children}
        </SortableContext>
    );
}
