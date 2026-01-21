export type MissionPriority = 'low' | 'medium' | 'high' | 'critical';
export type MissionPayload = 'medical' | 'supplies' | 'rescue' | 'investigation';

export interface Mission {
    lat: number;
    lon: number;
    payload: MissionPayload;
    priority: MissionPriority;
}

export type RoverCommandType = 'forward' | 'backward' | 'left' | 'right' | 'stop';

export interface RoverCommand {
    command: RoverCommandType;
}

export type MissionState = 'idle' | 'active' | 'completed';
export type RoverStatus = 'online' | 'offline' | 'error';

export type RoverId = 'jetson' | 'pi';

export interface RoverState {
    status: RoverStatus;
    moving: boolean;
    lat: number;
    lon: number;
    camera_url?: string;
}

export interface SystemStatus {
    type: 'STATUS';
    battery: number;
    mission_state: MissionState;
    rovers: Record<RoverId, RoverState>;
    payload: MissionPayload | null;
    priority: MissionPriority | null;
}

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface Alert {
    type: 'ALERT' | 'DISTRESS';
    level: AlertLevel;
    message: string;
    timestamp: string;
    transcript?: string;  // Audio transcription from WisprFlow
    audio?: boolean;      // Audio attachment flag
    source?: string;      // Source of alert (e.g., 'user_panel', 'rover')
    location?: string;    // Location information
    trigger?: string;     // Activation method: 'Manual' or 'Voice Activation'
    audio_data?: string;  // Base64 encoded audio data
}
