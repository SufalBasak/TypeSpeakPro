import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Zap, Keyboard, Trophy, Calendar, User, Mail, Shield, BookOpen, Mic } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { EmptyState, InlineError, SectionSkeleton } from '@/components/async';
import { useRetryableAction } from '@/hooks/useRetryableAction';

const Dashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [fullHistory, setFullHistory] = useState<any[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [stats, setStats] = useState({
        avgWpm: 0,
        avgAccuracy: 0,
        totalTime: 0,
        testsCompleted: 0,
        bestWpm: 0,
        rank: 0,
        voicePoints: 0,
        voiceAccuracy: 0,
        verbalPoints: 0,
        verbalAccuracy: 0
    });
    const [weeklyData, setWeeklyData] = useState<any[]>([]);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);

    const fetchDashboardData = useCallback(async () => {
        if (!user?.id) return;

        // Fetch all results for the user for general stats
        const { data: allResults, error } = await supabase
            .from('test_results')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        const { data: practiceResults, error: practiceError } = await supabase
            .from('practice_results')
            .select('*')
            .eq('user_id', user.id); // Fetch practice results

        if (error || !allResults) {
            throw error ?? new Error('DASHBOARD_RESULTS_MISSING');
        }

        if (practiceError) {
            throw practiceError;
        }

        setFullHistory(allResults);

        // 1. Calculate Aggregates
        const totalTests = allResults.length;
        const avgWpm = totalTests > 0 ? Math.round(allResults.reduce((acc, curr) => acc + curr.wpm, 0) / totalTests) : 0;
        const avgAccuracy = totalTests > 0 ? Math.round(allResults.reduce((acc, curr) => acc + curr.accuracy, 0) / totalTests) : 0;
        const totalTimeSeconds = allResults.reduce((acc, curr) => acc + curr.time_duration, 0);

        const bestWpm = totalTests > 0 ? Math.max(...allResults.map(r => r.wpm)) : 0;

        // Calculate Rank (how many results are better than my best?)
        let rank = 0;
        if (bestWpm > 0) {
            const { count } = await supabase
                .from('test_results')
                .select('id', { count: 'exact', head: true })
                .gt('wpm', bestWpm);

            rank = (count || 0) + 1;
        }

        // Calculate Practice Points & Accuracy
        const voiceResults = practiceResults ? practiceResults.filter((r: any) => r.practice_type === 'listening') : [];
        const voicePoints = voiceResults.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0);
        const voiceAccuracy = voiceResults.length > 0
            ? Math.round(voiceResults.reduce((acc: number, curr: any) => acc + (curr.accuracy || 0), 0) / voiceResults.length)
            : 0;

        const verbalResults = practiceResults ? practiceResults.filter((r: any) => r.practice_type === 'verbal') : [];
        const verbalPoints = verbalResults.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0);
        const verbalAccuracy = verbalResults.length > 0
            ? Math.round(verbalResults.reduce((acc: number, curr: any) => acc + (curr.accuracy || 0), 0) / verbalResults.length)
            : 0;

        setStats({
            avgWpm,
            avgAccuracy,
            totalTime: totalTimeSeconds,
            testsCompleted: totalTests,
            bestWpm,
            rank,
            voicePoints,
            voiceAccuracy,
            verbalPoints,
            verbalAccuracy
        });

        // 2. Prepare Weekly Chart Data
        const today = new Date();
        const dailyStats = [];

        for (let i = 6; i >= 0; i--) {
            const date = subDays(today, i);
            const start = startOfDay(date).toISOString();
            const end = endOfDay(date).toISOString();

            const dayResults = allResults.filter(r => r.created_at >= start && r.created_at <= end);

            const dayAvgWpm = dayResults.length > 0
                ? Math.round(dayResults.reduce((acc, curr) => acc + curr.wpm, 0) / dayResults.length)
                : 0;

            const dayAvgAcc = dayResults.length > 0
                ? Math.round(dayResults.reduce((acc, curr) => acc + curr.accuracy, 0) / dayResults.length)
                : 0;

            dailyStats.push({
                day: format(date, 'EEE'),
                wpm: dayAvgWpm,
                accuracy: dayAvgAcc
            });
        }
        setWeeklyData(dailyStats);

        // 3. Recent Activity (Top 5)
        setRecentActivity(allResults.slice(0, 5));
    }, [user?.id]);

    const dashboardAction = useRetryableAction(fetchDashboardData, {
        errorTitle: 'Dashboard could not load',
        errorMessage: 'We could not fetch your practice history. Check your connection and retry.',
        scope: 'dashboard.fetch',
    });

    useEffect(() => {
        if (user?.id) {
            dashboardAction.run();
        }
    }, [user?.id]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m ${seconds % 60}s`;
    };

    return (
        <div className="min-h-screen bg-background text-foreground font-sans fade-in selection:bg-teal-500/30">
            <Navbar forceOpaque={true} />
            <div className="max-w-7xl mx-auto space-y-8 p-6 md:p-12 pt-24 mt-16">
                <InlineError error={dashboardAction.error} onRetry={dashboardAction.retry} />

                {/* Profile Hero Section */}
                <div className="relative overflow-hidden rounded-3xl bg-card border border-border p-8 md:p-12 shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-purple-500/5 to-transparent pointer-events-none" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
                        {/* Avatar */}
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-teal-500 to-purple-600 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000"></div>
                            {user?.picture ? (
                                <img
                                    src={user.picture}
                                    alt={user.name}
                                    className="relative w-32 h-32 rounded-full border-4 border-card object-cover shadow-xl"
                                />
                            ) : (
                                <div className="relative w-32 h-32 rounded-full border-4 border-card bg-muted flex items-center justify-center shadow-xl">
                                    <User className="w-12 h-12 text-muted-foreground" />
                                </div>
                            )}
                        </div>

                        {/* User Details */}
                        <div className="text-center md:text-left space-y-4 flex-1">
                            <div>
                                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground mb-2">
                                    {user?.name || "Guest User"}
                                </h1>
                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-muted-foreground">
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted border border-border">
                                        <Mail className="w-4 h-4" />
                                        <span className="text-sm">{user?.email || "No email linked"}</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400">
                                        <Shield className="w-4 h-4" />
                                        <span className="text-sm font-medium">Pro Member</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 mt-6 justify-center md:justify-start">
                                <div className="text-center p-3 rounded-xl bg-muted border border-border min-w-[100px]">
                                    <div className="text-2xl font-bold text-foreground">#{stats.rank > 0 ? stats.rank : '-'}</div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Global Rank</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                {dashboardAction.isPending && recentActivity.length === 0 ? (
                    <SectionSkeleton rows={6} className="rounded-xl border border-border bg-card p-6" />
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="bg-card border-border backdrop-blur-sm hover:bg-muted transition-all duration-300 group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-teal-400 transition-colors">
                                Average Speed
                            </CardTitle>
                            <Zap className="h-4 w-4 text-teal-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{stats.avgWpm} WPM</div>
                            <p className="text-xs text-muted-foreground mt-1">Best: {stats.bestWpm} WPM</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-border backdrop-blur-sm hover:bg-muted transition-all duration-300 group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-purple-400 transition-colors">
                                Accuracy
                            </CardTitle>
                            <Activity className="h-4 w-4 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{stats.avgAccuracy}%</div>
                            <p className="text-xs text-muted-foreground mt-1">Global Avg: 92%</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-border backdrop-blur-sm hover:bg-muted transition-all duration-300 group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-blue-400 transition-colors">
                                Time Practiced
                            </CardTitle>
                            <Keyboard className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{formatTime(stats.totalTime)}</div>
                            <p className="text-xs text-muted-foreground mt-1">Keep it up!</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-border backdrop-blur-sm hover:bg-muted transition-all duration-300 group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-yellow-400 transition-colors">
                                Tests Completed
                            </CardTitle>
                            <Trophy className="h-4 w-4 text-yellow-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{stats.testsCompleted}</div>
                            <p className="text-xs text-muted-foreground mt-1">Total sessions</p>
                        </CardContent>
                    </Card>

                    <Card
                        className="bg-card border-border backdrop-blur-sm hover:bg-muted transition-all duration-300 group cursor-pointer"
                        onClick={() => navigate('/voice-practice')}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigate('/voice-practice'); }}
                        role="button"
                        tabIndex={0}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-teal-400 transition-colors">
                                Voice Practice
                            </CardTitle>
                            <Mic className="h-4 w-4 text-teal-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{stats.voicePoints}</div>
                            <p className="text-xs text-muted-foreground mt-1">Total Points</p>
                            <p className="text-xs text-teal-400 mt-1">Avg Accuracy: {stats.voiceAccuracy}%</p>
                        </CardContent>
                    </Card>

                    {/* Verbal Practice Stats */}
                    <Card
                        className="bg-card border-border backdrop-blur-sm hover:bg-muted transition-all duration-300 group cursor-pointer"
                        onClick={() => navigate('/verbal-practice')}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigate('/verbal-practice'); }}
                        role="button"
                        tabIndex={0}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-green-400 transition-colors">
                                Verbal Practice
                            </CardTitle>
                            <BookOpen className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{stats.verbalPoints}</div>
                            <p className="text-xs text-muted-foreground mt-1">Total Points</p>
                            <p className="text-xs text-green-400 mt-1">Avg Accuracy: {stats.verbalAccuracy}%</p>
                        </CardContent>
                    </Card>
                </div>
                )}

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="col-span-1 lg:col-span-2 bg-card border-border backdrop-blur-md">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-foreground text-xl">Weekly Practice Report</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Performance analytics for the last 7 days.
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-lg border border-border">
                                    <Calendar className="w-4 h-4 text-teal-400" />
                                    <span className="text-xs font-medium text-foreground">Last 7 Days</span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pl-0">
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={weeklyData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="colorWpm" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                        <XAxis
                                            dataKey="day"
                                            stroke="#525252"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            stroke="#525252"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(value) => `${value}`}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: "#0a0a0a",
                                                border: "1px solid #262626",
                                                borderRadius: "12px",
                                                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
                                            }}
                                            itemStyle={{ color: "#fff" }}
                                            labelStyle={{ color: "#a1a1aa", marginBottom: "0.5rem" }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="wpm"
                                            stroke="#2dd4bf"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorWpm)"
                                            name="WPM"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="accuracy"
                                            stroke="#a855f7"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorAccuracy)"
                                            name="Accuracy (%)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recent Activity */}
                    <Card className="col-span-1 bg-card border-border backdrop-blur-md">
                        <CardHeader>
                            <CardTitle className="text-foreground text-xl">Recent Activity</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Latest session breakdown.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {recentActivity.length === 0 ? (
                                    <EmptyState title="No activity yet" description="Complete a typing test to see your latest sessions here." className="py-8" />
                                ) : (
                                    recentActivity.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0 hover:bg-muted p-2 rounded-lg transition-colors cursor-default">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-foreground capitalize">{item.mode || 'words'} Test</span>
                                                <span className="text-xs text-muted-foreground">{format(new Date(item.created_at), 'MM/dd HH:mm')}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-sm font-bold text-teal-400">{item.wpm} WPM</span>
                                                <span className={item.accuracy >= 95 ? "text-sm font-bold text-purple-400" : "text-sm font-bold text-yellow-400"}>{item.accuracy}%</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="mt-6 pt-4 border-t border-border">
                                <button
                                    onClick={() => setIsHistoryOpen(true)}
                                    className="w-full py-2 text-sm text-center text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    View All History
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Full History Modal */}
                {isHistoryOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
                            <div className="p-6 border-b border-border flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-foreground">Typing History</h2>
                                    <p className="text-sm text-muted-foreground">Complete record of your practice sessions.</p>
                                </div>
                                <button
                                    onClick={() => setIsHistoryOpen(false)}
                                    className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar">
                                <div className="rounded-lg border border-border overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-muted text-muted-foreground font-medium">
                                            <tr>
                                                <th className="px-4 py-3">Date</th>
                                                <th className="px-4 py-3">Mode</th>
                                                <th className="px-4 py-3">WPM</th>
                                                <th className="px-4 py-3">Accuracy</th>
                                                <th className="px-4 py-3">Duration</th>
                                                <th className="px-4 py-3">Errors</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {fullHistory.map((item, i) => (
                                                <tr key={i} className="hover:bg-muted transition-colors">
                                                    <td className="px-4 py-3 text-foreground">{format(new Date(item.created_at), 'MMM dd, yyyy HH:mm')}</td>
                                                    <td className="px-4 py-3 capitalize text-foreground">
                                                        <span className="px-2 py-0.5 rounded-full bg-muted border border-border text-xs">
                                                            {item.mode || 'words'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-teal-400">{item.wpm}</td>
                                                    <td className="px-4 py-3 font-bold text-purple-400">{item.accuracy}%</td>
                                                    <td className="px-4 py-3 text-muted-foreground">{item.time_duration}s</td>
                                                    <td className="px-4 py-3 text-red-400">{item.error_count || 0}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {fullHistory.length === 0 && (
                                        <div className="p-8 text-center text-muted-foreground">No history available yet.</div>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 border-t border-border flex justify-end">
                                <button
                                    onClick={() => setIsHistoryOpen(false)}
                                    className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors text-sm font-medium"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};

export default Dashboard;
