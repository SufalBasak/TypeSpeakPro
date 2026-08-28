import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { RotateCcw, Hash, Type, AlignLeft, type LucideIcon, Pilcrow, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import TestResults from './TestResults';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { useAiOpponent } from '@/hooks/useAiOpponent';
import RaceTrack from './RaceTrack';
import MultiplayerModal from './MultiplayerModal';
import MultiplayerResults from './MultiplayerResults';
import { Loader2 } from 'lucide-react';
import { Home } from 'lucide-react';
import { createMutationLock } from '@/lib/mutation-locks';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import { calculateAccuracy, calculateWpm, createAnalyticsSessionId, sanitizeMetricRecord } from '@/lib/analytics';

import {
    COMMON_WORDS, WORDS_EASY, WORDS_HARD,
    SENTENCES_EASY, SENTENCES_MEDIUM, SENTENCES_HARD,
    PARAGRAPHS_EASY, PARAGRAPHS_MEDIUM, PARAGRAPHS_HARD,
    PUNCTUATION,
    TypingMode, Difficulty,
    generateWords, generateSentences, applyTextTransformations
} from '@/lib/text-generation';

interface TypingTestProps {
    onComplete?: (stats: { wpm: number; accuracy: number; errorCount: number }) => void;
    initialMultiplayer?: boolean;
    aiMode?: boolean;
    initialConfig?: any; // Avoiding deep imports for RoomConfig
}

const TypingTest = ({ onComplete, initialMultiplayer = false, aiMode = false, initialConfig }: TypingTestProps) => {
    const { user } = useAuth();
    const { saveResult } = useSessionHistory();
    const [theme, setTheme] = useState("neon");

    // Use AI hook if aiMode is true, otherwise standard multiplayer
    // Cast to explicit 'any' to bypass strict return type mismatch between hooks for now, 
    // as we just need the common interface in this component
    // Fix: Call BOTH hooks unconditionally to verify Rules of Hooks. 
    // Since neither hook auto-starts side effects without interaction, this is safe and prevents "Rendered fewer hooks" errors.
    const mpInterface = useMultiplayer(user);
    const aiInterface = useAiOpponent(user);

    // Select the active interface based on mode
    const multiplayer: any = aiMode ? aiInterface : mpInterface;
    const [isMultiplayerOpen, setIsMultiplayerOpen] = useState(initialMultiplayer);
    const [targetText, setTargetText] = useState(() => generateWords(100, false, false, 'medium'));
    const [userInput, setUserInput] = useState('');
    const [startTime, setStartTime] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(initialConfig?.duration ?? 30);
    const [isActive, setIsActive] = useState(false);
    const [wpm, setWpm] = useState(0);
    const [accuracy, setAccuracy] = useState(100);
    const [errorCount, setErrorCount] = useState(0);
    const [countdown, setCountdown] = useState(3);

    useEffect(() => {
        if (multiplayer.gameState === 'countdown' && multiplayer.startTime) {
            const i = setInterval(() => {
                const left = Math.ceil((multiplayer.startTime! - Date.now()) / 1000);
                setCountdown(left > 0 ? left : 0);
            }, 100);
            return () => clearInterval(i);
        }
    }, [multiplayer.gameState, multiplayer.startTime]);

    // Config State
    const [mode, setMode] = useState<TypingMode>(initialConfig?.mode ?? 'words');
    const [difficulty, setDifficulty] = useState<Difficulty>(initialConfig?.difficulty ?? 'medium');
    const [selectedTime, setSelectedTime] = useState<number>(initialConfig?.duration ?? 30);
    const [includeNumbers, setIncludeNumbers] = useState<boolean>(initialConfig?.includeNumbers ?? false);
    const [includePunctuation, setIncludePunctuation] = useState<boolean>(initialConfig?.includePunctuation ?? false);

    const [isFinished, setIsFinished] = useState(false);
    const [history, setHistory] = useState<{ time: number; wpm: number; raw: number }[]>([]);
    // Adaptive coach: track per-character errors and keystroke timing
    const charErrorsRef = useRef<Record<string, number>>({});
    const lastKeystrokeTimeRef = useRef<number | null>(null);
    const slowBigramsRef = useRef<Record<string, number[]>>({}); // char → array of ms delays
    const keystrokeData = useRef<{ key: string; latency: number; isError: boolean }[]>([]);
    const lastKeystrokeTime = useRef<number | null>(null);
    const wpmRef = useRef(0);
    const isCancelledRef = useRef(false);
    const mutationLockRef = useRef(createMutationLock());
    const sessionIdRef = useRef<string>(createAnalyticsSessionId());

    // Automatically open multiplayer modal if prop passed OR if URL has ?room=
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const roomCodeParam = params.get('room');

        let timer: ReturnType<typeof setTimeout> | undefined;

        if (initialMultiplayer || roomCodeParam) {
            // Short delay to ensure Radix Dialog can attach to DOM properly on fresh mount
            timer = setTimeout(() => {
                setIsMultiplayerOpen(true);
            }, 100);

            if (roomCodeParam && !multiplayer.roomCode && 'joinRoom' in multiplayer) {
                // Only join room if standard multiplayer
                multiplayer.joinRoom(roomCodeParam);
                // Clean URL
                window.history.replaceState({}, '', window.location.pathname);
            }
        }

        // Auto-start AI Matchmaking
        if (aiMode && 'startMatchmaking' in multiplayer) {
            // Cast to custom type or just call it safely, ts-ignore for now as intersection type complex
            // @ts-ignore
            multiplayer.startMatchmaking();
        }

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [initialMultiplayer, aiMode]);

    // Update Room Config when Host changes settings
    useEffect(() => {
        if (multiplayer.isHost && multiplayer.roomCode) {
            const config = {
                text: targetText, // Note: This might need to be generated *before* broadcasting
                mode,
                duration: selectedTime,
                difficulty
            };
            // multiplayer.broadcastConfig(config); // Uncomment when ready to sync
        }
    }, [targetText, mode, selectedTime, difficulty, multiplayer.isHost, multiplayer.roomCode]);

    // Sync Local State with Room Config (Clients)
    useEffect(() => {
        if (multiplayer.roomConfig && !multiplayer.isHost) {
            setMode(multiplayer.roomConfig.mode);
            setDifficulty(multiplayer.roomConfig.difficulty);
            setSelectedTime(multiplayer.roomConfig.duration);
            setTargetText(multiplayer.roomConfig.text);

            // Force reset local test state
            setUserInput('');
            setStartTime(null);
            setTimeLeft(multiplayer.roomConfig.duration);
            setIsActive(false);
            setWpm(0);
            setAccuracy(100);
        }
    }, [multiplayer.roomConfig, multiplayer.isHost]);


    // Handle Game Start Countdown
    useEffect(() => {
        if (multiplayer.gameState === 'countdown' && multiplayer.startTime) {
            // Ensure everything is reset
            setUserInput('');
            setWpm(0);
            setAccuracy(100);
            setIsFinished(false);
            setIsActive(false);

            // The actual "start" happens when countdown hits 0 (handled in UI or separate effect)
        }
    }, [multiplayer.gameState, multiplayer.startTime]);

    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Auto-focus the typing field the moment a multiplayer race begins so
    // players can start typing immediately without clicking the input first.
    useEffect(() => {
        if (multiplayer.gameState === 'racing') {
            inputRef.current?.focus();
        }
    }, [multiplayer.gameState]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isCancelledRef.current = true;
        };
    }, []);

    // Initialize test
    useEffect(() => {
        resetTest();
    }, [selectedTime, includeNumbers, includePunctuation, mode, difficulty]);

    const resetTest = () => {
        let text = '';
        if (mode === 'words') {
            text = generateWords(100, includeNumbers, includePunctuation, difficulty);
        } else if (mode === 'sentences') {
            const rawText = generateSentences(100, difficulty);
            text = applyTextTransformations(rawText, includeNumbers, includePunctuation);
        } else {
            // Paragraph Mode
            let sourceParagraphs = PARAGRAPHS_MEDIUM;
            if (difficulty === 'easy') sourceParagraphs = PARAGRAPHS_EASY;
            if (difficulty === 'hard') sourceParagraphs = PARAGRAPHS_HARD;

            const rawText = sourceParagraphs[Math.floor(Math.random() * sourceParagraphs.length)];
            text = applyTextTransformations(rawText, includeNumbers, includePunctuation);
        }

        setTargetText(text);
        setUserInput('');
        setStartTime(null);
        setTimeLeft(selectedTime);
        setIsActive(false);
        setIsFinished(false);
        setWpm(0);
        setAccuracy(100);
        setErrorCount(0);
        setHistory([]);
        charErrorsRef.current = {};
        lastKeystrokeTimeRef.current = null;
        slowBigramsRef.current = {};
        mutationLockRef.current.clear();
        sessionIdRef.current = createAnalyticsSessionId();
        keystrokeData.current = [];
        lastKeystrokeTime.current = null;
        wpmRef.current = 0;
        if (inputRef.current) inputRef.current.focus();
    };

    const handleComplete = useCallback(() => {
        if (isCancelledRef.current) return;

        const completionLock = mutationLockRef.current.acquire('typing:complete', 30000);
        if (!completionLock.acquired) return;

        setIsFinished(true); // Stop input
        setIsActive(false); // Stop timer/logic
        const endTime = Date.now();
        const durationSeconds = (endTime - (startTime || endTime)) / 1000;
        const finalWpm = calculateWpm(userInput.length, durationSeconds);
        const finalAccuracy = calculateAccuracy(userInput, targetText);

        setWpm(finalWpm);
        setAccuracy(finalAccuracy); // Update local state

        // Save to localStorage (persists for guests and logged-in users)
        saveResult({ wpm: finalWpm, accuracy: finalAccuracy, mode, sessionId: sessionIdRef.current });

        // Submit to Multiplayer if active
        if (multiplayer.roomCode && multiplayer.completeRace) {
            multiplayer.completeRace({
                wpm: finalWpm,
                accuracy: finalAccuracy,
                time: selectedTime,
                errorCount
            });
        }

        if (onComplete) {
            onComplete({ wpm: finalWpm, accuracy: finalAccuracy, errorCount });
        }
    }, [userInput, targetText, startTime, selectedTime, errorCount, multiplayer, onComplete, saveResult, mode]);

    // Check for completion
    useEffect(() => {
        if (!targetText || !userInput || isFinished) return; // Added isFinished check

        if (userInput.length === targetText.length) {
            handleComplete();
        } else if (multiplayer.roomCode && multiplayer.gameState === 'racing') {
            // Update progress in multiplayer
            // WPM Calculation for progress
            const timeElapsed = (Date.now() - (startTime || Date.now())) / 1000;
            const currentWpm = calculateWpm(userInput.length, timeElapsed);
            const progress = Math.min(100, (userInput.length / targetText.length) * 100);

            multiplayer.updateProgress(progress, currentWpm);
        }
    }, [userInput, targetText, multiplayer, startTime, handleComplete, isFinished]);

    // Timer logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        endTest();
                        return 0;
                    }
                    return prev - 1;
                });

                // Record history
                setHistory(prev => {
                    const timeElapsed = selectedTime - (timeLeft - 1);
                    return [...prev, { time: timeElapsed, wpm: wpmRef.current, raw: wpmRef.current }];
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft]);

    // Update WPM and Accuracy live
    useEffect(() => {
        if (isActive && startTime) {
            const timeElapsed = (Date.now() - startTime) / 1000;
            const currentWpm = calculateWpm(userInput.length, timeElapsed);

            setWpm(currentWpm);
            wpmRef.current = currentWpm;

            let errors = 0;
            for (let i = 0; i < userInput.length; i++) {
                if (userInput[i] !== targetText[i]) errors++;
            }
            const acc = calculateAccuracy(userInput, targetText);
            setAccuracy(acc);
            setErrorCount(errors);
        }
    }, [userInput, startTime, isActive]);



    const endTest = async () => {
        const completionLock = mutationLockRef.current.acquire('typing:complete', 30000);
        if (!completionLock.acquired) return;

        setIsActive(false);
        setIsFinished(true);
        const finalWpm = calculateWpm(userInput.length, selectedTime);
        const finalAccuracy = calculateAccuracy(userInput, targetText);
        const finalRecord = sanitizeMetricRecord({
            wpm: finalWpm,
            accuracy: finalAccuracy,
            time_duration: selectedTime,
        });
        if (!finalRecord) return;

        setWpm(finalRecord.wpm ?? 0);
        setAccuracy(finalRecord.accuracy ?? 100);

        // Calculate final stats for multiplayer submission if time ran out
        if (multiplayer.roomCode && multiplayer.completeRace) {
            console.log("Time ran out, submitting to multiplayer:", finalRecord);
            multiplayer.completeRace({
                wpm: finalRecord.wpm ?? 0,
                accuracy: finalRecord.accuracy ?? 100,
                time: selectedTime,
                errorCount
            });
        }

        // Guard against unmounted component
        if (isCancelledRef.current) return;

        // Save to Supabase if user is logged in
        console.log("EndTest called. User:", user);

        if (user?.id) {
            const saveLock = mutationLockRef.current.acquire(
                `typing:save:${user.id}:${startTime ?? 'manual'}:${selectedTime}:${mode}`,
                30000,
            );
            if (!saveLock.acquired) return;

            console.log("Attempting to save result to Supabase...", {
                user_id: user.id,
                wpm: finalRecord.wpm,
                accuracy: finalRecord.accuracy,
                errorCount,
                time: selectedTime,
                mode
            });

            try {
                if (isCancelledRef.current) return;

                const { data, error } = await supabase
                    .from('test_results')
                    .insert({
                        user_id: user.id,
                        wpm: finalRecord.wpm,
                        accuracy: finalRecord.accuracy,
                        error_count: errorCount,
                        time_duration: selectedTime,
                        mode: mode
                    })
                    .select();

                if (isCancelledRef.current) return;

                if (error) {
                    console.error("Supabase SAVE ERROR:", error);
                } else {
                    console.log("Result saved successfully!", data);
                    toast.success("Result saved to history!");

                    // Save to localStorage as well for instant local access
                    saveResult({ wpm: finalRecord.wpm ?? 0, accuracy: finalRecord.accuracy ?? 100, mode, sessionId: sessionIdRef.current });

                    if (isCancelledRef.current) return;

                    // Save char-level analytics for adaptive coach (best-effort, silent fail)
                    if (Object.keys(charErrorsRef.current).length > 0) {
                        // Compute avg delay per key from timing data
                        const slowKeys: Record<string, number> = {};
                        Object.entries(slowBigramsRef.current).forEach(([key, delays]) => {
                            if (delays.length > 0) {
                                slowKeys[key] = Math.round(delays.reduce((a, b) => a + b, 0) / delays.length);
                            }
                        });

                        supabase.from('typing_analytics').insert({
                            user_id: user.id,
                            char_errors: charErrorsRef.current,
                            slow_keys: slowKeys,
                            wpm: finalRecord.wpm,
                            accuracy: finalRecord.accuracy,
                        }).then(({ error: analyticsError }) => {
                            if (analyticsError) console.warn("Analytics save skipped:", analyticsError.message);
                        });
                    }
                }
            } catch (err) {
                console.error("Unexpected error saving result:", err);
                // Prevent crash
            }
        } else {
            console.warn("User ID missing, cannot save result. User object:", user);
            if (user) {
                toast.warning("Not connected to database (User ID missing).");
            }
            // Guest user — save to localStorage so progress is not lost
            saveResult({ wpm: finalRecord.wpm ?? 0, accuracy: finalRecord.accuracy ?? 100, mode, sessionId: sessionIdRef.current });
        }

        if (onComplete) {
            onComplete({ wpm: finalRecord.wpm ?? 0, accuracy: finalRecord.accuracy ?? 100, errorCount });
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const now = Date.now();

        if (!isActive && value.length === 1) {
            setStartTime(now);
            setIsActive(true);
        }

        // Track the newly typed character for adaptive coach
        if (value.length > userInput.length) {
            const newCharIndex = value.length - 1;
            const typedChar = value[newCharIndex];
            const expectedChar = targetText[newCharIndex];

            // Error tracking
            if (typedChar !== expectedChar && expectedChar) {
                const key = expectedChar.toLowerCase();
                charErrorsRef.current[key] = (charErrorsRef.current[key] || 0) + 1;
            }

            // Hesitation / keystroke timing
            const now = Date.now();
            if (lastKeystrokeTimeRef.current !== null && expectedChar) {
                const delay = now - lastKeystrokeTimeRef.current;
                const key = expectedChar.toLowerCase();
                if (!slowBigramsRef.current[key]) slowBigramsRef.current[key] = [];
                slowBigramsRef.current[key].push(delay);
            }
            lastKeystrokeTimeRef.current = now;
        }

        // Record keystroke latency for the newly typed character
        if (value.length > userInput.length) {
            const typedChar = value[value.length - 1];
            const latency = lastKeystrokeTime.current ? now - lastKeystrokeTime.current : 0;
            const expectedChar = targetText[value.length - 1];
            keystrokeData.current.push({
                key: typedChar.toLowerCase(),
                latency,
                isError: typedChar !== expectedChar,
            });
        }
        lastKeystrokeTime.current = now;

        setUserInput(value);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
            inputRef.current.focus();
        }
        if (e.key === 'Tab') {
            e.preventDefault();
            resetTest();
        }
    };

    // Calculate active character position for auto-scroll
    const [activeCharIndex, setActiveCharIndex] = useState(0);
    const activeCharRef = useRef<HTMLSpanElement>(null);

    useLayoutEffect(() => {
        setActiveCharIndex(userInput.length);

        const rafId = requestAnimationFrame(() => {
            if (activeCharRef.current && containerRef.current) {
                const container = containerRef.current;
                const activeChar = activeCharRef.current;

                const containerRect = container.getBoundingClientRect();
                const charRect = activeChar.getBoundingClientRect();

                const offset =
                    charRect.top -
                    containerRect.top +
                    container.scrollTop -
                    container.clientHeight / 2;

                container.scrollTo({
                    top: offset,
                    behavior: 'smooth',
                });
            }
        });

        return () => cancelAnimationFrame(rafId);
    }, [userInput]);

    // Render text with specific coloring
    const renderText = () => {
        if (!targetText) return null; // Prevent crash if undefined
        return targetText.split('').map((char, index) => {
            // Colors: Untyped = very muted, Typed Correct = bright, Error = red
            let className =
                theme === "neon"
                    ? 'text-cyan-400 transition-colors duration-200'
                    : theme === "minimal"
                        ? 'text-gray-400 transition-colors duration-200'
                        : 'text-green-400 transition-colors duration-200';
            if (index < userInput.length) {
                const isCorrect = char === userInput[index];
                className = isCorrect
                    ? theme === "neon"
                        ? 'text-cyan-200'
                        : theme === "minimal"
                            ? 'text-white'
                            : 'text-green-200'
                    : 'text-red-500 bg-red-500/10';
            }

            const isCurrent = index === activeCharIndex;

            return (
                <span
                    key={index}
                    ref={isCurrent ? activeCharRef : null}
                    className={cn(className, "relative inline-block")}
                >
                    {isCurrent && (
                        <span className="absolute -left-[2px] top-1 bottom-1 w-[2px] bg-primary animate-pulse rounded-full shadow-[0_0_8px_rgba(45,212,191,0.5)]"></span>
                    )}
                    {char}
                </span>
            );
        });
    };

    return (
        <div
            className="w-full max-w-5xl mx-auto flex flex-col gap-8 outline-none relative justify-center"
            onKeyDown={handleKeyDown}
            tabIndex={0}
            onClick={() => inputRef.current?.focus()}
        >
            {/* Website Branding */}
            <div className="absolute -top-32 left-0 flex items-center gap-3 select-none group cursor-default">
                <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 shadow-[0_0_15px_-3px_rgba(20,184,166,0.3)] group-hover:shadow-[0_0_20px_-3px_rgba(20,184,166,0.5)] transition-shadow duration-300">
                    <Type className="w-6 h-6 text-teal-400" />
                </div>
                <h1 className="font-bold text-2xl tracking-tighter text-foreground">
                    TypeSpeak<span className="text-teal-400">Pro</span>
                </h1>
            </div>

            {/* Controls Header - Fades out config, keeps stats */}
            <div
                className="flex items-center justify-between bg-transparent p-2 absolute -top-16 left-0 right-0 z-20"
            >


                {/* Config Options - Fade out when active */}
                <div className={cn(
                    "flex gap-2 bg-secondary/30 p-1 rounded-full backdrop-blur-md border border-border transition-all duration-500 ease-in-out",
                    isActive ? "opacity-0 pointer-events-none translate-y-[-10px]" : "opacity-100 translate-y-0"
                )}>
                    {/* Mode Selector */}
                    <div className="flex items-center gap-1 pr-2 border-r border-border mr-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => setMode('words')}
                                        className={cn(
                                            "flex items-center gap-1.5 text-sm font-medium transition-colors px-3 py-1 rounded-full",
                                            mode === 'words' ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Type className="w-3.5 h-3.5" />
                                        <span className="sr-only">words</span>
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Words</p>
                                </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => setMode('sentences')}
                                        className={cn(
                                            "flex items-center gap-1.5 text-sm font-medium transition-colors px-3 py-1 rounded-full",
                                            mode === 'sentences' ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <AlignLeft className="w-3.5 h-3.5" />
                                        <span className="sr-only">sentences</span>
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Sentences</p>
                                </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button onClick={() => setMode('paragraphs')}
                                        className={cn(
                                            "flex items-center gap-1.5 text-sm font-medium transition-colors px-3 py-1 rounded-full",
                                            mode === 'paragraphs' ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <span className="font-serif">¶</span>
                                        <span className="sr-only">paragraphs</span>
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Paragraphs</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    {[15, 30, 60, 120].map(time => (
                        <button
                            key={time}
                            onClick={() => setSelectedTime(time)}
                            className={cn(
                                "text-sm font-mono transition-all duration-200 px-3 py-1 rounded-full",
                                selectedTime === time ? "bg-primary/20 text-primary font-bold shadow-glow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {time}s
                        </button>
                    ))}
                    <div className="w-[1px] h-4 bg-border mx-2 self-center" />

                    {/* Punctuation/Numbers toggle for ALL modes */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIncludeNumbers(!includeNumbers)}
                            className={cn(
                                "flex items-center gap-1.5 text-sm font-medium transition-colors px-3 py-1 rounded-full",
                                includeNumbers ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Hash className="w-3.5 h-3.5" />
                            <span className="sr-only">numbers</span>
                        </button>
                        <button
                            onClick={() => setIncludePunctuation(!includePunctuation)}
                            className={cn(
                                "flex items-center gap-1.5 text-sm font-medium transition-colors px-3 py-1 rounded-full",
                                includePunctuation ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <span className="font-mono font-bold text-xs">@</span>
                            <span className="sr-only">punctuation</span>
                        </button>
                    </div>

                    {/* Difficulty UI for All Modes */}
                    <div className="flex items-center gap-1">
                        {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => (
                            <button
                                key={level}
                                onClick={() => setDifficulty(level)}
                                className={cn(
                                    "text-xs font-medium transition-colors px-2.5 py-1 rounded-full capitalize",
                                    difficulty === level ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {level}
                            </button>
                        ))}
                    </div>

                    <div className="w-[1px] h-4 bg-border mx-2 self-center" />

                    {/* Leaderboard Button */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => navigate('/leaderboard')}
                                    className="flex items-center gap-1.5 text-sm font-medium transition-colors px-3 py-1 rounded-full text-muted-foreground hover:text-yellow-400 hover:bg-yellow-400/10"
                                >
                                    <Trophy className="w-3.5 h-3.5" />
                                    <span className="sr-only">Leaderboard</span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Leaderboard</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                {/* Live Stats - ALWAYS VISIBLE (but subtle) */}
                <div className="flex items-center gap-6 text-xl font-mono transition-opacity duration-300">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Time</span>
                        <span className="text-primary font-bold text-2xl">{timeLeft}</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">WPM</span>
                        <span className="text-foreground font-bold text-2xl">{wpm}</span>
                    </div>
                </div>
            </div>

            {/* Multiplayer Race Track */}
            {multiplayer.roomCode && (
                <div className="mb-8">
                    <RaceTrack players={multiplayer.players} currentUserId={user?.id} />
                </div>
            )}

            {/* Results Modal */}
            {multiplayer.roomCode ? (
                <MultiplayerResults
                    open={isFinished}
                    onOpenChange={setIsFinished}
                    multiplayer={multiplayer}
                    onRestart={() => {
                        resetTest();
                    }}
                    results={{
                        wpm,
                        accuracy,
                        time: selectedTime,
                        errorCount
                    }}
                />
            ) : (
                <TestResults
                    open={isFinished}
                    onOpenChange={setIsFinished}
                    stats={{
                        wpm,
                        accuracy,
                        errorCount,
                        time: selectedTime,
                        history,
                        keystrokeData: keystrokeData.current,
                    }}
                    onRestart={resetTest}
                />
            )}

            {/* Typing Area */}
            <div
                ref={containerRef}
                className={cn(
                    "relative h-[280px] w-full overflow-y-auto overflow-x-hidden scroll-smooth flex items-start justify-start text-3xl leading-[4rem] tracking-wide font-mono outline-none cursor-default rounded-xl bg-card p-4 border border-border",
                    isFinished ? "blur-sm opacity-50 grayscale pointer-events-none" : ""
                )}
            >
                {/* Text Display - RESTORED */}
                <div
                    className="relative z-10 break-words pointer-events-none select-none w-full whitespace-pre-wrap tracking-wide"
                    style={{ wordSpacing: '0.1em' }}
                >
                    {renderText()}
                </div>

                {/* Cursor Overlay */}
                <div
                    className="absolute"
                    style={{
                        left: activeCharRef.current?.offsetLeft ?? 0,
                        top: activeCharRef.current?.offsetTop ?? 0,
                        transition: "all 0.1s ease-out"
                    }}
                >
                </div>

                {/* Input Field - Always focusable when not finished, but logic handles actual 'typing' */}
                <input
                    ref={inputRef}
                    type="text"
                    className="absolute opacity-0 w-full h-full z-20 cursor-text"
                    onChange={handleInputChange}
                    value={userInput}
                    onPaste={(e) => e.preventDefault()}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    // Fix: Ensure it's enabled if we are in multiplayer and racing, OR if we are solo and active/inactive
                    disabled={isFinished || (!!multiplayer.roomCode && multiplayer.gameState !== 'racing')}
                    autoFocus
                />
            </div>

            {/* Theme Switcher */}
            <div className="mb-4 flex gap-2 justify-center">
                <button
                    onClick={() => setTheme("neon")}
                    className="px-3 py-1 rounded bg-cyan-500 text-black"
                >
                    Neon
                </button>

                <button
                    onClick={() => setTheme("minimal")}
                    className="px-3 py-1 rounded bg-gray-500 text-white"
                >
                    Minimal
                </button>

                <button
                    onClick={() => setTheme("retro")}
                    className="px-3 py-1 rounded bg-green-700 text-white"
                >
                    Retro
                </button>
            </div>

            <div className="flex justify-center pt-8">
                <Button variant="ghost" size="lg" onClick={resetTest} className="opacity-50 hover:opacity-100 transition-opacity">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restart Test
                </Button>
            </div>
            <div className="flex justify-center pt-8">
                <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => navigate('/')}
                    className="opacity-50 hover:opacity-100 transition-opacity"
                >
                    <Home className="mr-2 h-4 w-4" />
                    Home
                </Button>
            </div>

            <MultiplayerModal
                open={isMultiplayerOpen}
                onOpenChange={setIsMultiplayerOpen}
                multiplayer={multiplayer}
            />

            {/* Countdown Overlay */}
            {multiplayer.gameState === 'countdown' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="text-[12rem] font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600 animate-pulse tracking-tighter drop-shadow-2xl">
                        {countdown}
                    </div>
                </div>
            )}

            {/* AI Searching Overlay */}
            {/* @ts-ignore - isSearching property specific to AI hook */}
            {multiplayer.isSearching && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="w-2 h-2 bg-teal-400 rounded-full animate-ping"></span>
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-foreground tracking-widest uppercase animate-pulse">Finding Opponent...</h2>
                        <p className="text-muted-foreground text-sm">Searching global ranked queue</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TypingTest;
