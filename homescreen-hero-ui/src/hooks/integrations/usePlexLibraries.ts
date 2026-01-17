import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../utils/api";
import type { PlexSettings, PlexLibraryConfig } from "../../types/integrations";

export function usePlexLibraries() {
    const [plexSettings, setPlexSettings] = useState<PlexSettings>({
        base_url: "",
        token: "",
        libraries: [],
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        fetchWithAuth("/api/admin/config/plex")
            .then(async (r) => {
                if (!r.ok) throw new Error(await r.text());
                return r.json();
            })
            .then((data: PlexSettings) => {
                if (!isMounted) return;
                setPlexSettings(data);
            })
            .catch(() => {
                // Silently fail - not critical for integrations page
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const enabledLibraries: PlexLibraryConfig[] = plexSettings.libraries.filter(
        (lib) => lib.enabled
    );

    return { plexSettings, enabledLibraries, loading };
}
