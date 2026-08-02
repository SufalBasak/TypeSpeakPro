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
    const mutationLockRef = useRef(createMutationLock());
    const sessionIdRef = useRef<string>(createAnalyticsSessionId());

    // Automatically open multiplayer modal if prop passed OR if URL has ?room=
    // Automatically open multiplayer modal if prop passed OR if URL has ?room=
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const roomCodeParam = params.get('room');

        if (initialMultiplayer || roomCodeParam) {
            // Short delay to ensure Radix Dialog can attach to DOM properly on fresh mount
            setTimeout(() => {
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

                if (error) {
                    console.error("Supabase SAVE ERROR:", error);
                } else {
                    console.log("Result saved successfully!", data);
                    toast.success("Result saved to history!");

                    // Save to localStorage as well for instant local access
                    saveResult({ wpm: finalRecord.wpm ?? 0, accuracy: finalRecord.accuracy ?? 100, mode, sessionId: sessionIdRef.current });

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
                        .catch(err => console.error(err))