import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

type PageHeader = {
    title: string;
    actions?: ReactNode;
};

type PageHeaderContextValue = PageHeader & {
    setHeader: (header: PageHeader) => void;
    clearHeader: () => void;
};

const PageHeaderContext = createContext<PageHeaderContextValue | undefined>(undefined);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
    const [header, setHeaderState] = useState<PageHeader>({ title: "" });

    return (
        <PageHeaderContext.Provider
            value={{
                ...header,
                setHeader: setHeaderState,
                clearHeader: () => setHeaderState({ title: "" }),
            }}
        >
            {children}
        </PageHeaderContext.Provider>
    );
}

const noopHeader: PageHeaderContextValue = {
    title: "",
    setHeader: () => {},
    clearHeader: () => {},
};

// eslint-disable-next-line react-refresh/only-export-components
export function usePageHeader() {
    // Gracefully degrade when used outside a provider (e.g. default theme with no TopBar)
    return useContext(PageHeaderContext) ?? noopHeader;
}
