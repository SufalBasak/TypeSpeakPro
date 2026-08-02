
import React, { useState, useEffect, useCallback } from 'react';
import { useInterview } from '@/context/InterviewContext';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { QuestionFeedback } from '@/types/hr-interview';
import { analyzeAnswer } from '@/services/aiAnalysis';
import { supabase } from '@/lib/supabase';
import InterviewSidebar from '@/components/hr/InterviewSidebar';
import QuestionCard from '@/components/hr/QuestionCard';
import MicButton from '@/components/hr/MicButton';
import FeedbackPanel from '@/components/hr/FeedbackPanel';
import { AlertCircle, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { InlineError, LoadingState } from '@/components/async';
import { useAsyncState } from '@/hooks/useAsyncState';
import { createAsyncError, logAsyncError, toUserSafeError } from '@/types/async';

const MAX_DURATION = 60; // seconds

interface HRSessionProps {
    config?: any;
    onComplete?: (results: any) => void;
    onCancel?: () => void;
}

const HRSession: React.FC<HRSessionProps> = ({ onComplete, onCancel }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const {
        session,
        getCurrentQuestion,
        getProgress,
        submitAnswer,
        nextQuestion,
        endInterview
    } = useInterview();

    const [phase, setPhase] = useState<'question' | 'processing' | 'feedback'>('question');
    const [currentFeedback, setCurrentFeedback] = useState<QuestionFeedback | null>(null);
    const [dbSessionId, setDbSessionId] = useState<string | null>(null);
    const processState = useAsyncState<void>();
    const lastRecordingRef = React.useRef<{ blob: Blob; transcript: string } | null>(null);

    // Initialize Supabase Session
    useEffect(() => {
        const initSession = async () => {
            if (!session) return;

            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return; // Or handle guest

                const { data, error } = await supabase
                    .from('interview_sessions')
                    .insert({
                        user_id: user.id,
                        level: session.level,
                        status: 'in_progress'
                    })
                    .select()
                    .single();

                if (data) setDbSessionId(data.id);
                if (error) throw error;
            } catch (err) {
                logAsyncError('interview.initSession', err);
                processState.setError(toUserSafeError(err, {
                    title: 'Interview progress will not save yet',
                    message: 'The practice session is available, but database saving could not start.',
                }));
            }
        };

        initSession();
    }, [session?.level]); // Run once when level is set

    const handleRecordingComplete = useCallback(async (blob: Blob) => {
        setPhase('processing');

        // We need the transcript. useVoiceRecorder gives us the final blob.
        // However, for this implementation, we are using the transcript text from the hook?
        // Wait, useVoiceRecorder returns `transcript`? 
        // Let's check useVoiceRecorder signature usage in the original file. 
        // It says: const { transcript, ... } = useVoiceRecorder...
        // But handleRecordingComplete only gets blob.

        // Actually, we need to pass the transcript from the hook state to this function 
        // or access it from the hook return value in the component scope.
        // The previous implementation used `transcript` from `useVoiceRecorder`.

        // Let's assume we can access `transcript` variable from the hook below since it's in scope.
        // Wait, we can't access `recorderTranscript` inside this callback easily if it's stale.
        // Use a ref or just rely on the hook's state if we change logic slightly.

        // But `analyzeAnswer` handles the API call.

    }, []);

    // Wait, I need to see how I can get the transcript into the callback or if I should trigger it differently.
    // In the original file: 
    /*
      const handleRecordingComplete = useCallback(async (blob: Blob) => {
          // ...
          const question = getCurrentQuestion();
          // calls generateMockFeedback
      }, ...);
    */
    // It didn't use transcript in the mock.

    // Real implementation needs transcript.
    // `useVoiceRecorder` likely returns `transcript`.

    const {
        isRecording,
        transcript,
        timeRemaining,
        startRecording,
        stopRecording,
        error: recorderError,
        hasPermission,
    } = useVoiceRecorder({
        maxDuration: MAX_DURATION,
        onRecordingComplete: async (blob, finalTranscript) => {
            await processAnswer(blob, finalTranscript);
        },
    });

    const processAnswer = async (blob: Blob, finalTranscript: string) => {
        if (processState.isBusy) return;
        lastRecordingRef.current = { blob, transcript: finalTranscript };
        setPhase('processing');
        processState.setStatus('evaluating');
        const question = getCurrentQuestion();
        if (!question) return;

        try {
            if (!finalTranscript.trim()) {
                throw new Error('EMPTY_TRANSCRIPT');
            }
            // 1. Analyze
            const analysis = await analyzeAnswer(question.text, finalTranscript, session?.level || 'professional');

            // 2. Map to QuestionFeedback
            const feedback: QuestionFeedback = {
                questionId: question.id,
                transcribedAnswer: finalTranscript || "(No audio detected)",
                scores: {
                    grammar: analysis.grammar_score,
                    fluency: analysis.fluency_score,
                    confidence: analysis.confidence_score,
                    relevance: analysis.relevance_score
                },
                corrections: analysis.corrections || [analysis.feedback], // fallback
                improvementTips: analysis.improvements,
                betterAnswer: analysis.corrected_text
            };

            // 3. Save to Supabase
            if (dbSessionId) {
                const { error } = await supabase.from('interview_answers').insert({
                    session_id: dbSessionId,
                    question: question.text,
                    transcript: finalTranscript,
                    analysis: analysis,
                    duration: MAX_DURATION - timeRemaining // approx
                });
                if (error) throw error;
            }

            setCurrentFeedback(feedback);
            submitAnswer(feedback);
            processState.setData(undefined, 'success');
            setPhase('feedback');

        } catch (err) {
            logAsyncError("interview.processAnswer", err);
            processState.setError(
                err instanceof Error && err.message === 'EMPTY_TRANSCRIPT'
                    ? createAsyncError('No answer detected', 'We did not capture speech for this answer.', {
                        recoveryHint: 'Check the microphone and record again.',
                    })
                    : toUserSafeError(err, {
                        title: 'Analysis failed',
                        message: 'We could not analyze or save this answer. Please retry.',
                    })
            );
            toast({ variant: 'destructive', title: 'Analysis Failed', description: 'Please retry from the recovery panel.' });
            setPhase('question');
        }
    };

    const retryProcessing = () => {
        if (lastRecordingRef.current) {
            processAnswer(lastRecordingRef.current.blob, lastRecordingRef.current.transcript);
        }
    };

    // Redirect if no session
    useEffect(() => {
        if (!session && onCancel) {
            onCancel();
        }
    }, [session, onCancel]);

    // Handle exit
    const handleExit = () => {
        endInterview();
        if (onCancel) onCancel();
    };

    // Handle next question
    const handleNext = () => {
        nextQuestion();
        setCurrentFeedback(null);
        setPhase('question');
    };

    // Watch for completion
    useEffect(() => {
        if (session?.isComplete && onComplete) {
            // Maybe update DB session status to 'completed'
            if (dbSessionId) {
                supabase.from('interview_sessions')
                    .update({ status: 'completed' })
                    .eq('id', dbSessionId)
                    .then(() => onComplete(session));
                    .catch(err => console.error(err))