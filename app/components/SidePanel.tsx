'use client';

interface Session {
    location: string;
    date: string[];
    url: string;
}

interface Event {
    title: string;
    sessions: Session[];
    description: string;
    tags?: string[];
    category: string;
}

interface SidePanelProps {
    event: Event | null;
    onClose: () => void;
    onTagClick?: (tag: string) => void;
}

function formatDate(dates: string[]): string {
    if (dates.length === 1) return dates[0];
    if (dates.length === 2) return `${dates[0]} ~ ${dates[1]}`;
    return dates.join(', ');
}

export default function SidePanel({ event, onClose, onTagClick }: SidePanelProps) {
    const isOpen = event !== null;

    return (
        <>
            {/* Backdrop overlay */}
            <div
                className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
            />

            {/* Side panel */}
            <div
                className={`fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-50 transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {event && (
                    <div className="h-full flex flex-col">
                        {/* Header */}
                        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex-1 pr-4">
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-mint text-menu mb-2">
                                    {event.category}
                                </span>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">
                                    {event.title}
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                                aria-label="關閉"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Description */}
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                {event.description}
                            </p>
                            {event.tags && event.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                    {event.tags.map((tag, i) => (
                                        <span
                                            key={i}
                                            onClick={() => onTagClick?.(tag)}
                                            className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 cursor-pointer hover:bg-purple-100 hover:text-purple-600 dark:hover:bg-purple-900 dark:hover:text-purple-300 transition-all duration-200"
                                        >
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Sessions list */}
                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                場次 ({event.sessions.length})
                            </h3>
                            <div className="space-y-3">
                                {event.sessions.map((session, index) => (
                                    <a
                                        key={index}
                                        href={session.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-mint dark:hover:border-mint hover:shadow-md bg-gray-50 dark:bg-gray-800/50 hover:bg-mint/5 dark:hover:bg-mint/5 transition-all duration-200 group"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 font-medium mb-1">
                                                    <span>📍</span>
                                                    <span>{session.location}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                                                    <span>📅</span>
                                                    <span>{formatDate(session.date)}</span>
                                                </div>
                                            </div>
                                            <span className="text-xs font-medium text-gold group-hover:translate-x-0.5 transition-transform duration-200 mt-1 whitespace-nowrap">
                                                前往購票 →
                                            </span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
