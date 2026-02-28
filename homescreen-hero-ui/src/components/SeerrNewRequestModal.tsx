import { useState, useEffect } from "react";
import { fetchWithAuth } from "../utils/api";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogCloseButton,
} from "./ui/dialog";
import { Listbox } from "@headlessui/react";
import {
    Film,
    Tv,
    Calendar,
    Star,
    ChevronDown,
    Check,
    Loader2,
    ExternalLink,
    Plus,
    CheckCircle,
} from "lucide-react";
import type {
    SeerrSearchResult,
    SeerrMediaStatus,
    ServicesResponse,
    ServiceInfo,
    SeasonInfo,
    CreateRequestPayload,
    CreateRequestResponse,
} from "../types/seerr";
import { SEERR_MEDIA_STATUS_COLORS, SEERR_MEDIA_STATUS_LABELS } from "../types/seerr";

type Props = {
    result: SeerrSearchResult | null;
    open: boolean;
    onClose: () => void;
    onRequestCreated: () => void;
    seerrBaseUrl: string;
};

type MediaDetail = {
    title: string;
    posterPath: string | null;
    backdropPath: string | null;
    overview: string | null;
    releaseDate: string | null;
    voteAverage: number | null;
};

function MediaStatusPill({ status }: { status: SeerrMediaStatus }) {
    const colors = SEERR_MEDIA_STATUS_COLORS[status] || {
        bg: "bg-slate-500/15",
        text: "text-slate-300",
        border: "ring-slate-500/30",
    };
    const label = SEERR_MEDIA_STATUS_LABELS[status] || "Unknown";
    return (
        <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ${colors.bg} ${colors.text} ${colors.border}`}
        >
            {label}
        </span>
    );
}

export default function SeerrNewRequestModal({
    result,
    open,
    onClose,
    onRequestCreated,
    seerrBaseUrl,
}: Props) {
    const [, setMediaDetail] = useState<MediaDetail | null>(null);
    const [, setServices] = useState<ServicesResponse | null>(null);
    const [seasons, setSeasons] = useState<SeasonInfo[]>([]);
    const [selectedSeasons, setSelectedSeasons] = useState<number[]>([]);
    const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null);
    const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (open && result) {
            loadData();
        } else {
            // Reset state when modal closes
            setMediaDetail(null);
            setServices(null);
            setSeasons([]);
            setSelectedSeasons([]);
            setSelectedService(null);
            setSelectedProfileId(null);
            setError(null);
            setSuccess(false);
        }
    }, [open, result?.tmdbId]);

    const loadData = async () => {
        if (!result) return;
        setLoading(true);
        setError(null);

        try {
            // Load media details, services, and seasons (for TV) in parallel
            const promises: Promise<unknown>[] = [
                fetchWithAuth(`/api/admin/seerr/services`).then((r) => r.json()),
            ];

            // For TV, also load seasons
            if (result.mediaType === "tv") {
                promises.push(
                    fetchWithAuth(`/api/admin/seerr/tv/${result.tmdbId}/seasons`).then((r) =>
                        r.json()
                    )
                );
            }

            const results = await Promise.all(promises);
            const servicesData = results[0] as ServicesResponse;
            setServices(servicesData);

            // Set default service and profile
            const serviceList =
                result.mediaType === "movie" ? servicesData.radarr : servicesData.sonarr;
            if (serviceList.length > 0) {
                const defaultService = serviceList.find((s) => s.isDefault) || serviceList[0];
                setSelectedService(defaultService);
                if (defaultService.profiles.length > 0) {
                    setSelectedProfileId(defaultService.profiles[0].id);
                }
            }

            // Handle seasons for TV
            if (result.mediaType === "tv" && results[1]) {
                const seasonsData = results[1] as SeasonInfo[];
                setSeasons(seasonsData);
                // Pre-select all seasons
                setSelectedSeasons(seasonsData.map((s) => s.seasonNumber));
            }

            // Use result data for display
            setMediaDetail({
                title: result.title,
                posterPath: result.posterPath,
                backdropPath: null, // We don't have this in search results
                overview: null,
                releaseDate: result.releaseDate,
                voteAverage: result.voteAverage,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!result) return;

        setSubmitting(true);
        setError(null);

        try {
            const payload: CreateRequestPayload = {
                mediaType: result.mediaType,
                mediaId: result.tmdbId,
            };

            if (result.mediaType === "tv") {
                payload.seasons = selectedSeasons;
            }

            if (selectedService) {
                payload.serverId = selectedService.id;
            }

            if (selectedProfileId) {
                payload.profileId = selectedProfileId;
            }

            const response = await fetchWithAuth("/api/admin/seerr/requests/new", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data: CreateRequestResponse = await response.json();

            if (!data.success) {
                throw new Error(data.message || "Failed to create request");
            }

            setSuccess(true);
            onRequestCreated();

            // Close modal after brief delay to show success
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create request");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSeasonToggle = (seasonNumber: number) => {
        setSelectedSeasons((prev) =>
            prev.includes(seasonNumber)
                ? prev.filter((s) => s !== seasonNumber)
                : [...prev, seasonNumber]
        );
    };

    const handleSelectAllSeasons = () => {
        if (selectedSeasons.length === seasons.length) {
            setSelectedSeasons([]);
        } else {
            setSelectedSeasons(seasons.map((s) => s.seasonNumber));
        }
    };

    const posterUrl = result?.posterPath
        ? `https://image.tmdb.org/t/p/w300${result.posterPath}`
        : null;

    const getYear = (dateStr: string | null): string => {
        if (!dateStr) return "";
        const year = new Date(dateStr).getFullYear();
        return isNaN(year) ? "" : String(year);
    };

    // Check if media is already requested/available
    const isAlreadyRequested = result?.mediaStatus && result.mediaStatus >= 2;
    const isAvailable = result?.mediaStatus === 5;

    // Get current service's profiles
    const currentProfiles = selectedService?.profiles || [];

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-lg p-0 overflow-hidden">
                <DialogHeader className="border-b-0 bg-transparent absolute top-0 left-0 right-0 z-10">
                    <div className="flex-1" />
                    <DialogCloseButton />
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : error && !result ? (
                    <div className="text-center py-16 px-6">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button
                            onClick={loadData}
                            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition"
                        >
                            Retry
                        </button>
                    </div>
                ) : result ? (
                    <div className="p-6 pt-12">
                        <div className="flex gap-5">
                            {/* Poster */}
                            <div className="flex-shrink-0">
                                {posterUrl ? (
                                    <img
                                        src={posterUrl}
                                        alt={result.title}
                                        className="w-28 h-40 object-cover rounded-lg shadow-lg"
                                    />
                                ) : (
                                    <div className="w-28 h-40 rounded-lg bg-slate-800 flex items-center justify-center">
                                        {result.mediaType === "movie" ? (
                                            <Film className="h-10 w-10 text-slate-600" />
                                        ) : (
                                            <Tv className="h-10 w-10 text-slate-600" />
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 space-y-3">
                                <div>
                                    <div className="flex items-start justify-between gap-3">
                                        <DialogTitle className="text-xl">
                                            {result.title}
                                        </DialogTitle>
                                        {result.mediaStatus && (
                                            <MediaStatusPill status={result.mediaStatus} />
                                        )}
                                    </div>

                                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                                        <span className="inline-flex items-center gap-1.5">
                                            {result.mediaType === "movie" ? (
                                                <Film className="h-4 w-4" />
                                            ) : (
                                                <Tv className="h-4 w-4" />
                                            )}
                                            {result.mediaType === "movie" ? "Movie" : "TV Show"}
                                        </span>

                                        {result.releaseDate && (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Calendar className="h-4 w-4" />
                                                {getYear(result.releaseDate)}
                                            </span>
                                        )}

                                        {result.voteAverage != null && result.voteAverage > 0 && (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Star className="h-4 w-4 text-yellow-400" />
                                                {result.voteAverage.toFixed(1)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Already requested/available message */}
                                {isAvailable && (
                                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-sm text-emerald-400">
                                        This title is already available in your library.
                                    </div>
                                )}
                                {isAlreadyRequested && !isAvailable && (
                                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-sm text-amber-400">
                                        This title has already been requested.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Request Options (only if not already requested) */}
                        {!isAlreadyRequested && (
                            <div className="mt-6 space-y-4">
                                {/* Season Selection for TV */}
                                {result.mediaType === "tv" && seasons.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-sm font-medium text-slate-300">
                                                Seasons
                                            </label>
                                            <button
                                                onClick={handleSelectAllSeasons}
                                                className="text-xs text-primary hover:text-primary-light transition"
                                            >
                                                {selectedSeasons.length === seasons.length
                                                    ? "Deselect All"
                                                    : "Select All"}
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto scrollbar-hover-only pr-1">
                                            {seasons.map((season) => (
                                                <label
                                                    key={season.seasonNumber}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                                                        selectedSeasons.includes(season.seasonNumber)
                                                            ? "border-primary/50 bg-primary/10"
                                                            : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSeasons.includes(
                                                            season.seasonNumber
                                                        )}
                                                        onChange={() =>
                                                            handleSeasonToggle(season.seasonNumber)
                                                        }
                                                        className="sr-only"
                                                    />
                                                    <div
                                                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                                            selectedSeasons.includes(season.seasonNumber)
                                                                ? "bg-primary border-primary"
                                                                : "border-slate-600"
                                                        }`}
                                                    >
                                                        {selectedSeasons.includes(
                                                            season.seasonNumber
                                                        ) && <Check className="h-3 w-3 text-white" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-sm text-white truncate block">
                                                            {season.name}
                                                        </span>
                                                        <span className="text-xs text-slate-500">
                                                            {season.episodeCount} episodes
                                                        </span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Quality Profile Dropdown */}
                                {currentProfiles.length > 0 && (
                                    <div>
                                        <label className="text-sm font-medium text-slate-300 block mb-2">
                                            Quality Profile
                                        </label>
                                        <Listbox
                                            value={selectedProfileId}
                                            onChange={setSelectedProfileId}
                                        >
                                            <div className="relative">
                                                <Listbox.Button className="w-full px-3 py-2.5 rounded-lg text-sm font-medium border border-slate-700/50 bg-slate-800/30 text-white hover:border-primary/30 hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all flex items-center justify-between">
                                                    <span>
                                                        {currentProfiles.find(
                                                            (p) => p.id === selectedProfileId
                                                        )?.name || "Select profile"}
                                                    </span>
                                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                                </Listbox.Button>
                                                <Listbox.Options className="absolute z-10 mt-1 w-full border border-slate-700/50 bg-slate-900/95 backdrop-blur-sm rounded-lg shadow-lg max-h-48 overflow-auto scrollbar-hover-only focus:outline-none">
                                                    {currentProfiles.map((profile) => (
                                                        <Listbox.Option
                                                            key={profile.id}
                                                            value={profile.id}
                                                            className="px-3 py-2.5 cursor-pointer transition-all text-sm text-slate-300 hover:text-white hover:bg-primary/10 data-[selected]:bg-primary/20 data-[selected]:text-white flex items-center justify-between"
                                                        >
                                                            {({ selected }) => (
                                                                <>
                                                                    <span
                                                                        className={
                                                                            selected ? "font-semibold" : ""
                                                                        }
                                                                    >
                                                                        {profile.name}
                                                                    </span>
                                                                    {selected && (
                                                                        <Check className="h-4 w-4 text-primary" />
                                                                    )}
                                                                </>
                                                            )}
                                                        </Listbox.Option>
                                                    ))}
                                                </Listbox.Options>
                                            </div>
                                        </Listbox>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Error message */}
                        {error && (
                            <div className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-sm text-rose-400">
                                {error}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-800">
                            <div className="flex items-center gap-2">
                                {success ? (
                                    <div className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                        <CheckCircle className="h-4 w-4" />
                                        Request Created
                                    </div>
                                ) : isAlreadyRequested ? (
                                    <div className="text-sm text-slate-500">
                                        {isAvailable
                                            ? "Already in library"
                                            : "Already requested"}
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={
                                            submitting ||
                                            (result.mediaType === "tv" &&
                                                selectedSeasons.length === 0)
                                        }
                                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        {submitting ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Plus className="h-4 w-4" />
                                        )}
                                        Request
                                    </button>
                                )}
                            </div>

                            {seerrBaseUrl && (
                                <a
                                    href={`${seerrBaseUrl}/${result.mediaType}/${result.tmdbId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-slate-400 hover:text-white transition-all"
                                >
                                    Open in Overseerr
                                    <ExternalLink className="h-4 w-4" />
                                </a>
                            )}
                        </div>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
