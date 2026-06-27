import React, { useMemo, useRef } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { RotateCcw, Home, Share2, Linkedin, Camera, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TestResultsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    stats: {
        wpm: number;
        accuracy: number;
        errorCount: number;
        time: number;
        history: { time: number; wpm: number; raw: number }[];
        keystrokeData: { key: string; latency: number; isError: boolean }[];
    };
    onRestart: () => void;
}

const KEYBOARD_ROWS = [
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l'],
    ['z','x','c','v','b','n','m'],
];

const KeyHeatmap = ({ keystrokeData }: { keystrokeData: { key: string; latency: number; isError: boolean }[] }) => {
    // Aggregate avg latency per key (ignore first keystroke with 0 latency)
    const { keyStats, minL, maxL, slowestKeys } = useMemo(() => {
    const keyStats = keystrokeData.reduce<Record<string, { total: number; count: number; errors: number }>>((acc, k) => {
        if (k.latency === 0) return acc;
        if (!acc[k.key]) acc[k.key] = { total: 0, count: 0, errors: 0 };
        acc[k.key].total += k.latency;
        acc[k.key].count += 1;
        if (k.isError) acc[k.key].errors += 1;
        return acc;
    }, {});

    const latencies = Object.values(keyStats).map(v => v.total / v.count);
    const minL = latencies.length > 0 ? Math.min(...latencies) : 0;
    const maxL = latencies.length > 0 ? Math.max(...latencies) : 0;
    const slowestKeys = Object.entries(keyStats)
        .map(([key, s]) => ({ key, avg: Math.round(s.total / s.count), errors: s.errors }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 5);

    return { keyStats, minL, maxL, slowestKeys };
    }, [keystrokeData]);

    const getColor = (key: string) => {
        const s = keyStats[key];
        if (!s || s.count === 0) return 'bg-white/5 text-white/20';
        const avg = s.total / s.count;
        const norm = maxL === minL ? 0.5 : (avg - minL) / (maxL - minL);
        if (norm < 0.33) return 'bg-emerald-500/30 text-emerald-300 border-emerald-500/40';
        if (norm < 0.66) return 'bg-yellow-500/30 text-yellow-300 border-yellow-500/40';
        return 'bg-red-500/30 text-red-300 border-red-500/40';
    };

    if (keystrokeData.length < 5) return null;

    return (
        <div className="mt-3 bg-secondary/10 rounded-2xl border border-white/5 p-2.5 md:p-3">
            <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                Keystroke Heatmap
            </h3>
            <div className="flex flex-col items-center gap-1 mb-2">
                {KEYBOARD_ROWS.map((row, ri) => (
                    <div key={ri} className="flex gap-1" style={{ marginLeft: ri === 1 ? '0.75rem' : ri === 2 ? '1.5rem' : 0 }}>
                        {row.map(key => (
                            <div
                                key={key}
                                title={keyStats[key] ? `avg ${Math.round(keyStats[key].total / keyStats[key].count)}ms` : 'no data'}
                                className={cn(
                                    'w-6 h-6 rounded-md border flex items-center justify-center text-xs font-mono font-bold transition-all',
                                    getColor(key)
                                )}
                            >
                                {key}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40"></span>Fast</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-500/40"></span>Medium</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/40"></span>Slow</span>
                </div>
                {slowestKeys.length > 0 && (
                    <div className="text-[10px] text-muted-foreground">
                        Slowest: {slowestKeys.map(k => (
                            <span key={k.key} className="font-mono text-red-400 ml-1">{k.key}({k.avg}ms)</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#0f172a] border border-white/10 p-3 rounded-lg shadow-xl text-xs">
                <p className="text-muted-foreground font-mono mb-1">Time: {label}s</p>
                <div className="space-y-1">
                    <p className="font-bold text-primary flex items-center justify-between gap-4">
                        <span>WPM:</span>
                        <span className="font-mono">{payload[0].value}</span>
                    </p>
                    {/* Assuming payload[0].payload contains the full data object */}
                    <p className="font-medium text-muted-foreground flex items-center justify-between gap-4">
                        <span>Raw:</span>
                        <span className="font-mono">{payload[0].payload.raw}</span>
                    </p>
                </div>
            </div>
        );
    }
    return null;
};

const TestResults = ({ open, onOpenChange, stats, onRestart }: TestResultsProps) => {
    const { user } = useAuth();
    const reportRef = useRef<HTMLDivElement>(null);

    const speedStats = useMemo(() => {
        const wpms = (stats.history ?? []).map((d) => d.wpm);
        if (wpms.length === 0) return { avg: 0, peak: 0, consistency: 0 };
        const mean = wpms.reduce((a, b) => a + b, 0) / wpms.length;
        const sd = Math.sqrt(wpms.reduce((s, w) => s + (w - mean) ** 2, 0) / wpms.length);
        return {
            avg: Math.round(mean),
            peak: Math.max(...wpms),
            consistency: Math.max(0, Math.round((1 - sd / mean) * 100)),
        };
    }, [stats.history]);

    const handleScreenshot = async () => {
        if (reportRef.current) {
            try {
                const canvas = await html2canvas(reportRef.current, {
                    backgroundColor: '#0f172a',
                    scale: 2,
                    logging: false,
                    useCORS: true
                });

                const link = document.createElement('a');
                link.download = `typespeak-report-${new Date().toISOString().split('T')[0]}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                toast.success('Report downloaded successfully!');
            } catch (err) {
                console.error('Screenshot failed:', err);
                toast.error('Failed to capture report. Try again.');
            }
        }
    };

    const handleShare = () => {
        const text = `I just hit ${stats.wpm} WPM with ${stats.accuracy}% accuracy on TypeSpeakPro! 🚀 \n\nCheck out my progress and challenge me! #TypeSpeakPro #Coding #TypingSpeed`;
        const url = 'https://typespeakpro.com';
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&summary=${encodeURIComponent(text)}`, '_blank');
    };
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0 gap-0 border-none bg-transparent shadow-none sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden">

                {/* Scrollable content area — only scrolls if the screen is too short */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide">
                    {/* Captured Report Area */}
                    <div
                        ref={reportRef}
                        className="relative w-full bg-[#0f172a] border border-white/10 rounded-2xl p-4 md:p-5 shadow-2xl overflow-hidden"
                    >
                        {/* Backgrounds */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 border-b border-white/5 pb-4 relative z-10 gap-4">
                            <div className="space-y-1">
                                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                                    TypeSpeakPro
                                </h2>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Performance Certified</p>
                            </div>
                            <div className="flex items-center gap-4 self-end md:self-auto">
                                <div className="text-right">
                                    <p className="font-medium text-foreground text-sm md:text-lg">{user?.name || 'Guest Agent'}</p>
                                    <p className="text-[10px] md:text-xs text-muted-foreground font-mono">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                </div>
                                {user?.picture ? (
                                    <img src={user.picture} alt="User" className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-primary/20 shadow-lg object-cover" />
                                ) : (
                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-secondary flex items-center justify-center border border-white/10">
                                        <span className="text-lg font-bold text-muted-foreground">?</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10">
                            {/* Stats Column */}
                            <div className="md:col-span-4 space-y-4">
                                <div className="bg-secondary/20 p-5 rounded-2xl border border-white/5 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                    <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold mb-1">Typing Speed</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-5xl md:text-6xl font-mono font-bold text-foreground">{stats.wpm}</p>
                                        <span className="text-lg md:text-xl text-primary font-medium">WPM</span>
                                    </div>
                                </div>

                                <div className="bg-secondary/20 p-5 rounded-2xl border border-white/5">
                                    <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold mb-1">Accuracy</p>
                                    <p className={cn("text-4xl md:text-5xl font-mono font-bold", stats.accuracy >= 95 ? "text-green-400" : "text-yellow-400")}>
                                        {stats.accuracy}%
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-secondary/20 p-4 rounded-xl border border-white/5">
                                        <p className="text-muted-foreground text-[9px] uppercase tracking-wider mb-1">Time</p>
                                        <p className="text-xl md:text-2xl font-mono font-bold text-foreground">{stats.time}s</p>
                                    </div>
                                    <div className="bg-secondary/20 p-4 rounded-xl border border-white/5">
                                        <p className="text-muted-foreground text-[9px] uppercase tracking-wider mb-1">Errors</p>
                                        <p className="text-xl md:text-2xl font-mono font-bold text-red-400">{stats.errorCount}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Chart Column */}
                            <div className="md:col-span-8 space-y-0">
                                <div className="bg-secondary/10 rounded-2xl border border-white/5 p-3 md:p-4 flex flex-col">
                                    <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                        Speed Analysis (WPM)
                                    </h3>
                                    <div className="flex-1 min-h-[140px] w-full">
                                        {/* Chart Visuals */}
                                        <ResponsiveContainer width="100%" height={150}>
                                            <AreaChart data={stats.history} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorWpmModal" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                                <XAxis
                                                    dataKey="time"
                                                    stroke="#475569"
                                                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                                                    tickFormatter={(val) => `${val}s`}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    dy={5}
                                                />
                                                <YAxis
                                                    stroke="#475569"
                                                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    domain={['dataMin - 5', 'auto']}
                                                />
                                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                                                <Area
                                                    type="monotone"
                                                    dataKey="wpm"
                                                    stroke="#2dd4bf"
                                                    strokeWidth={2}
                                                    fillOpacity={1}
                                                    fill="url(#colorWpmModal)"
                                                    animationDuration={1500}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 mt-4">
                                        <div className="bg-secondary/20 p-3 rounded-xl border border-white/5">
                                            <p className="text-muted-foreground text-[9px] uppercase tracking-wider mb-1">Average</p>
                                            <p className="text-xl md:text-2xl font-mono font-bold text-foreground">{speedStats.avg}<span className="text-xs text-muted-foreground ml-1">wpm</span></p>
                                        </div>
                                        <div className="bg-secondary/20 p-3 rounded-xl border border-white/5">
                                            <p className="text-muted-foreground text-[9px] uppercase tracking-wider mb-1">Peak</p>
                                            <p className="text-xl md:text-2xl font-mono font-bold text-primary">{speedStats.peak}<span className="text-xs text-muted-foreground ml-1">wpm</span></p>
                                        </div>
                                        <div className="bg-secondary/20 p-3 rounded-xl border border-white/5">
                                            <p className="text-muted-foreground text-[9px] uppercase tracking-wider mb-1">Consistency</p>
                                            <p className="text-xl md:text-2xl font-mono font-bold text-foreground">{speedStats.consistency}%</p>
                                        </div>
                                    </div>
                                </div>
                                <KeyHeatmap keystrokeData={stats.keystrokeData} />
                            </div>
                        </div>

                        {/* Footer / Branding */}
                        <div className="flex justify-between items-center pt-3 border-t border-white/5 relative z-10 mt-1">
                            <div className="flex items-center gap-2 text-white/20">
                                <span className="text-[10px] font-mono">ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                            </div>
                            <p className="text-[10px] text-white/20 font-medium">typespeakpro.com</p>
                        </div>
                    </div>
                </div>

                {/* Interaction Buttons — pinned footer, always visible, never overlaps the content */}
                <div className="flex-shrink-0 bg-background/80 backdrop-blur-xl md:bg-transparent md:backdrop-blur-none p-3 md:p-4 flex flex-wrap justify-center gap-2 md:gap-3 border-t items-center md:border-t-0 border-white/5">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 rounded-full border-white/10 hover:bg-white/5 text-xs md:text-sm"
                        onClick={() => window.location.href = '/'}
                    >
                        <Home className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span className="hidden sm:inline">Home</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 rounded-full border-white/10 hover:bg-white/5 bg-secondary/50 text-xs md:text-sm"
                        onClick={handleScreenshot}
                    >
                        <Camera className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span className="hidden sm:inline">Save</span> Report
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 rounded-full border-white/10 hover:bg-[#0077b5]/20 hover:text-[#0077b5] bg-secondary/50 text-xs md:text-sm"
                        onClick={handleShare}
                    >
                        <Linkedin className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        Share
                    </Button>

                    <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block"></div>

                    <Button
                        size="lg"
                        className="gap-2 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground min-w-[120px] shadow-lg shadow-primary/20 text-sm md:text-base ml-2"
                        onClick={() => {
                            onOpenChange(false);
                            onRestart();
                        }}
                    >
                        <RotateCcw className="w-4 h-4" />
                        Next Test
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default TestResults;