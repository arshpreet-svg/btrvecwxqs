'use client';

import { useEffect, useState } from 'react';
import { socket } from '@/lib/socket';
import { SystemStatus, RoverId } from '@/types';
import { Battery, Activity } from 'lucide-react';
import RoverControl from './RoverControl';
import CameraFeed from './CameraFeed';
import MissionForm from './MissionForm';
import AlertsPanel from './AlertsPanel';

export default function Dashboard() {
    const [status, setStatus] = useState<SystemStatus>({
        type: 'STATUS',
        mission_state: 'idle',
        battery: 100,
        rovers: {
            jetson: { status: 'offline', moving: false, lat: 0, lon: 0 },
            pi: { status: 'offline', moving: false, lat: 0, lon: 0 }
        },
        payload: null,
        priority: null
    });
    const [connected, setConnected] = useState(false);
    const [activeRover, setActiveRover] = useState<RoverId>('jetson');

    useEffect(() => {
        socket.on('connect', () => setConnected(true));
        socket.on('disconnect', () => setConnected(false));

        socket.on('status_update', (data: any) => {
            setStatus(prev => ({ ...prev, ...data }));
        });

        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('status_update');
        };
    }, []);

    return (
        <div className="flex flex-col gap-6 p-6 h-full bg-slate-950 text-white overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-wider text-white"> INNOHACK <span className="text-cyan-500">// Mission Control</span></h1>
                <div className="flex items-center gap-4 text-sm font-mono">
                    <span className={`flex items-center gap-2 ${connected ? 'text-green-400' : 'text-red-400'}`}>
                        <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        {connected ? 'SYSTEM ONLINE' : 'DISCONNECTED'}
                    </span>
                    <span className="text-slate-500">BATTERY: {status.battery}%</span>
                </div>
            </div>

            {/* ROW 1: Mission Planner & Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[400px]">
                <MissionForm />
                <AlertsPanel />
            </div>

            {/* ROW 2: Live Feeds (Side by Side) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Jetson Feed */}
                <div
                    className={`relative rounded-lg overflow-hidden border-2 transition-all duration-300 cursor-pointer group ${activeRover === 'jetson'
                        ? 'border-cyan-500 ring-1 ring-cyan-500 opacity-100'
                        : 'border-slate-800 opacity-70 hover:opacity-100 hover:border-slate-600'
                        } ${status.rovers.jetson.moving && 'shadow-[0_0_30px_rgba(6,182,212,0.6)]'
                        }`}
                    onClick={() => setActiveRover('jetson')}
                >
                    <div className="absolute top-3 left-3 z-10 px-3 py-1 rounded text-xs font-bold tracking-widest border bg-black/80 text-cyan-400 border-cyan-900/50">
                        JETSON ROVER – LIVE FEED
                    </div>
                    {status.rovers.jetson.moving && (
                        <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 flex items-center gap-1 animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-cyan-400" />
                            MOVING
                        </div>
                    )}
                    <CameraFeed
                        isMoving={status.rovers.jetson.moving}
                        label="Jetson"
                        imageUrl={status.rovers.jetson.camera_url}
                    />
                    <div className="absolute bottom-0 w-full bg-black/80 backdrop-blur-sm p-2 flex justify-between text-xs font-mono text-slate-300">
                        <span>LAT: {status.rovers.jetson.lat.toFixed(4)}</span>
                        <span>LON: {status.rovers.jetson.lon.toFixed(4)}</span>
                    </div>
                </div>

                {/* Pi Feed */}
                <div
                    className={`relative rounded-lg overflow-hidden border-2 transition-all duration-300 cursor-pointer group ${activeRover === 'pi'
                        ? 'border-purple-500 ring-1 ring-purple-500 opacity-100'
                        : 'border-slate-800 opacity-70 hover:opacity-100 hover:border-slate-600'
                        } ${status.rovers.pi.moving && 'shadow-[0_0_30px_rgba(168,85,247,0.6)]'
                        }`}
                    onClick={() => setActiveRover('pi')}
                >
                    <div className="absolute top-3 left-3 z-10 px-3 py-1 rounded text-xs font-bold tracking-widest border bg-black/80 text-purple-400 border-purple-900/50">
                        PI ROVER – LIVE FEED
                    </div>
                    {status.rovers.pi.moving && (
                        <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/50 flex items-center gap-1 animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-purple-400" />
                            MOVING
                        </div>
                    )}
                    <CameraFeed
                        isMoving={status.rovers.pi.moving}
                        label="Pi"
                        imageUrl={status.rovers.pi.camera_url}
                    />
                    <div className="absolute bottom-0 w-full bg-black/80 backdrop-blur-sm p-2 flex justify-between text-xs font-mono text-slate-300">
                        <span>LAT: {status.rovers.pi.lat.toFixed(4)}</span>
                        <span>LON: {status.rovers.pi.lon.toFixed(4)}</span>
                    </div>
                </div>
            </div>

            {/* Trajectory / Status Strip */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-slate-900/30 rounded-lg border border-slate-800/50 font-mono text-xs">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-cyan-400 min-w-[60px]">JETSON</span>
                    <span className="text-slate-400">LAT: {status.rovers.jetson.lat.toFixed(4)}</span>
                    <span className="text-slate-400">LON: {status.rovers.jetson.lon.toFixed(4)}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="font-bold text-purple-400 min-w-[60px]">PI</span>
                    <span className="text-slate-400">LAT: {status.rovers.pi.lat.toFixed(4)}</span>
                    <span className="text-slate-400">LON: {status.rovers.pi.lon.toFixed(4)}</span>
                </div>
            </div>

            {/* ROW 3: Control Zone */}
            <div className="flex flex-col items-center justify-center p-8 bg-slate-900/50 rounded-xl border border-slate-800">
                <div className="w-full max-w-md flex flex-col items-center gap-6">

                    {/* Active Control Badge */}
                    <div className={`px-6 py-3 rounded-lg border-2 text-center transition-all duration-300 ${activeRover === 'jetson' ? 'bg-cyan-950/50 border-cyan-500 ring-2 ring-cyan-500/30' : 'bg-purple-950/50 border-purple-500 ring-2 ring-purple-500/30'}`}>
                        <div className="text-xs font-bold text-slate-400 tracking-widest mb-1">ACTIVE CONTROL</div>
                        <div className={`text-xl font-black tracking-wider ${activeRover === 'jetson' ? 'text-cyan-400' : 'text-purple-400'}`}>
                            {activeRover === 'jetson' ? 'JETSON ROVER' : 'PI ROVER'}
                        </div>
                    </div>

                    {/* Single Joystick */}
                    <div className="relative">
                        <RoverControl activeRover={activeRover} />
                    </div>

                </div>
            </div>
        </div>
    );
}
