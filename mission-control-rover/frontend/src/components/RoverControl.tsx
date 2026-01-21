'use client';

import { useState } from 'react';
import { RoverCommandType, RoverId } from '@/types';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Octagon } from 'lucide-react';

interface RoverControlProps {
    activeRover: RoverId;
}

export default function RoverControl({ activeRover = 'jetson' }: RoverControlProps) {
    if (!activeRover) console.error('RoverControl: activeRover is missing!');
    const [lastCommand, setLastCommand] = useState<string | null>(null);

    const sendCommand = async (command: RoverCommandType) => {
        try {
            setLastCommand(`${activeRover.toUpperCase()}: ${command}`);
            const res = await fetch('http://localhost:5001/rover/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command,
                    rover_id: activeRover
                }),
            });
            if (!res.ok) throw new Error('Failed to send command');
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="p-6 bg-slate-900 text-white rounded-lg shadow-xl border border-slate-700">
            <h2 className="text-xl font-bold mb-4 text-cyan-400">Rover Control</h2>

            <div className="flex flex-col items-center gap-2">
                <button
                    onClick={() => sendCommand('forward')}
                    className="p-4 bg-slate-700 hover:bg-cyan-600 rounded-full transition-colors active:scale-95"
                    aria-label="Forward"
                >
                    <ArrowUp size={32} />
                </button>

                <div className="flex gap-4">
                    <button
                        onClick={() => sendCommand('left')}
                        className="p-4 bg-slate-700 hover:bg-cyan-600 rounded-full transition-colors active:scale-95"
                        aria-label="Left"
                    >
                        <ArrowLeft size={32} />
                    </button>

                    <button
                        onClick={() => sendCommand('stop')}
                        className="p-4 bg-red-600 hover:bg-red-500 rounded-full transition-colors active:scale-95"
                        aria-label="Stop"
                    >
                        <Octagon size={32} />
                    </button>

                    <button
                        onClick={() => sendCommand('right')}
                        className="p-4 bg-slate-700 hover:bg-cyan-600 rounded-full transition-colors active:scale-95"
                        aria-label="Right"
                    >
                        <ArrowRight size={32} />
                    </button>
                </div>

                <button
                    onClick={() => sendCommand('backward')}
                    className="p-4 bg-slate-700 hover:bg-cyan-600 rounded-full transition-colors active:scale-95"
                    aria-label="Backward"
                >
                    <ArrowDown size={32} />
                </button>
            </div>

            {lastCommand && (
                <p className="mt-4 text-center text-xs text-slate-500">Last: {lastCommand}</p>
            )}
        </div>
    );
}
