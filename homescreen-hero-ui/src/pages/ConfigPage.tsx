import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";

type ConfigFileResponse = { path: string; content: string };
type ConfigSaveResponse = { ok: boolean; path: string; message: string; env_override: boolean };

export default function ConfigPage() {
    const [path, setPath] = useState<string>("");
    const [content, setContent] = useState<string>("");
    const [msg, setMsg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchWithAuth("/api/admin/config/file")
            .then((r) => r.json())
            .then((d: ConfigFileResponse) => {
                setPath(d.path);
                setContent(d.content);
            })
            .catch((e) => setError(String(e)));
    }, []);

    async function save() {
        try {
            setSaving(true);
            setMsg(null);
            setError(null);

            const r = await fetchWithAuth("/api/admin/config/file", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            });

            const text = await r.text();
            if (!r.ok) throw new Error(text);

            const d = JSON.parse(text) as ConfigSaveResponse;
            setMsg(d.message);
        } catch (e) {
            setError(String(e));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Config</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                    Editing: <span className="font-mono">{path || "…"}</span>
                </p>
            </div>

            {msg && <div className="p-3 rounded-lg bg-emerald-900/30 border border-emerald-900/40 text-emerald-200">{msg}</div>}
            {error && <pre className="p-3 rounded-lg bg-red-900/30 border border-red-900/40 text-red-200 whitespace-pre-wrap">{error}</pre>}

            <textarea
                className="w-full min-h-[60vh] rounded-xl bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-800 p-4 font-mono text-xs text-slate-900 dark:text-slate-100"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
            />

            <div className="flex gap-3">
                <button
                    onClick={save}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-primary hover:bg-blue-600 text-white font-bold disabled:opacity-60"
                >
                    {saving ? "Saving…" : "Save & Validate"}
                </button>
            </div>
        </div>
    );
}
