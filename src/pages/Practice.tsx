import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, User, Zap, Swords, X, Keyboard, Trophy, Menu, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TypingTest from '@/components/typing/TypingTest';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import LaptopSuggestionModal from '@/components/LaptopSuggestionModal';
import RankedConfigModal from '@/components/typing/RankedConfigModal';
import KeyboardShortcutsOverlay from '@/components/typing/KeyboardShortcutsOverlay';
import { RoomConfig } from '@/hooks/useMultiplayer';

const Practice = () => {
    const navigate = useNavigate();
    const [selectedMode, setSelectedMode] = useState<'solo' | 'multiplayer' | 'ranked_race' | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showLaptopSuggestion, setShowLaptopSuggestion] = useState(false);
    const [isSoloConfigOpen, setIsSoloConfigOpen] = useState(false);
    const [isRankedConfigOpen, setIsRankedConfigOpen] = useState(false);
    const [soloConfig, setSoloConfig] = useState<RoomConfig | null>(null);
    const [rankedConfig, setRankedConfig] = useState<RoomConfig | null>(null);

    // Mobile Laptop Suggestion Logic
    React.useEffect(() => {
        const checkMobile = () => {
            const isMobile = window.innerWidth < 768; // Standard mobile breakpoint
            // Randomly show popup (e.g., 60% chance) if mobile
            if (isMobile && Math.random() > 0.4) {
                // Short delay for better UX
                setTimeout(() => {
                    setShowLaptopSuggestion(true);
                }, 1500);
            }
        };

        checkMobile();
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30 relative overflow-hidden">

            {/* Header: Logo (left) and Menu (right) */}
            {selectedMode !== null && (
                <header className="absolute top-0 left-0 right-0 p-6 flex justify-end items-center z-50">
                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                        >
                            <Menu className="w-6 h-6" />
                        </Button>
                        {/* Simple Menu Dropdown */}
                        {isMenuOpen && (
                            <div className="absolute right-0 top-12 w-48 bg-card border border-border rounded-lg shadow-xl p-2 animate-in fade-in slide-in-from-top-2 flex flex-col gap-1 z-50">
                                <Button variant="ghost" className="justify-start" onClick={() => navigate('/')}>
                                    Home
                                </Button>
                                <Button variant="ghost" className="justify-start" onClick={() => navigate('/dashboard')}>
                                    Dashboard
                                </Button>
                                <Button variant="ghost" className="justify-start text-red-400 hover:text-red-400 hover:bg-red-400/10" onClick={() => setSelectedMode(null)}>
                                    Exit Mode
                                </Button>
                            </div>
                        )}
                    </div>
                </header>
            )}

            {/* Navbar for Mode Selection Screen Only */}
            {selectedMode === null && <Navbar />}

            {/* Subtle Animated Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[128px] opacity-20 animate-pulse-slow"></div>
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[128px] opacity-20 animate-pulse-slow delay-1000"></div>
            </div>

            <main className={`flex-1 flex flex-col items-center px-4 sm:px-8 relative w-full max-w-7xl mx-auto ${selectedMode ? 'justify-center min-h-screen pt-0' : 'pt-20'} pb-12`}>

                {/* Hero Section */}
                {selectedMode === null && (
                    <div className="text-center mb-8 animate-in fade-in slide-in-from-top-8 duration-700">
                        <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-secondary/50 border border-white/5 backdrop-blur-sm">
                            <span className="relative flex h-2 w-2 mr-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                            </span>
                            <span className="text-sm font-medium text-muted-foreground">Premium Typing Experience</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/80 to-foreground/60">
                            Master Your <span className="text-teal-400">Keystrokes</span>
                        </h1>
                        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                            Challenge yourself to improve speed and accuracy. Compete with friends in real-time or practice solo with detailed analytics.
                        </p>
                    </div>
                )}

                {selectedMode === null ? (
                    // Mode Selection Screen
                    <div className="w-full max-w-6xl grid md:grid-cols-3 gap-6 animate-in zoom-in-95 duration-500">
                        {/* Solo Mode Card */}
                        <div
                            onClick={() => setIsSoloConfigOpen(true)}
                            className="group relative overflow-hidden rounded-3xl border border-border bg-card/50 p-6 transition-all cursor-pointer hover:border-primary/50 hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.1)] hover:-translate-y-1"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                            <div className="relative z-10 flex flex-col h-full gap-5">
                                <div className="p-3 w-fit rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-300 ring-1 ring-primary/20">
                                    <User className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold mb-2 text-foreground group-hover:text-primary transition-colors">Solo Practice</h2>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Focus on your own speed and accuracy. Customize your test settings and track progress.
                                    </p>
                                </div>
                                <div className="mt-auto pt-4 flex items-center text-primary font-medium opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-sm">
                                    Start Session <Zap className="w-4 h-4 ml-2 fill-current" />
                                </div>
                            </div>
                        </div>

                        {/* Ranked Race (AI) Card */}
                        <div
                            onClick={() => setIsRankedConfigOpen(true)}
                            className="group relative overflow-hidden rounded-3xl border border-border bg-card/50 p-6 transition-all cursor-pointer hover:border-teal-500/50 hover:shadow-[0_0_40px_-10px_rgba(45,212,191,0.1)] hover:-translate-y-1"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                            <div className="relative z-10 flex flex-col h-full gap-5">
                                <div className="p-3 w-fit rounded-2xl bg-teal-500/10 text-teal-400 group-hover:scale-110 transition-transform duration-300 ring-1 ring-teal-500/20">
                                    <Trophy className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold mb-2 text-foreground group-hover:text-teal-400 transition-colors">Ranked Race</h2>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Compete against AI opponents in a ranked ladder. Prove your skill and earn your rank.
                                    </p>
                                </div>
                                <div className="mt-auto pt-4 flex items-center text-teal-400 font-medium opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-sm">
                                    Find Opponent <Zap className="w-4 h-4 ml-2 fill-current" />
                                </div>
                            </div>
                        </div>

                        {/* Ranked with Friend (Real Multiplayer) Card */}
                        <div
                            onClick={() => setSelectedMode('multiplayer')}
                            className="group relative overflow-hidden rounded-3xl border border-border bg-card/50 p-6 transition-all cursor-pointer hover:border-violet-500/50 hover:shadow-[0_0_40px_-10px_rgba(139,92,246,0.1)] hover:-translate-y-1"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                            <div className="relative z-10 flex flex-col h-full gap-5">
                                <div className="p-3 w-fit rounded-2xl bg-violet-500/10 text-violet-400 group-hover:scale-110 transition-transform duration-300 ring-1 ring-violet-500/20">
                                    <Swords className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold mb-2 text-foreground group-hover:text-violet-400 transition-colors">Ranked w/ Friends</h2>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Create a private room or join a friend via code. Race head-to-head in real-time.
                                    </p>
                                </div>
                                <div className="mt-auto pt-4 flex items-center text-violet-400 font-medium opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-sm">
                                    Create/Join Room <Users className="w-4 h-4 ml-2 fill-current" />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Typing Test Component (Centered)
                    <div className="w-full max-w-6xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        {/* Removed local toolbar, now using global header/sidebar */}
                        <TypingTest
                            initialMultiplayer={selectedMode === 'multiplayer'}
                            aiMode={selectedMode === 'ranked_race'}
                            initialConfig={
                                selectedMode === 'solo'
                                    ? soloConfig || undefined
                                    : selectedMode === 'ranked_race'
                                        ? rankedConfig || undefined
                                        : undefined
                            }
                        />
                    </div>
                )}
            </main>

            {selectedMode === null && <Footer />}

            <LaptopSuggestionModal
                isOpen={showLaptopSuggestion}
                onClose={() => setShowLaptopSuggestion(false)}
            />

            <RankedConfigModal
                open={isSoloConfigOpen}
                onOpenChange={setIsSoloConfigOpen}
                title="Solo Practice Setup"
                description="Configure your practice settings before starting."
                actionLabel="Start Practice"
                icon={<User className="w-6 h-6 text-teal-400" />}
                onStart={(config) => {
                    setSoloConfig(config);
                    setSelectedMode('solo');
                }}
            />

            <RankedConfigModal
                open={isRankedConfigOpen}
                onOpenChange={setIsRankedConfigOpen}
                onStart={(config) => {
                    setRankedConfig(config);
                    setSelectedMode('ranked_race');
                }}
            />

            <KeyboardShortcutsOverlay />
        </div>
    );
};

import DebugErrorBoundary from '@/components/DebugErrorBoundary';

const PracticeWithBoundary = () => (
    <DebugErrorBoundary>
        <Practice />
    </DebugErrorBoundary>
);

export default PracticeWithBoundary;
