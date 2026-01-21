'use client';

import { Alert } from '@/types';
import { AlertCircle, Volume2, Play, Square } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

// For demo purposes, we might inject fake alerts or receive them via socket (Phase 4)
// But for now, just the UI structure.

import { socket } from '@/lib/socket';

export default function AlertsPanel() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [playingIdx, setPlayingIdx] = useState<number | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const handleAlert = (newAlert: any) => {
            // Ensure timestamp exists
            const alertObj: Alert = {
                ...newAlert,
                timestamp: newAlert.timestamp || new Date().toISOString()
            };
            console.log('📍 Alert received in AlertsPanel:', alertObj);
            setAlerts(prev => [alertObj, ...prev].slice(0, 5));
        };

        console.log('📍 AlertsPanel: Setting up socket listener for "alert" event');
        socket.on('alert', handleAlert);

        return () => {
            socket.off('alert', handleAlert);
            if (audioRef.current) {
                audioRef.current.pause();
            }
        };
    }, []);

    const playBase64Audio = (base64Data: string, idx: number) => {
        if (playingIdx === idx) {
            if (audioRef.current) {
                audioRef.current.pause();
                setPlayingIdx(null);
            }
            return;
        }

        // If something else is playing, stop it
        if (audioRef.current) {
            audioRef.current.pause();
        }

        try {
            const audioSrc = `data:audio/webm;base64,${base64Data}`;
            const audio = new Audio(audioSrc);
            audioRef.current = audio;
            setPlayingIdx(idx);

            audio.play();
            audio.onended = () => {
                setPlayingIdx(null);
            };
        } catch (error) {
            console.error('Playback error:', error);
            setPlayingIdx(null);
        }
    };

    return (
        <div className="p-6 bg-slate-900 text-white rounded-lg shadow-xl border border-slate-700 h-full overflow-hidden">
            <h2 className="text-xl font-bold mb-4 text-red-500 flex items-center gap-2">
                <AlertCircle /> Alerts
            </h2>
            <div className="space-y-3">
                {alerts.length === 0 ? (
                    <p className="text-slate-500 italic">No active alerts.</p>
                ) : (
                    alerts.map((alert, idx) => (
                        <div
                            key={idx}
                            className={`p-3 rounded border-l-4 ${alert.type === 'DISTRESS' ? 'bg-red-900/40 border-red-500 animate-pulse ring-1 ring-red-500/50' :
                                alert.level === 'critical' ? 'bg-red-900/30 border-red-500' :
                                    'bg-slate-800 border-yellow-500'
                                }`}
                        >
                            <div className="flex justify-between items-start">
                                <p className="font-bold text-sm">
                                    {alert.type === 'DISTRESS' ? '🚨 DISTRESS' : alert.level.toUpperCase()}
                                </p>
                                <span className="text-xs text-slate-400">{alert.timestamp.split('T')[1].split('.')[0]}</span>
                            </div>
                            <p className="text-sm mt-1">{alert.message}</p>

                            {/* Trigger Method */}
                            {alert.trigger && (
                                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                    {alert.trigger === 'Voice Activation' ? '🎙️' : '👆'}
                                    Triggered by: <span className="text-slate-300">{alert.trigger}</span>
                                </p>
                            )}

                            {/* Transcript Preview */}
                            {alert.transcript && (
                                <div className="mt-2 p-2 bg-slate-800/50 rounded text-xs italic border-l-2 border-cyan-500">
                                    <div className="flex items-start gap-2">
                                        <span className="text-cyan-400">📄</span>
                                        <span className="text-slate-200">"{alert.transcript}"</span>
                                    </div>
                                </div>
                            )}

                            {/* Audio Indicator */}
                            {alert.audio && alert.audio_data && (
                                <button
                                    onClick={() => playBase64Audio(alert.audio_data!, idx)}
                                    className={`mt-2 p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${playingIdx === idx
                                            ? 'bg-cyan-500 text-white animate-pulse'
                                            : 'bg-slate-800 text-cyan-400 hover:bg-slate-700 border border-cyan-900/50'
                                        }`}
                                >
                                    {playingIdx === idx ? (
                                        <>
                                            <Square className="w-3 h-3 fill-current" />
                                            STOP AUDIO
                                        </>
                                    ) : (
                                        <>
                                            <Volume2 className="w-3 h-3" />
                                            PLAY VOICE MESSAGE
                                        </>
                                    )}
                                </button>
                            )}

                            {/* Location */}
                            {alert.location && alert.location !== 'Unknown' && (
                                <p className="mt-1 text-xs text-slate-500">📍 {alert.location}</p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
