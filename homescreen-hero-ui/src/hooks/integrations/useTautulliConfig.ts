import { useEffect, useState, useCallback } from "react";
import { fetchWithAuth } from "../../utils/api";
import type {
    TautulliSettings,
    ConfigSaveResponse,
    HealthComponent,
    TestStatus,
} from "../../types/integrations";

const initialSettings: TautulliSettings = {
    enabled: false,
    api_key: "",
    base_url: "http://localhost:8181",
    collect_on_rotation: true,
    collect_interval_hours: 24,
};

export function useTautulliConfig() {
    const [settings, setSettings] = useState<TautulliSettings>(initialSettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [testStatus, setTestStatus] = useState<TestStatus>("idle");

    // Load settings
    useEffect(() => {
        let isMounted = true;

        fetchWithAuth("/api/admin/config/tautulli")
            .then(async (r) => {
                if (!r.ok) throw new Error(await r.text());
                return r.json();
            })
            .then((data: TautulliSettings | null) => {
                if (!isMounted || !data) return;
                setSettings({
                    enabled: data.enabled ?? false,
                    api_key: data.api_key ?? "",
                    base_url: data.base_url || "http://localhost:8181",
                    collect_on_rotation: data.collect_on_rotation ?? true,
                    collect_interval_hours: data.collect_interval_hours ?? 24,
                });
            })
            .catch((e) => {
                if (isMounted) setError(String(e));
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const clearMessages = useCallback(() => {
        setError(null);
        setMessage(null);
    }, []);

    const saveSettings = useCallback(async () => {
        try {
            setSaving(true);
            setError(null);
            setMessage(null);

            const r = await fetchWithAuth("/api/admin/config/tautulli", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });

            if (!r.ok) throw new Error(await r.text());

            const data: ConfigSaveResponse = await r.json();
            setMessage(data.message);
        } catch (e) {
            setError(String(e));
        } finally {
            setSaving(false);
        }
    }, [settings]);

    const testConnection = useCallback(async () => {
        try {
            setTestStatus("testing");

            const r = await fetchWithAuth("/api/health/tautulli");
            if (!r.ok) throw new Error(await r.text());

            const data: HealthComponent = await r.json();

            if (data?.ok === true) {
                setError(null);
                setTestStatus("success");
            } else {
                setTestStatus("error");
                setError(data?.error || "Tautulli API health check failed.");
            }
        } catch (e) {
            setTestStatus("error");
            setError(String(e));
        }
    }, []);

    return {
        settings,
        setSettings,
        loading,
        saving,
        error,
        message,
        testStatus,
        clearMessages,
        saveSettings,
        testConnection,
    };
}
