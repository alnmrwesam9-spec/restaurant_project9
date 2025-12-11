import React, { useEffect, useMemo, useState } from 'react';
import DashboardCard from './DashboardCard';
import '../styles/dashboard-cards.css';

export default function IbladishDashboardMockup() {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 640px)');
        const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
        handler(mq);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const cards = useMemo(
        () => [
            {
                title: 'Allergen Analyse',
                image: '/assets/secrol2/The%20Solution3.png',
                rotate: '-rotate-6'
            },
            {
                title: 'Gerichte verwalten',
                image: '/assets/secrol2/The%20Solution2.png',
                rotate: 'rotate-0'
            },
            {
                title: 'Speisekarte Übersicht',
                image: '/assets/secrol2/The%20Solution1.png',
                rotate: 'rotate-6'
            }
        ],
        []
    );

    const [activeIndex, setActiveIndex] = useState(1);
    const total = cards.length;

    const getSlot = (idx: number) => {
        const diff = (idx - activeIndex + total) % total;
        // Map for 3 cards: 0 -> center, 1 -> right, 2 -> left
        if (diff === 0) return 'center';
        if (diff === 1) return 'right';
        return 'left';
    };

    const shiftX = isMobile ? 70 : 110;
    const sideScale = isMobile ? 0.82 : 0.9;
    const sideYOffset = isMobile ? 22 : 0;

    const stylesMap: Record<
        string,
        { translate: string; scale: number; zIndex: number; opacity: number }
    > = {
        center: {
            translate: 'translateX(-50%) translateY(0)',
            scale: 1,
            zIndex: 30,
            opacity: 1
        },
        right: {
            translate: `translateX(calc(-50% + ${shiftX}px)) translateY(${sideYOffset}px)`,
            scale: sideScale,
            zIndex: 20,
            opacity: 0.55
        },
        left: {
            translate: `translateX(calc(-50% - ${shiftX}px)) translateY(${sideYOffset}px)`,
            scale: sideScale,
            zIndex: 20,
            opacity: 0.55
        }
    };

    const goNext = () => setActiveIndex((prev) => (prev + 1) % total);
    const goPrev = () => setActiveIndex((prev) => (prev - 1 + total) % total);

    return (
        <div className="relative w-full flex flex-col items-center justify-center overflow-visible z-10 py-6 dashboard-cards-wrapper">
            <div className="dashboard-cards-track">
                {cards.map((card, idx) => {
                    const slot = getSlot(idx);
                    const style = stylesMap[slot];
                    const angle =
                        card.rotate === 'rotate-6' ? 6 : card.rotate === '-rotate-6' ? -6 : 0;
                    const isSide = slot !== 'center';
                    return (
                        <div
                            key={card.title}
                            className="dashboard-card-layer"
                            style={{
                                transform: `${style.translate} scale(${style.scale}) rotate(${angle}deg)`,
                                zIndex: style.zIndex,
                                opacity: style.opacity,
                                filter: isSide ? 'blur(2px)' : 'none'
                            }}
                            aria-hidden={slot !== 'center'}
                        >
                            <DashboardCard
                                title={card.title}
                                image={card.image}
                                rotate={card.rotate}
                            />
                        </div>
                    );
                })}
            </div>

            <div className="dashboard-cards-controls">
                <button type="button" className="dashboard-cards-button" onClick={goPrev} aria-label="Previous dashboard card">
                    ‹
                </button>
                <div className="dashboard-cards-dots" role="tablist" aria-label="Dashboard cards">
                    {cards.map((_, idx) => (
                        <button
                            key={`dot-${idx}`}
                            type="button"
                            className={`dashboard-cards-dot ${idx === activeIndex ? 'is-active' : ''}`}
                            onClick={() => setActiveIndex(idx)}
                            aria-label={`Show card ${idx + 1}`}
                            aria-pressed={idx === activeIndex}
                        />
                    ))}
                </div>
                <button type="button" className="dashboard-cards-button" onClick={goNext} aria-label="Next dashboard card">
                    ›
                </button>
            </div>
        </div>
    );
}
