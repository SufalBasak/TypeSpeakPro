import React, { useState } from 'react';
import { User } from 'lucide-react';

interface UserAvatarProps {
    name?: string;
    src?: string | null;
    className?: string; // For sizing (w-10 h-10) and positioning
    showBorder?: boolean;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ name, src, className = "w-10 h-10", showBorder = true }) => {
    const [imageError, setImageError] = useState(false);

    // Generate a consistent color based on the name
    const getInitials = (name?: string) => {
        return name?[0].toUpperCase() || '?';
    };

    const colors = [
        'from-teal-500 to-emerald-600',
        'from-blue-500 to-indigo-600',
        'from-violet-500 to-purple-600',
        'from-rose-500 to-pink-600',
        'from-amber-500 to-orange-600',
    ];

    const getColorIndex = (name?: string) => {
        if (!name) return 0;
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash % colors.length);
    };

    const gradientClass = colors[getColorIndex(name)];

    const baseClasses = `rounded-full object-cover flex items-center justify-center overflow-hidden shrink-0 ${className} ${showBorder ? 'border-2 border-neutral-800' : ''}`;

    if (src && !imageError) {
        return (
            <img
                src={src}
                alt={name || 'User'}
                className={baseClasses}
                onError={() => setImageError(true)}
            />
        );
    }

    return (
        <div className={`${baseClasses} bg-gradient-to-br ${gradientClass} text-white font-bold shadow-lg`}>
            {name ? (
                <span className="text-sm md:text-base leading-none select-none">
                    {getInitials(name)}
                </span>
            ) : (
                <User className="w-1/2 h-1/2 opacity-80" />
            )}
        </div>
    );
};

export default UserAvatar;
