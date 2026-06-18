import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Player } from '@/hooks/useMultiplayer';
import { Trophy, Medal, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import UserAvatar from '../UserAvatar';

interface MultiplayerResultsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    multiplayer: {
        players: Player[];
        playerId: string;
        gameState: string;
    };
    onRestart: () => void;
    results: {
        wpm: number;
        accuracy: number;
        time: number;
        errorCount: number;
    };
}

const MultiplayerResults = ({ open, onOpenChange, multiplayer, onRestart, results }: MultiplayerResultsProps) => {
    // Rank competitors by performance: completion progress first, then speed
    // (WPM), then accuracy as the final tie-breaker. This keeps the standings
    // fair even for players who did not finish (DNF) and have no finish rank.
    const sortedPlayers = useMemo(() => [...multiplayer.players].sort((a, b) => {
        if (b.progress !== a.progress) return b.progress - a.progress;
        if (b.wpm !== a.wpm) return b.wpm - a.wpm;
        return (b.accuracy ?? 0) - (a.accuracy ?? 0);
    }), [multiplayer.players]);

    const winner = sortedPlayers[0];
    const isWinner = winner?.id === multiplayer.playerId;
    const maxWpm = useMemo(() => Math.max(...sortedPlayers.map(pl => pl.wpm), 80), [sortedPlayers]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="dark sm:max-w-md bg-[#0f172a] border-white/10 p-0 overflow-hidden">
                <div className="relative p-6 bg-gradient-to-b from-primary/10 to-transparent text-center">
                    <DialogHeader>
                        <div className="mx-auto mb-4 relative">
                            <div className={cn(
                                "w-16 h-16 rounded-full flex items-center justify-center border-4 shadow-[0_0_30px_rgba(255,255,255,0.1)]",
                                isWinner ? "border-yellow-400 bg-yellow-400/10 shadow-[0_0_30px_rgba(250,204,21,0.3)]" : "border-primary/20 bg-black/40"
                            )}>
                                <Trophy className={cn("w-8 h-8", isWinner ? "text-yellow-400" : "text-primary")} />
                            </div>
                            {isWinner && <div className="absolute -top-2 -right-2 text-2xl animate-bounce">👑</div>}
                        </div>
                        <DialogTitle className="text-2xl font-bold tracking-tight">Race Finished!</DialogTitle>
                        <DialogDescription>
                            {isWinner ? "You won the race! 🎉" : "Good game! Here are the results."}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 pt-2 space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-2 pb-2 border-b border-white/5">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Group Test Results</h3>
                            <span className="text-xs text-muted-foreground">{new Date().toLocaleDateString()}</span>
                        </div>
                        {sortedPlayers.map((player, index) => {
                            const isMe = player.id === multiplayer.playerId;
                            let rankIcon = null;
                            if (index === 0) rankIcon = <Trophy className="w-4 h-4 text-yellow-400" />;
                            else if (index === 1) rankIcon = <Medal className="w-4 h-4 text-slate-300" />;
                            else if (index === 2) rankIcon = <Medal className="w-4 h-4 text-amber-600" />;
                            else rankIcon = <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>;

                            return (
                                <div
                                    key={player.id}
                                    className={cn(
                                        "flex items-center justify-between p-3 rounded-lg border transition-all",
                                        isMe ? "bg-primary/5 border-primary/20" : "bg-secondary/20 border-white/5"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 flex justify-center">
                                            {rankIcon}
                                        </div>
                                        <UserAvatar
                                            src={player.avatarUrl}
                                            name={player.name}
                                            className="w-8 h-8 border border-white/10"
                                            showBorder={false}
                                        />
                                        <div className="flex flex-col">
                                            <span className={cn("text-sm font-bold", isMe ? "text-primary" : "text-foreground")}>
                                                {player.name} {isMe && "(You)"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-bold text-foreground">{Math.round(player.wpm)} WPM</span>
                                            {/* Fix: Prioritize player.accuracy, fallback to 100 only if undefined, but if 0 it should show 0 if they typed poorly, though usually >0 */}
                                            <span className="text-[10px] text-muted-foreground">{player.accuracy !== undefined ? player.accuracy : 0}% acc</span>
                                        </div>
                                        {player.progress < 100 && (
                                            <div className="text-xs text-muted-foreground/50 italic">DNF</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Performance Comparison Chart */}
                    <div className="space-y-3 pt-2">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Performance Analysis</h3>
                        <div className="bg-black/20 rounded-lg p-4 space-y-4">
                            {sortedPlayers.map(p => {
                                const isMe = p.id === multiplayer.playerId;
                                const width = Math.min(100, (p.wpm / maxWpm) * 100);

                                return (
                                    <div key={p.id} className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className={cn(isMe ? "text-teal-400 font-bold" : "text-muted-foreground")}>{p.name}</span>
                                            <span className="text-muted-foreground">{p.wpm} wpm</span>
                                        </div>
                                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className={cn("h-full rounded-full transition-all duration-1000", isMe ? "bg-teal-500" : "bg-white/20")}
                                                style={{ width: `${width}%` }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1 border-teal-500/20 hover:bg-teal-500/10 hover:text-teal-400" onClick={() => window.print()}>
                            Download Report
                        </Button>
                        <Button className="flex-1 bg-teal-500 hover:bg-teal-600 text-black font-bold" onClick={onRestart}>
                            New Race
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default MultiplayerResults;
