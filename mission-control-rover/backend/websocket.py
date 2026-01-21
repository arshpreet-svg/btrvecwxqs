from flask_socketio import SocketIO, emit
from mock_data import SYSTEM_STATE
from transcription import transcribe_audio_wisprflow
from datetime import datetime

def register_socketio_events(socketio):
    @socketio.on('connect')
    def handle_connect():
        print('✅ Client connected')
        emit('status_update', SYSTEM_STATE)

    @socketio.on('disconnect')
    def handle_disconnect():
        print('❌ Client disconnected')
    
    @socketio.on('distress_signal')
    def handle_distress_signal(data):
        """Handle emergency distress signals from User Panel"""
        print(f"DISTRESS SIGNAL RECEIVED: {data}")
        
        # Build enriched distress alert
        distress = {
            "type": "DISTRESS",
            "level": "critical",
            "message": f"🚨 EMERGENCY DISTRESS SIGNAL from {data.get('location', 'Unknown Location')}",
            "timestamp": data.get('timestamp', datetime.now().isoformat()),
            "source": "user_panel",
            "trigger": data.get('trigger', 'Manual'),  # Manual or Voice Activation
            "location": data.get('location', 'Unknown'),
            "audio": data.get('audio', False),
            "transcript": None
        }
        
        # If audio exists, handle real or mock audio
        if data.get('audio'):
            try:
                # Check if we have real audio data (base64)
                audio_data = data.get('audio_data')
                
                if audio_data and audio_data != 'mock_audio_blob_5s':
                    # Real audio: decode base64
                    import base64
                    try:
                        audio_bytes = base64.b64decode(audio_data)
                        print(f"Received real audio: {len(audio_bytes)} bytes")
                        
                        # Optional: Save to file
                        # timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
                        # filename = f"audio/distress_{timestamp_str}.webm"
                        # with open(filename, 'wb') as f:
                        #     f.write(audio_bytes)
                        # print(f"Audio saved to {filename}")
                    except Exception as e:
                        print(f"Error decoding audio: {e}")
                
                # Use frontend transcript if available, otherwise fallback to mock
                frontend_transcript = data.get('transcript')
                if frontend_transcript and frontend_transcript != 'Emergency distress signal':
                    distress['transcript'] = frontend_transcript
                    print(f"Using frontend transcript: {frontend_transcript}")
                else:
                    # Fallback to mock transcription
                    transcript = transcribe_audio_wisprflow(audio_data)
                    distress['transcript'] = transcript
                    print(f"Using mock transcript: {transcript}")
                
                # Forward audio data to Admin Panel
                distress['audio_data'] = audio_data
                    
            except Exception as e:
                print(f"Audio processing error: {e}")
                distress['transcript'] = "[Transcription unavailable]"
        
        # Broadcast to all admin panels
        socketio.emit('alert', distress, broadcast=True, include_self=True)
        print("Distress alert broadcasted to ALL connected Admin Panels")
