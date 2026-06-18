import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Loader2, Users, ArrowRight, CheckCircle2, Circle, Play, Crown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { InlineError } from '@/components/async';
import type { AsyncErrorMetadata } from '@/types/async';
import { logAsyncError, toUserSafeError } from '@/types/async';

import { generateWords, generateSentences, PARAGRAPHS_EASY, PARAGRAPHS_MEDIUM, PARAGRAPHS_HARD, applyTextTransformations } from '@/lib/text-generation';

interface MultiplayerModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    multiplayer: ReturnType<typeof useMultiplayer>;
}

// Helper to generate text based on config
const generateTextForConfig = (mode: 'words' | 'sentences' | 'paragraphs', difficulty: 'easy' | 'medium' | 'hard') => {
    if (mode === 'words') {
        return generateWords(100, false, false, difficulty);
    } else if (mode === 'sentences') {
        return generateSentences(100, difficulty);
    } else {
        let source = PARAGRAPHS_MEDIUM;
        if (difficulty === 'easy') source = PARAGRAPHS_EASY;
        if (difficulty === 'hard') source = PARAGRAPHS_HARD;
        return source[Math.floor(Math.random() * source.length)];
    }
};

const MultiplayerModal = ({ open, onOpenChange, multiplayer }: MultiplayerModalProps) => {
    const {
        roomCode,
        gameState,
        players,
        isHost,
        createRoom,
        joinRoom,
        toggleReady,
        startGame,
        cleanup
    } = multiplayer;

    const [inputCode, setInputCode] = useState<string>("");
    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [actionError, setActionError] = useState<AsyncErrorMetadata | null>(null);
    const [activeTab, setActiveTab] = useState("create");

    const handleCreateRoom = async () => {
        if (isCreating) return;
        setIsCreating(true);
        setActionError(null);
        try {
            await createRoom();
            toast.success("Room created! Share the code.");
        } catch (e) {
            logAsyncError('multiplayer.createRoom', e);
            setActionError(toUserSafeError(e, {
                title: 'Room could not be created',
                message: 'Realtime connection setup failed. Retry to create a room.',
            }));
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoinRoom = async () => {
        if (isJoining) return;
        if (!inputCode || inputCode.length < 4) {
            toast.error("Please enter a valid room code");
            return;
        }
        setIsJoining(true);
        setActionError(null);
        try {
            await joinRoom(inputCode.toUpperCase());
            // We don't close the modal immediately, we show the lobby
        } catch (e) {
            logAsyncError('multiplayer.joinRoom', e);
            setActionError(toUserSafeError(e, {
                title: 'Room could not be joined',
                message: 'We could not connect to that room. Check the code and retry.',
            }));
        } finally {
            setIsJoining(false);
        }
    };

    const copyCode = () => {
        if (roomCode) {
            navigator.clipboard.writeText(roomCode);
            toast.success("Code copied!");
        }
    };

    const copyLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (roomCode) {
            const link = `${window.location.origin}/practice?room=${roomCode}`;
            navigator.clipboard.writeText(link);
            toast.success("Invite link copied!");
        }
    };

    const handleClose = () => {
        // If in lobby/game, maybe confirm exit? For now just close UI.
        onOpenChange(false);
        // cleanup(); // Optional: Decide if closing modal leaves room. For now, let's keep connection for background sync? 
        // Actually, typically closing modal while in lobby might mean disconnect. 
        // But for better UX, maybe we keep them connected until they explicitly leave or navigate away?
        // Let's assume closing modal HIDES it. Passing 'open' prop handles visibility.
    };

    // Derived state
    const isReady = players.find(p => p.id === multiplayer.playerId)?.isReady;
    const allReady = players.length > 0 && players.every(p => p.isReady);
    const canStart = isHost && allReady;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="dark sm:max-w-md bg-[#0f172a] border-white/10 p-0 overflow-hidden gap-0">
                {/* Header Section with Gradient */}
                <div className="relative p-6 bg-gradient-to-b from-primary/10 to-transparent">
                    <DialogHeader className="relative z-10">
                        <div className="mx-auto bg-primary/20 w-12 h-12 rounded-full flex items-center justify-center mb-4 border border-primary/20 shadow-[0_0_15px_rgba(45,212,191,0.3)]">
                            <Users className="w-6 h-6 text-primary" />
                        </div>
                        <DialogTitle className="text-center text-xl font-bold tracking-tight">Multiplayer Arena</DialogTitle>
                        <DialogDescription className="text-center text-muted-foreground">
                            {roomCode ? `Lobby: ${roomCode}` : "Challenge your friends to a real-time typing race."}
                        </DialogDescription>
                    </DialogHeader>
                    {/* Background blob */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[50px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
                </div>

                <div className="p-6 pt-2">
                    <InlineError
                        error={actionError}
                        onRetry={activeTab === 'create' ? handleCreateRoom : handleJoinRoom}
                        className="mb-4"
                    />
                    {!roomCode ? (
                        // Initial View: Create or Join
                        <Tabs defaultValue="create" value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50">
                                <TabsTrigger value="create">Create Room</TabsTrigger>
                                <TabsTrigger value="join">Join Room</TabsTrigger>
                            </TabsList>

                            {/* Create Room Tab */}
                            <TabsContent value="create" className="space-y-4 focus-visible:ring-0 outline-none">
                                <div className="flex flex-col items-center justify-center space-y-4 min-h-[200px] border border-dashed border-white/10 rounded-xl bg-black/20 p-6">
                                    <div className="text-center space-y-4">
                                        <p className="text-sm text-muted-foreground">Generate a unique code to invite your friend.</p>
                                        <Button
                                            onClick={handleCreateRoom}
                                            disabled={isCreating}
                                            className="min-w-[140px]"
                                        >
                                            {isCreating ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Creating...
                                                </>
                                            ) : (
                                                "Generate Code"
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Join Room Tab */}
                            <TabsContent value="join" className="space-y-4 focus-visible:ring-0 outline-none">
                                <div className="flex flex-col space-y-4 min-h-[200px] justify-center">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted-foreground pl-1">Room Code</label>
                                        <div className="relative">
                                            <Input
                                                placeholder="Ex: X7K9P2"
                                                value={inputCode}
                                                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                                                className="text-center font-mono text-xl tracking-widest uppercase h-14 bg-secondary/30 border-white/10 focus:border-primary/50"
                                                maxLength={6}
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        className="w-full h-12 text-lg font-medium"
                                        onClick={handleJoinRoom}
                                        disabled={isJoining || inputCode.length < 3}
                                    >
                                        {isJoining ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Connecting...
                                            </>
                                        ) : (
                                            <>
                                                Join Match
                                                <ArrowRight className="ml-2 h-5 w-5" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </TabsContent>
                        </Tabs>
                    ) : (
                        // Lobby View
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="text-center">
                                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Group Number</p>
                                <div
                                    className="flex items-center justify-center gap-3 bg-secondary/50 border border-primary/20 rounded-xl p-3 cursor-pointer hover:bg-secondary/70 transition-colors group mb-4"
                                    onClick={copyCode}
                                >
                                    <span className="text-3xl font-mono font-bold text-primary tracking-[0.2em]">{roomCode}</span>
                                    <Copy className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                                <div
                                    className="text-[10px] text-muted-foreground hover:text-primary cursor-pointer flex items-center justify-center gap-1 transition-colors mb-6"
                                    onClick={copyLink}
                                >
                                    <span>or copy invite link</span>
                                    <ArrowRight className="w-3 h-3" />
                                </div>

                                {/* Room Settings Configuration */}
                                <div className="bg-secondary/20 rounded-lg p-4 mb-6 border border-white/5">
                                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-bold">Room Settings</p>

                                    {isHost ? (
                                        <div className="grid grid-cols-1 gap-4">
                                            {/* Mode Selection */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Mode</span>
                                                <div className="flex gap-1 bg-black/20 p-1 rounded-lg">
                                                    {(['words', 'sentences', 'paragraphs'] as const).map(m => (
                                                        <button
                                                            key={m}
                                                            onClick={() => {
                                                                const newText = generateTextForConfig(m, multiplayer.roomConfig?.difficulty || 'medium');
                                                                multiplayer.broadcastConfig({ ...multiplayer.roomConfig, mode: m, text: newText } as any);
                                                            }}
                                                            className={cn(
                                                                "px-2 py-1 text-xs rounded-md transition-all capitalize",
                                                                multiplayer.roomConfig?.mode === m ? "bg-primary text-primary-foreground font-bold shadow-sm" : "text-muted-foreground hover:text-foreground"
                                                            )}
                                                        >
                                                            {m}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Time Selection */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Time</span>
                                                <div className="flex gap-1 bg-black/20 p-1 rounded-lg">
                                                    {[15, 30, 60, 120].map(t => (
                                                        <button
                                                            key={t}
                                                            onClick={() => multiplayer.broadcastConfig({ ...multiplayer.roomConfig, duration: t } as any)}
                                                            className={cn(
                                                                "px-2 py-1 text-xs rounded-md transition-all font-mono",
                                                                multiplayer.roomConfig?.duration === t ? "bg-primary text-primary-foreground font-bold shadow-sm" : "text-muted-foreground hover:text-foreground"
                                                            )}
                                                        >
                                                            {t}s
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Difficulty Selection */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Difficulty</span>
                                                <div className="flex gap-1 bg-black/20 p-1 rounded-lg">
                                                    {(['easy', 'medium', 'hard'] as const).map(d => (
                                                        <button
                                                            key={d}
                                                            onClick={() => {
                                                                const newText = generateTextForConfig(multiplayer.roomConfig?.mode || 'words', d);
                                                                multiplayer.broadcastConfig({ ...multiplayer.roomConfig, difficulty: d, text: newText } as any);
                                                            }}
                                                            className={cn(
                                                                "px-2 py-1 text-xs rounded-md transition-all capitalize",
                                                                multiplayer.roomConfig?.difficulty === d ? "bg-primary text-primary-foreground font-bold shadow-sm" : "text-muted-foreground hover:text-foreground"
                                                            )}
                                                        >
                                                            {d}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // GUEST VIEW - Read Only
                                        <div className="flex flex-wrap justify-center gap-2">
                                            <div className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary capitalize flex items-center gap-2">
                                                <span className="opacity-50">Mode:</span> {multiplayer.roomConfig?.mode || 'words'}
                                            </div>
                                            <div className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary flex items-center gap-2">
                                                <span className="opacity-50">Time:</span> {multiplayer.roomConfig?.duration || 30}s
                                            </div>
                                            <div className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary capitalize flex items-center gap-2">
                                                <span className="opacity-50">Diff:</span> {multiplayer.roomConfig?.difficulty || 'medium'}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Player List */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                                    <span>PLAYERS ({players.length})</span>
                                    <span>STATUS</span>
                                </div>
                                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                    {(players || []).map((player) => {
                                        if (!player) return null;
                                        return (
                                            <div
                                                key={player.id || Math.random()}
                                                className="flex items-center justify-between bg-secondary/30 rounded-lg p-3 border border-white/5"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs"
                                                        style={{ backgroundColor: player.color || '#666' }}
                                                    >
                                                        {(player.name || "Guest").substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-sm flex items-center gap-2">
                                                        {player.name || "Unknown Player"}
                                                        {players && players.length > 0 && player.id === players[0]?.id && isHost && <Crown className="w-3 h-3 text-yellow-500" />}
                                                    </span>
                                                </div>
                                                <div className={cn(
                                                    "flex items-center gap-2 text-xs font-medium px-2 py-1 rounded-full",
                                                    player.isReady ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                                                )}>
                                                    {player.isReady ? (
                                                        <>Ready <CheckCircle2 className="w-3 h-3" /></>
                                                    ) : (
                                                        <>Waiting <Circle className="w-3 h-3" /></>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={toggleReady}
                                >
                                    {isReady ? "Not Ready" : "Ready Up"}
                                </Button>

                                {isHost && (
                                    <Button
                                        className="flex-1"
                                        disabled={!allReady || players.length < 1}
                                        onClick={startGame}
                                    >
                                        {!allReady ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Waiting for Ready...
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-4 h-4 mr-2" /> Start Race
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default MultiplayerModal;
