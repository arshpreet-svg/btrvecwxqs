import os
import requests

# WisprFlow Configuration
WISPRFLOW_API_URL = "https://transcribe.wisprflow.ai/v1/audio/transcriptions"
WISPRFLOW_API_KEY = os.environ.get("WISPRFLOW_API_KEY", "")
USE_REAL_API = bool(WISPRFLOW_API_KEY)

def transcribe_audio_wisprflow(audio_data):
    """
    Send audio to WisprFlow for transcription.
    Uses real API if WISPRFLOW_API_KEY is set, otherwise returns mock transcript.
    
    Args:
        audio_data: Audio blob/metadata from client (base64 encoded or file path)
    
    Returns:
        str: Transcript of the audio
    """
    
    # Option 1: Real WisprFlow API integration
    if USE_REAL_API:
        try:
            # Prepare request
            files = {
                'file': ('audio.webm', audio_data, 'audio/webm')
            }
            
            headers = {
                'Authorization': f'Bearer {WISPRFLOW_API_KEY}'
            }
            
            data = {
                'model': 'whisper-large-v3',
                'language': 'en',
                'response_format': 'json'
            }
            
            print(f"🎙️  Calling WisprFlow API for transcription...")
            
            response = requests.post(
                WISPRFLOW_API_URL,
                files=files,
                headers=headers,
                data=data,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                transcript = result.get('text', '[Transcription unavailable]')
                print(f"✅ Transcript received: {transcript}")
                return transcript
            else:
                print(f"❌ WisprFlow API error: {response.status_code}")
                return "[Transcription failed - API error]"
                
        except Exception as e:
            print(f"❌ Transcription error: {e}")
            return "[Transcription unavailable]"
    
    # Option 2: Mock for demo/hackathon (default)
    else:
        import random
        mock_transcripts = [
            "We are trapped and need medical help urgently",
            "Building collapsed, need rescue team",
            "Injured person here, please send ambulance",
            "Need water and food supplies",
            "Fire spreading, evacuate immediately",
            "Help! Help! We need assistance urgently!"
        ]
        
        transcript = random.choice(mock_transcripts)
        print(f"📝 Using mock transcript: {transcript}")
        return transcript
