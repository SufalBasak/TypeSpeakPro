import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Keyboard, RotateCcw, Home, Users, Trophy, HelpCircle, Hash, Type, AlignLeft } from "lucide-react";

interface ShortcutGroup {
    title: string;
    shortcuts: { keys: string[]; description: string }[];
}

const shortcutGroups: ShortcutGroup[] = [
    {
        title: "Typing Test",
        shortcuts: [
            { keys: ["Tab"], description: "Reset / Restart current test" },
            { keys: ["Esc"], description: "Exit fullscreen / Close modals" },
            { keys: ["?"], description: "Toggle this shortcuts reference" },
        ],
    },
    {
        title: "Test Configuration",
        shortcuts: [
            { keys: ["W"], description: "Switch to Words mode" },
            { keys: ["S"], description: "Switch to Sentences mode" },
            { keys: ["P"], description: "Switch to Paragraphs mode" },
            { keys: ["1"], description: "Set timer to 15 seconds" },
            { keys: ["2"], description: "Set timer to 30 seconds" },
            { keys: ["3"], description: "Set timer to 60 seconds" },
            { keys: ["4"], description: "Set timer to 120 seconds" },
            { keys: ["N"], description: "Toggle numbers inclusion" },
            { keys: ["M"], description: "Toggle punctuation inclusion" },
        ],
    },
    {
        title: "Difficulty",
        shortcuts: [
            { keys: ["E"], description: "Set difficulty to Easy" },
            { keys: ["D"], description: "Set difficulty to Medium" },
            { keys: ["R"], description: "Set difficulty to Hard" },
        ],
    },
    {
        title: "Navigation",
        shortcuts: [
            { keys: ["H"], description: "Go to Home page" },
            { keys: ["G"], description: "Go to Dashboard" },
            { keys: ["L"], description: "Go to Leaderboard" },
            { keys: ["Ctrl", "K"], description: "Open command palette" },
        ],
    },
];

const KeyboardShortcutsOverlay = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggle = useCallback(() => {
        setIsOpen(prev => !prev);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                toggle();
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggle, isOpen]);

    return (
        <>
            {/* Help button */}
            <button
                onClick={toggle}
                className="fixed bottom-24 right-6 z-40 p-3 rounded-full bg-card border border-border shadow-lg hover:bg-muted transition-all duration-200 hover:scale-110 group"
                title="Keyboard Shortcuts (?)"
                aria-label="Toggle keyboard shortcuts"
            >
                <HelpCircle className="w-5 h-5 text-muted-foreground group-hover:text-teal-400 transition-colors" />
            </button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-2xl bg-[#0f172a]/95 backdrop-blur-3xl border-white/10 p-0 overflow-hidden shadow-2xl max-h-[90vh]">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-transparent pointer-events-none" />

                    <div className="relative p-6 md:p-8 overflow-y-auto max-h-[90vh] custom-scrollbar">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20">
                                <Keyboard className="w-5 h-5 text-teal-400" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-foreground">
                                    Keyboard Shortcuts
                                </DialogTitle>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-xs font-mono">?</kbd> to toggle this reference
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {shortcutGroups.map((group) => (
                                <div key={group.title} className="space-y-3">
                                    <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider flex items-center gap-2">
                                        <span className="w-1 h-4 rounded-full bg-teal-400/50" />
                                        {group.title}
                                    </h3>
                                    <div className="space-y-2">
                                        {group.shortcuts.map((shortcut) => (
                                            <div
                                                key={shortcut.keys.join('+')}
                                                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                                            >
                                                <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                                                <div className="flex items-center gap-1">
                                                    {shortcut.keys.map((key, i) => (
                                                        <React.Fragment key={key}>
                                                            {i > 0 && <span className="text-xs text-muted-foreground/50">+</span>}
                                                            <kbd className="px-2 py-0.5 rounded-md bg-muted border border-border text-xs font-mono text-foreground shadow-sm">
                                                                {key}
                                                            </kbd>
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 p-4 rounded-xl bg-teal-500/5 border border-teal-500/10">
                            <p className="text-xs text-muted-foreground text-center">
                                Shortcuts are active on the Practice page. Some shortcuts may be disabled while typing is active to prevent accidental triggers.
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default KeyboardShortcutsOverlay;
