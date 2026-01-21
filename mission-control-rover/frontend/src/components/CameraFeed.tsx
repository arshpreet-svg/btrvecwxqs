'use client';

interface CameraFeedProps {
    isMoving: boolean;
    label: string;
    imageUrl?: string;
}

export default function CameraFeed({ isMoving, label, imageUrl }: CameraFeedProps) {
    return (
        <div className="relative aspect-video bg-black w-full h-full flex items-center justify-center">
            {/* Dynamic Feed Image */}
            <div
                className="absolute inset-0 bg-cover bg-center opacity-80 transition-opacity duration-300"
                style={{ backgroundImage: `url('${imageUrl || "https://images.unsplash.com/photo-1614728853975-6b45d2e057ba?q=80&w=2670&auto=format&fit=crop"}')` }}
            ></div>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {isMoving ? (
                    <span className="animate-pulse text-cyan-400 font-mono text-lg font-bold tracking-widest border border-cyan-500/50 px-4 py-2 bg-black/50 rounded">
                        TRANSMITTING MOVEMENT DATA...
                    </span>
                ) : (
                    <span className="text-red-500 font-mono text-sm tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        LIVE FEED
                    </span>
                )}
            </div>

            {/* Overlay Grid */}
            <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none opacity-20">
                {[...Array(16)].map((_, i) => (
                    <div key={i} className="border border-cyan-500/30"></div>
                ))}
            </div>

            {/* Scanline Effect */}
            <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20"></div>
        </div>
    );
}
