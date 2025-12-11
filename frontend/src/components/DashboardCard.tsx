import React, { CSSProperties } from 'react';

interface DashboardCardProps {
    title: string;
    image: string;
    rotate?: string;
    className?: string;
    style?: CSSProperties;
}

export default function DashboardCard({
    title,
    image,
    rotate = 'rotate-0',
    className = '',
    style = {}
}: DashboardCardProps) {
    return (
        <div
            className={`relative w-[320px] h-[220px] rounded-2xl overflow-hidden shadow-xl dashboard-card ${rotate} ${className}`}
            style={{
                backgroundImage: `url(${image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                ...style
            }}
        >
            <div className="dashboard-card__scrim absolute inset-0" />

        </div>
    );
}
