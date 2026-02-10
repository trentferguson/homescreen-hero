import { useEffect, useState } from "react";

interface VersionInfo {
    current_version: string;
    latest_version: string | null;
    update_available: boolean;
    release_url: string | null;
}

export default function VersionBadge() {
    const [version, setVersion] = useState<VersionInfo | null>(null);

    useEffect(() => {
        fetch("/api/version")
            .then((res) => res.json())
            .then((data: VersionInfo) => setVersion(data))
            .catch(() => {
                // Silently fail - version badge is non-critical
            });
    }, []);

    if (!version) {
        return null;
    }

    const badge = (
        <span
            className={`text-xs font-medium px-2 py-1 rounded-md transition-colors ${
                version.update_available
                    ? "bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}
        >
            {version.update_available
                ? "Update available"
                : version.current_version.match(/^\d/)
                    ? `v${version.current_version}`
                    : version.current_version}
        </span>
    );

    if (version.update_available && version.release_url) {
        return (
            <a
                href={version.release_url}
                target="_blank"
                rel="noopener noreferrer"
                title={`Update available: v${version.latest_version}`}
                className="hover:opacity-80 transition-opacity"
            >
                {badge}
            </a>
        );
    }

    return badge;
}
