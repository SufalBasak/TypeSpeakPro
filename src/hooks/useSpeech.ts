import { useState, useEffect, useCallback, useRef } from 'react';
import { isSpeechRecognitionSupported, isSpeechSynthesisSupported } from '@/lib/runtime-guards';

// Type definitions for Web Speech API
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: (event: any) => void;
    onerror: (event: any) => void;
    onend: () => void;
}

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

interface UseSpeechReturn {
    isListening: boolean;
    transcript: string;
    interimTranscript: string;
    startListening: () => void;
    stopListening: () => void;
    resetTranscript: () => void;
    speak: (text: string, lang?: string) => void;
    isSpeaking: boolean;
    cancelSpeech: () => void;
    hasRecognitionSupport: boolean;
    hasSynthesisSupport: boolean;
    error: string | null;
}

/**
 * Maps Web Speech API error codes to user-friendly messages.
 */
function mapRecognitionError(errorCode: string): string {
    switch (errorCode) {
        case 'not-allowed':
            return 'Microphone access was denied. Please allow microphone permission in your browser settings.';
        case 'no-speech':
            return 'No speech was detected. Please try speaking again.';
        case 'network':
            return 'A network error occurred during speech recognition. Check your internet connection.';
        case 'aborted':
            return 'Speech recognition was interrupted.';
        case 'audio-capture':
            return 'No microphone was found. Please connect a microphone and try again.';
        case 'service-not-allowed':
            return 'Speech recognition service is not allowed. Please check your browser settings.';
        default:
            return `Speech recognition error: ${errorCode}`;
    }
}

export const useSpeech = (language: string = 'en-US'): UseSpeechReturn => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const recognitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const startedRef = useRef(false);

    const hasRecognitionSupport = isSpeechRecognitionSupported();
    const hasSynthesisSupport = isSpeechSynthesisSupported();

    const clearRecognitionTimeout = useCallback(() => {
        if (recognitionTimeoutRef.current) {
            clearTimeout(recognitionTimeoutRef.current);
            recognitionTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!hasRecognitionSupport) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language;

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            let currentInterim = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    currentInterim += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) {
                setTranscript(prev => prev + ' ' + finalTranscript);
            }
            setInterimTranscript(currentInterim);
            if (finalTranscript || currentInterim) {
                clearRecognitionTimeout();
            }
        };

        recognition.onerror = (event: any) => {
            const errorMessage = mapRecognitionError(event.error);
            console.error('Speech recognition error:', event.error);
            setError(errorMessage);
            // Don't set isListening to false for 'no-speech' — it auto-recovers
            if (event.error !== 'no-speech') {
                setIsListening(false);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            startedRef.current = false;
            clearRecognitionTimeout();
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
            clearRecognitionTimeout();
        };
    }, [language, hasRecognitionSupport, clearRecognitionTimeout]);

    const startListening = useCallback(() => {
        if (!hasRecognitionSupport) {
            setError('Speech recognition is not supported in this browser.');
            return;
        }
        if (recognitionRef.current && !isListening) {
            try {
                // Abort any previous session to prevent DOMException on duplicate start
                try { recognitionRef.current.abort(); } catch { /* already stopped */ }
                setError(null);
                recognitionRef.current.start();
                setIsListening(true);
                startedRef.current = true;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to start speech recognition.';
                console.error('Error starting recognition:', err);
                setError(message);
            }
        }
    }, [isListening, hasRecognitionSupport]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
            startedRef.current = false;
            clearRecognitionTimeout();
        }
    }, [clearRecognitionTimeout, isListening]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
        setError(null);
    }, []);

    const speak = useCallback((text: string, lang: string = language) => {
        if (!hasSynthesisSupport) {
            setError('Speech synthesis is not supported in this browser.');
            return;
        }

        if (!text || text.trim().length === 0) return;

        // Cancel any current speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;

        // Try to find a specific voice for this language
        const voices = window.speechSynthesis.getVoices();
        // Priority: Exact match -> Includes identifier -> Standard fallback
        const targetVoice = voices.find(v => v.lang === lang)
            || voices.find(v => v.lang.includes(lang.replace('-', '_'))) // Android/some browsers use underscore
            || voices.find(v => v.name.includes('India') && lang === 'en-IN') // Specific fallback for Indian English if labeled by name
            || voices.find(v => v.lang.startsWith(lang.split('-')[0]));

        if (targetVoice) {
            utterance.voice = targetVoice;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (event) => {
            setIsSpeaking(false);
            // 'interrupted' and 'canceled' are expected when user cancels — not real errors
            if (event.error !== 'interrupted' && event.error !== 'canceled') {
                setError(`Speech synthesis error: ${event.error}`);
            }
        };

        window.speechSynthesis.speak(utterance);
    }, [language, hasSynthesisSupport]);

    const cancelSpeech = useCallback(() => {
        if (hasSynthesisSupport) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    }, [hasSynthesisSupport]);

    return {
        isListening,
        transcript: transcript.trim(),
        interimTranscript,
        startListening,
        stopListening,
        resetTranscript,
        speak,
        isSpeaking,
        cancelSpeech,
        hasRecognitionSupport,
        hasSynthesisSupport,
        error
    };
};
