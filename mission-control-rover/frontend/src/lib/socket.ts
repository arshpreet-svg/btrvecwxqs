'use client';
import { io } from 'socket.io-client';

export const socket = io('http://localhost:5001', {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
});
