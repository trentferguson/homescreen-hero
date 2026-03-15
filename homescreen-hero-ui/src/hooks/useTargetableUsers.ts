import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";

export type PlexUser = {
    id: number;
    username: string;
    title: string;
    thumb: string | null;
    is_home: boolean;
    is_admin: boolean;
};

export function useTargetableUsers() {
    const [users, setUsers] = useState<PlexUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        fetchWithAuth("/api/admin/plex-users")
            .then(async (r) => {
                if (!r.ok) throw new Error(await r.text());
                return r.json();
            })
            .then((data: { users: PlexUser[] }) => {
                if (!isMounted) return;
                // Filter out admin - they always see everything
                setUsers(data.users.filter((u) => !u.is_admin));
            })
            .catch(() => {
                // Silently fail - not critical for page load
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    return { users, loading };
}
