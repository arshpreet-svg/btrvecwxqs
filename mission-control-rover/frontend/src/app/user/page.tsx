'use client';

import { useEffect, useState, useRef } from 'react';
import { socket } from '@/lib/socket';
import { AlertTriangle, CheckCircle, Mic } from 'lucide-react';

// TypeScript declarations for Web Speech API
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

export default function UserPanel() {
    const [alertSent, setAlertSent] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [location, setLocation] = useState('Unknown Location');
    const [recording, setRecording] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [triggerMethod, setTriggerMethod] = useState<'manual' | 'voice'>('manual');
    const [transcriptText, setTranscriptText] = useState('');
    const [permissionDenied, setPermissionDenied] = useState(false);

    const [listeningForWakeWord, setListeningForWakeWord] = useState(false);
    const [wakeWordDetected, setWakeWordDetected] = useState(false);
    const [backgroundTranscript, setBackgroundTranscript] = useState('');

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recognitionRef = useRef<any>(null);
    const wakeWordRecognitionRef = useRef<any>(null);
    const isTriggeringRef = useRef(false);
    const transcriptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isRecordingRef = useRef(false);
    const cooldownRef = useRef(0);
    const [showDebug, setShowDebug] = useState(false);

    // Get location on mount
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude.toFixed(4);
                    const lon = position.coords.longitude.toFixed(4);
                    setLocation(`${lat}, ${lon}`);
                },
                () => {
                    setLocation('Location unavailable');
                }
            );
        }
    }, []);

    // Cooldown timer
    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    // Sync state to refs to avoid stale closures in event handlers
    useEffect(() => {
        isRecordingRef.current = recording;
        cooldownRef.current = cooldown;
    }, [recording, cooldown]);

    // Listen for backend updates
    useEffect(() => {
        socket.on('distress_acknowledged', (data) => {
            setStatusMessage(data.message || 'Alert received by control center');
        });

        return () => {
            socket.off('distress_acknowledged');
        };
    }, []);

    // Convert blob to base64
    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                // Remove data URL prefix
                const base64Data = base64.split(',')[1];
                resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    // Background listener for wake-word "help"
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const restartThreshold = 0; // cooldown
        const shouldBeRunning = !recording && cooldown <= restartThreshold;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        if (!wakeWordRecognitionRef.current) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
                // Ignore results if we are already triggering or recording (using refs for sync)
                if (isTriggeringRef.current || isRecordingRef.current) return;

                // Iterate through all results to find 'help'
                let detected = false;
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript.toLowerCase().trim();
                    console.log('🎙️ Background monitoring:', transcript);
                    setBackgroundTranscript(transcript);

                    // Clear transcript after 3 seconds of silence
                    if (transcriptTimeoutRef.current) clearTimeout(transcriptTimeoutRef.current);
                    transcriptTimeoutRef.current = setTimeout(() => setBackgroundTranscript(''), 3000);

                    // Aggressive matching for "help"
                    // Including 'alp', 'elp', 'hip', 'hop', 'hep' to account for poor audio
                    if (/\b(help|health|held|hell|help me|helpful|hope|hop|heap|hep|alp|elp|hip)\b/i.test(transcript) || transcript.includes('help')) {
                        detected = true;
                        break;
                    }
                }

                if (detected) {
                    console.log('🚨 WAKE WORD "HELP" DETECTED!');
                    setWakeWordDetected(true);

                    // Add a tiny debounce to prevent double-triggering in same result batch
                    if (!isTriggeringRef.current) {
                        recordAudio('voice');
                    }

                    // Abort immediately to release mic
                    try {
                        recognition.abort();
                    } catch (e) { }
                }
            };

            recognition.onstart = () => {
                console.log('✅ Background listener STARTED');
                setListeningForWakeWord(true);
            };

            recognition.onend = () => {
                console.log('💤 Background listener ENDED');
                // Restart if still in monitoring state (using refs for sync)
                if (!isRecordingRef.current && cooldownRef.current === 0) {
                    try {
                        recognition.start();
                    } catch (e) {
                        setListeningForWakeWord(false);
                    }
                } else {
                    setListeningForWakeWord(false);
                }
            };

            recognition.onerror = (event: any) => {
                console.warn('❌ Wake word recognition error:', event.error);
                if (event.error === 'not-allowed') {
                    setPermissionDenied(true);
                }

                // For transient errors, the onend will handle restart
            };

            wakeWordRecognitionRef.current = recognition;
        }

        if (shouldBeRunning) {
            try {
                wakeWordRecognitionRef.current.start();
            } catch (e) {
                // Already started or failed
            }
        } else {
            try {
                wakeWordRecognitionRef.current.abort();
            } catch (e) { }
            setListeningForWakeWord(false);
        }

        return () => {
            if (wakeWordRecognitionRef.current) {
                try {
                    wakeWordRecognitionRef.current.abort();
                } catch (e) { }
            }
        };
    }, [alertSent, recording, cooldown]);

    // Initialize Web Speech API for recording phase
    const startSpeechRecognition = () => {
        if (typeof window === 'undefined') return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('Speech Recognition not supported');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            console.log('Transcript:', transcript);
            setTranscriptText(transcript);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            // Fallback to default message if recognition fails
            setTranscriptText('Emergency distress signal (transcription unavailable)');
        };

        recognition.onend = () => {
            console.log('Speech recognition ended');
        };

        recognitionRef.current = recognition;

        try {
            recognition.start();
        } catch (error) {
            console.error('Failed to start speech recognition:', error);
        }
    };

    // Record audio with MediaRecorder API
    const recordAudio = async (trigger: 'manual' | 'voice') => {
        if (isTriggeringRef.current) {
            console.log('⚠️ Already triggering, ignoring request');
            return;
        }

        console.log(`🎬 Triggering recordAudio (${trigger})`);
        isTriggeringRef.current = true;

        // Deadlock protection: reset isTriggering after 15 seconds no matter what
        const deadlockTimeout = setTimeout(() => {
            if (isTriggeringRef.current) {
                console.warn('🕒 Trigger timeout reached - resetting lock');
                isTriggeringRef.current = false;
            }
        }, 15000);

        // Stop background recognition explicitly before starting new one
        if (wakeWordRecognitionRef.current) {
            try {
                wakeWordRecognitionRef.current.abort();
            } catch (e) { }
        }

        setRecording(true);
        setTriggerMethod(trigger);
        setTranscriptText(''); // Reset transcript
        audioChunksRef.current = [];

        try {
            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setPermissionDenied(false);

            // Wait a small bit for mic to be fully released by background recognition
            await new Promise(resolve => setTimeout(resolve, 300));

            // Start speech recognition
            startSpeechRecognition();

            // Create MediaRecorder
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm'
            });

            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());

                // Create audio blob
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

                // Convert to base64
                const base64Audio = await blobToBase64(audioBlob);

                // Wait a bit for speech recognition to complete
                await new Promise(resolve => setTimeout(resolve, 500));

                // Send distress signal with real audio
                console.log('🚨 Emitting distress signal to backend...', {
                    socket_connected: socket.connected,
                    socket_id: socket.id
                });

                socket.emit('distress_signal', {
                    type: 'DISTRESS_SIGNAL',
                    source: 'user_panel',
                    trigger: trigger === 'manual' ? 'Manual' : 'Voice Activation',
                    timestamp: new Date().toISOString(),
                    location: location,
                    audio: true,
                    audio_data: base64Audio,
                    transcript: transcriptText || 'Emergency distress signal'
                });

                setRecording(false);
                setAlertSent(true);
                setCooldown(60);
                setStatusMessage(
                    trigger === 'voice'
                        ? 'Voice distress activated. Audio recorded and sent.'
                        : 'Distress signal sent. Audio recorded and transcribed.'
                );
                isTriggeringRef.current = false;
                clearTimeout(deadlockTimeout);
            };

            // Start recording
            mediaRecorder.start();

            // Stop after 8 seconds
            setTimeout(() => {
                if (mediaRecorderRef.current?.state === 'recording') {
                    mediaRecorderRef.current.stop();

                    // Stop speech recognition
                    if (recognitionRef.current) {
                        recognitionRef.current.stop();
                    }
                }
            }, 8000);

        } catch (error) {
            console.error('Microphone access error:', error);
            setPermissionDenied(true);
            setRecording(false);
            isTriggeringRef.current = false;
            clearTimeout(deadlockTimeout);

            // Fallback to mock if permission denied
            setTimeout(() => {
                console.log('🚨 Emitting fallback distress signal (no audio)...');
                socket.emit('distress_signal', {
                    type: 'DISTRESS_SIGNAL',
                    source: 'user_panel',
                    trigger: trigger === 'manual' ? 'Manual' : 'Voice Activation',
                    timestamp: new Date().toISOString(),
                    location: location,
                    audio: false,
                    transcript: 'Emergency distress signal (microphone access denied)'
                });

                setAlertSent(true);
                setCooldown(60);
                setStatusMessage('Alert sent (microphone permission required for audio)');
            }, 1000);
        }
    };

    const handleManualTrigger = () => {
        if (cooldown > 0) return;
        recordAudio('manual');
    };

    const handleVoiceTrigger = () => {
        if (cooldown > 0) return;
        recordAudio('voice');
    };

    const handleReset = () => {
        setAlertSent(false);
        setRecording(false);
        setStatusMessage('');
        setTranscriptText('');
        setPermissionDenied(false);
        setWakeWordDetected(false);
        isTriggeringRef.current = false;
    };

    const reset = () => {
        handleReset();
    };

    const resetMicAndListener = () => {
        console.log('🔄 Manual Mic & Listener Reset');
        if (wakeWordRecognitionRef.current) {
            try { wakeWordRecognitionRef.current.abort(); } catch (e) { }
        }
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch (e) { }
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            try { mediaRecorderRef.current.stop(); } catch (e) { }
        }

        isTriggeringRef.current = false;
        setRecording(false);
        setWakeWordDetected(false);
        setListeningForWakeWord(false);

        // Let the useEffect handle the restart
        setTimeout(() => {
            // Trigger a dummy state change to force useEffect if needed, 
            // though cooldown/recording changes already trigger it.
        }, 100);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-950 via-slate-950 to-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <AlertTriangle className="w-12 h-12 text-red-500" />
                        <h1 className="text-4xl font-black text-white tracking-tight">
                            EMERGENCY<br />HELP
                        </h1>
                    </div>
                    <p className="text-slate-300 text-lg">
                        {recording
                            ? '🎙️ Recording your message...'
                            : 'Press button below or say safe word'}
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl border-2 border-slate-800 p-8 shadow-2xl">

                    {!alertSent && !recording ? (
                        // Landing State
                        <>
                            {permissionDenied && (
                                <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-700 rounded-lg text-sm text-yellow-200">
                                    ⚠️ Microphone access denied. Alert will be sent without audio.
                                </div>
                            )}

                            {/* Option 1: Manual Trigger */}
                            <button
                                onClick={handleManualTrigger}
                                disabled={cooldown > 0}
                                className={`w-full py-8 rounded-xl text-2xl font-black tracking-wider transition-all duration-300 mb-4 ${cooldown > 0
                                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                    : 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-500/50 hover:scale-105 active:scale-95'
                                    }`}
                            >
                                {cooldown > 0 ? `WAIT ${cooldown}s` : 'SEND HELP'}
                            </button>

                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-700"></div>
                                </div>
                                <div className="relative flex justify-center text-xs">
                                    <span className="px-2 bg-slate-900 text-slate-500">OR SAY SAFE WORD</span>
                                </div>
                            </div>

                            <div className="mt-8 flex flex-col items-center">
                                {listeningForWakeWord ? (
                                    <div className="flex items-center gap-2 text-cyan-400 font-medium animate-pulse">
                                        <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                                        <span>Listening for "help"...</span>
                                    </div>
                                ) : (
                                    <div className="text-slate-500 flex items-center gap-2">
                                        <Mic className="w-4 h-4 opacity-50" />
                                        <span>Hands-free standby</span>
                                    </div>
                                )}

                                {backgroundTranscript && (
                                    <div className="mt-4 p-2 bg-slate-900/50 rounded border border-slate-800 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">What I heard:</p>
                                        <p className="text-sm text-cyan-400 italic">"{backgroundTranscript}"</p>
                                    </div>
                                )}

                                <div className="mt-8 text-center text-xs text-slate-500">
                                    <p className="text-slate-400">📍 {location}</p>
                                    <p className="text-slate-600 mt-2">🎙️ Real audio & wake-word detection enabled</p>
                                    <button
                                        onClick={resetMicAndListener}
                                        className="mt-4 px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-400 transition-colors uppercase tracking-widest text-[10px]"
                                    >
                                        Force Reset Mic & Listener
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : recording ? (
                        // Recording State
                        <div className="text-center py-12 space-y-6">
                            <Mic className="w-20 h-20 text-red-500 mx-auto animate-pulse" />
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-2">Recording Audio</h2>
                                <p className="text-slate-300">Speak clearly into your microphone</p>
                                <p className="text-sm text-slate-500 mt-2">8 seconds • Real audio capture</p>
                                {transcriptText && (
                                    <div className="mt-4 p-3 bg-slate-800/50 rounded text-sm text-cyan-300">
                                        "{transcriptText}"
                                    </div>
                                )}
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2">
                                <div className="bg-red-500 h-2 rounded-full animate-pulse" style={{ width: '70%' }}></div>
                            </div>
                        </div>
                    ) : (
                        // Confirmation State
                        <div className="text-center space-y-6">
                            <CheckCircle className="w-20 h-20 text-green-500 mx-auto animate-pulse" />
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-3">
                                    {triggerMethod === 'voice' ? 'Voice Alert Sent' : 'Help Request Sent'}
                                </h2>
                                <p className="text-green-400 mb-4">
                                    {triggerMethod === 'voice'
                                        ? '🎙️ Voice-activated distress signal transmitted'
                                        : 'Stay calm. Assistance is being coordinated.'}
                                </p>
                                {statusMessage && (
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                        <p className="text-sm text-slate-300">{statusMessage}</p>
                                    </div>
                                )}
                                {transcriptText && (
                                    <div className="mt-3 p-3 bg-cyan-900/30 border border-cyan-700 rounded text-sm text-cyan-200">
                                        <p className="font-bold mb-1">Your message:</p>
                                        <p>"{transcriptText}"</p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4">
                                <p className="text-sm text-slate-400 mb-3">Next request available in:</p>
                                <div className="text-4xl font-black text-red-500">{cooldown}s</div>
                            </div>

                            {cooldown === 0 && (
                                <button
                                    onClick={reset}
                                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-all"
                                >
                                    Send Another Alert
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-6 text-center text-xs text-slate-500">
                    <p>Emergency Response System</p>
                    <p className="mt-1">Stay where you are if safe</p>
                </div>
                {/* Debug Panel Toggle */}
                <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="fixed bottom-4 right-4 p-2 bg-slate-800/80 hover:bg-slate-700/80 rounded-full border border-slate-700 text-slate-500 transition-all z-50 text-[10px]"
                >
                    {showDebug ? 'HIDE DEBUG' : 'DEBUG'}
                </button>

                {/* Debug Panel Overlay */}
                {showDebug && (
                    <div className="fixed bottom-16 right-4 p-4 bg-black/90 border border-slate-700 rounded-lg shadow-2xl z-50 text-[10px] font-mono w-64 animate-in fade-in slide-in-from-right-4">
                        <h4 className="text-cyan-400 font-bold mb-2 uppercase border-b border-slate-800 pb-1">Internal State</h4>
                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Listening:</span>
                                <span className={listeningForWakeWord ? 'text-green-500' : 'text-red-500'}>{listeningForWakeWord ? 'YES' : 'NO'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Is Triggering:</span>
                                <span className={isTriggeringRef.current ? 'text-amber-500' : 'text-slate-400'}>{isTriggeringRef.current ? 'TRUE' : 'FALSE'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Recording State:</span>
                                <span className={recording ? 'text-red-500' : 'text-slate-400'}>{recording ? 'RECORDING' : 'IDLE'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Cooldown:</span>
                                <span className={cooldown > 0 ? 'text-amber-500' : 'text-slate-400'}>{cooldown}s</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Alert Sent:</span>
                                <span className={alertSent ? 'text-green-500' : 'text-slate-400'}>{alertSent ? 'YES' : 'NO'}</span>
                            </div>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-800">
                            <p className="text-[9px] text-slate-600 italic">Logs are synced to browser console</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
