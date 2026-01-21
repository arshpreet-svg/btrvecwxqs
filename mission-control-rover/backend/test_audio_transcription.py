#!/usr/bin/env python3
"""
Test script for audio transcription with real audio file.
Tests WisprFlow integration with help-help-322552.mp3
"""

import os
import sys
import requests
from pathlib import Path

# WisprFlow API Configuration
WISPRFLOW_API_URL = "https://transcribe.wisprflow.ai/v1/audio/transcriptions"
WISPRFLOW_API_KEY = os.environ.get("WISPRFLOW_API_KEY", "")

def transcribe_audio_file(audio_file_path):
    """
    Transcribe an audio file using WisprFlow API.
    
    Args:
        audio_file_path: Path to the audio file
        
    Returns:
        dict: Transcription result with text and metadata
    """
    if not WISPRFLOW_API_KEY:
        print("⚠️  WISPRFLOW_API_KEY environment variable not set!")
        print("   Using mock transcription for demo purposes.\n")
        return {
            "success": False,
            "transcript": "[MOCK] Help! Help! We need assistance urgently!",
            "error": "No API key configured"
        }
    
    try:
        # Check if file exists
        if not os.path.exists(audio_file_path):
            return {
                "success": False,
                "error": f"Audio file not found: {audio_file_path}"
            }
        
        # Prepare the audio file for upload
        with open(audio_file_path, 'rb') as audio_file:
            files = {
                'file': ('audio.mp3', audio_file, 'audio/mpeg')
            }
            
            headers = {
                'Authorization': f'Bearer {WISPRFLOW_API_KEY}'
            }
            
            data = {
                'model': 'whisper-large-v3',
                'language': 'en',
                'response_format': 'json'
            }
            
            print(f"🎙️  Sending audio file to WisprFlow API...")
            print(f"   File: {audio_file_path}")
            print(f"   Size: {os.path.getsize(audio_file_path)} bytes\n")
            
            response = requests.post(
                WISPRFLOW_API_URL,
                files=files,
                headers=headers,
                data=data,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "transcript": result.get('text', ''),
                    "duration": result.get('duration'),
                    "language": result.get('language')
                }
            else:
                return {
                    "success": False,
                    "error": f"API error: {response.status_code} - {response.text}"
                }
                
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "error": f"Network error: {str(e)}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }

def main():
    """Main test function"""
    print("=" * 70)
    print("🧪 WisprFlow Audio Transcription Test")
    print("=" * 70)
    print()
    
    # Audio file path
    audio_file = "/Users/arshpreetdhillon/.gemini/antigravity/help-help-322552.mp3"
    
    # Test transcription
    result = transcribe_audio_file(audio_file)
    
    # Display results
    print("📊 Transcription Results:")
    print("-" * 70)
    
    if result["success"]:
        print("✅ Status: SUCCESS")
        print(f"📝 Transcript: \"{result['transcript']}\"")
        if result.get('duration'):
            print(f"⏱️  Duration: {result['duration']:.2f}s")
        if result.get('language'):
            print(f"🌐 Language: {result['language']}")
    else:
        print("❌ Status: FAILED")
        print(f"📝 Transcript (Mock): \"{result.get('transcript', 'N/A')}\"")
        print(f"⚠️  Error: {result.get('error', 'Unknown error')}")
    
    print()
    print("=" * 70)
    print("💡 Next Steps:")
    print("   1. Set WISPRFLOW_API_KEY environment variable for real transcription")
    print("   2. Test with User Panel distress signal")
    print("   3. Verify Admin Panel displays the transcript correctly")
    print("=" * 70)
    
    return result

if __name__ == "__main__":
    main()
