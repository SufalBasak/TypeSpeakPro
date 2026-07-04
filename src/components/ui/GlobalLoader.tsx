import React from 'react';
import { Loader2 } from 'lucide-react';

const GlobalLoader = () => {
    return (
        <div 
            className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground p-4"
            aria-live="polite"
            role="status"
        >
            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
                <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-teal-500/20 blur-xl animate-pulse"></div>
                    <Loader2 className="w-12 h-12 text-teal-400 animate-spin relative z-10" aria-hidden="true" focusable="false" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground/80">Loading TypeSpeak<span className="text-teal-400">Pro</span>...</h2>
                <span className="sr-only">Please wait while the page loads</span>
            </div>
        </div>
    );
};

export default GlobalLoader;
