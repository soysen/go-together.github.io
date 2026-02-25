'use client';

import { useState, useEffect, useMemo } from 'react';
import SidePanel from './components/SidePanel';

interface Event {
    title: string;
    sessions: {
        location: string;
        date: string[];
        url: string;
    }[];
    description: string;
    tags?: string[];
    category: string;
}

export default function Home() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

    // Filter states
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [activeLocation, setActiveLocation] = useState<string | null>(null);
    const [activeTag, setActiveTag] = useState<string | null>(null);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                // 如果是dev 環境則使用 api/chat
                const isDev = process.env.NODE_ENV === 'development';
                const response = await fetch(isDev ? '/api/chat' : './events.json', isDev ? {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: '查詢展覽' }),
                } : {});
                const data = await response.json();

                if (!response.ok) {
                    setError('無法載入活動資料');
                    return;
                }

                const eventsList = data.events || [];
                eventsList.sort((a: Event, b: Event) => {
                    const dateA = new Date(a.sessions[0].date[0]).valueOf();
                    const dateB = new Date(b.sessions[0].date[0]).valueOf();
                    return dateA - dateB;
                });
                setEvents(eventsList);
                localStorage.setItem('events', JSON.stringify(eventsList));
            } catch (err) {
                console.error('Error fetching events:', err);
                setError('無法連線到伺服器，請稍後再試。');
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    // Derive all unique filter options from events
    const filterOptions = useMemo(() => {
        const categories = new Set<string>();
        const locations = new Set<string>();
        const tags = new Set<string>();

        events.forEach(event => {
            categories.add(event.category);
            event.sessions.forEach(s => locations.add(s.location));
            event.tags?.forEach(t => tags.add(t));
        });

        return {
            categories: Array.from(categories).sort(),
            locations: Array.from(locations).sort(),
            tags: Array.from(tags).sort(),
        };
    }, [events]);

    // Filtered events
    const filteredEvents = useMemo(() => {
        return events.filter(event => {
            if (activeCategory && event.category !== activeCategory) return false;
            if (activeLocation && !event.sessions.some(s => s.location === activeLocation)) return false;
            if (activeTag && !(event.tags || []).includes(activeTag)) return false;
            return true;
        });
    }, [events, activeCategory, activeLocation, activeTag]);

    const hasActiveFilter = activeCategory || activeLocation || activeTag;

    const clearAllFilters = () => {
        setActiveCategory(null);
        setActiveLocation(null);
        setActiveTag(null);
    };

    if (loading) return <div className="w-full h-full fixed flex-grow flex items-center justify-center p-8 text-center text-mint-500">Loading events...</div>;

    if (error) return (
        <div className="p-8 max-w-lg mx-auto mt-20 text-center">
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-red-700 dark:text-red-400 mb-2">⚠️ 錯誤</h2>
                <p className="text-red-600 dark:text-red-300">{error}</p>
                <button
                    onClick={() => { setError(null); setLoading(true); window.location.reload(); }}
                    className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 rounded text-sm text-red-700 dark:text-red-200 transition"
                >
                    重試
                </button>
            </div>
        </div>
    );

    return (
        <div className="container mx-auto pb-12 pt-0 px-4">
            <header className="flex flex-col lg:flex-row lg:justify-between">
                <div className="flex justify-center content-center">
                    <img src="./Logo.png" alt="Logo" className="md:w-48 md:h-48 w-24 h-24" />
                    <h1 className="text-3xl font-bold content-center">這週去哪玩</h1>
                </div>

                {/* Category Filter */}
                <nav className="flex flex-wrap items-center gap-2 over mb-8 lg:mb-0">
                    <ul className='flex overflow-x-auto'>

                        <li
                            onClick={() => setActiveCategory(null)}
                            className={`whitespace-nowrap px-3 py-1 mx-1 rounded-full text-xl font-medium transition-all duration-200 ${activeCategory === null
                                ? 'bg-menu text-white shadow-sm'
                                : 'dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-gray-600 dark:hover:text-black'
                                }`}
                            role='button'
                        >
                            全部
                        </li>
                        {filterOptions.categories.map(cat => (
                            <li
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`whitespace-nowrap px-3 py-1 mx-1 rounded-full text-xl font-medium transition-all duration-200 ${activeCategory === cat
                                    ? 'bg-menu text-white shadow-sm'
                                    : 'dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-grey-600 dark:hover:text-white'
                                    }`}
                                role='button'
                            >
                                {cat}
                            </li>
                        ))}
                    </ul>
                </nav>
            </header>

            {/* Filter Bar */}
            <div className="mb-8 space-y-4">


                {/* Tag Filter */}
                {filterOptions.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16 shrink-0">標籤</span>
                        {filterOptions.tags.map(tag => (
                            <button
                                key={tag}
                                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 border ${activeTag === tag
                                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
                                    }`}
                            >
                                #{tag}
                            </button>
                        ))}
                    </div>
                )}

                {/* Active filter summary & clear */}
                {hasActiveFilter && (
                    <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            顯示 {filteredEvents.length} / {events.length} 項活動
                        </span>
                        <button
                            onClick={clearAllFilters}
                            className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 underline transition-colors"
                        >
                            清除全部篩選
                        </button>
                    </div>
                )}
            </div>

            {/* Event Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEvents.length === 0 ? (
                    <p className="col-span-full text-center text-gray-500">
                        {hasActiveFilter ? '沒有符合篩選條件的活動。' : 'No events found.'}
                    </p>
                ) : (
                    filteredEvents.map((event, index) => (
                        <div
                            key={index}
                            onClick={() => setSelectedEvent(event)}
                            className="border flex rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <div className="p-6 flex flex-grow flex-col">
                                <h2 className="text-xl font-semibold mb-2 line-clamp-2">
                                    <div className='text-sm text-gray-500 dark:text-gray-400'>{event.sessions[0].date[0] + `${event.sessions[0].date[1] ? ` ~ ${event.sessions[0].date[1]}` : ''}`}</div>
                                    {event.title}
                                </h2>
                                <div className="flex-grow ">
                                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-mint text-menu mb-2">
                                        {event.category}
                                    </span>
                                    <span className="inline-block px-2 py-0.5 rounded-full ml-1 text-xs font-medium bg-mint text-menu mb-2">
                                        {event.sessions[0].location}
                                    </span>
                                    <p className="text-gray-600 dark:text-gray-300 mb-3 line-clamp-3 text-sm">{event.description}</p>
                                    {event.tags && event.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-3">
                                            {event.tags.slice(0, 3).map((tag, i) => (
                                                <span key={i} className="px-1.5 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <p className="flex text-xs text-black justify-between items-center font-medium justify-self-end">
                                    <span className='dark:text-white'>{event.sessions.length} 個場次</span> <span className="rounded-lg bg-gold px-2 py-1">點擊查看 →</span>
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <SidePanel
                event={selectedEvent}
                onClose={() => setSelectedEvent(null)}
            />
        </div>
    );
}
