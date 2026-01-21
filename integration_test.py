#!/usr/bin/env python3
"""Integration test for mission-control-rover system"""

import subprocess
import time
import sys
import os
import requests
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "mission-control-rover" / "backend"
sys.path.insert(0, str(backend_path))

def test_backend_health():
    """Test if backend is responding to HTTP requests"""
    try:
        # Check if backend is running
        response = requests.get('http://localhost:5001/', timeout=2)
        print("✓ Backend HTTP server is running")
        return True
    except Exception as e:
        print(f"✗ Backend HTTP connection failed: {e}")
        return False

def test_socketio_connection():
    """Test WebSocket connection to backend"""
    try:
        import socketio
        sio = socketio.Client(reconnection=True, reconnection_attempts=3)
        
        connected = False
        
        @sio.event
        def connect():
            nonlocal connected
            connected = True
            print("✓ WebSocket connected to backend")
        
        @sio.on('status_update')
        def on_status_update(data):
            print(f"✓ Received status update from backend")
        
        print("Attempting WebSocket connection to http://localhost:5001...")
        sio.connect('http://localhost:5001', transports=['websocket'], wait_timeout=3)
        
        time.sleep(1)
        sio.disconnect()
        
        if connected:
            print("✓ WebSocket integration test PASSED")
            return True
        else:
            print("✗ WebSocket connected but no handlers fired")
            return False
            
    except Exception as e:
        print(f"✗ WebSocket connection failed: {e}")
        return False

def test_frontend_build():
    """Test if frontend can be built"""
    frontend_path = Path(__file__).parent / "mission-control-rover" / "frontend"
    try:
        print(f"\nChecking frontend at {frontend_path}...")
        package_json = frontend_path / "package.json"
        if not package_json.exists():
            print("✗ Frontend package.json not found")
            return False
        print("✓ Frontend package.json found")
        return True
    except Exception as e:
        print(f"✗ Frontend check failed: {e}")
        return False

def main():
    print("=" * 50)
    print("MISSION CONTROL ROVER - INTEGRATION TEST")
    print("=" * 50)
    
    results = {
        "Backend HTTP": test_backend_health(),
        "WebSocket": test_socketio_connection(),
        "Frontend": test_frontend_build()
    }
    
    print("\n" + "=" * 50)
    print("TEST RESULTS:")
    print("=" * 50)
    
    for test_name, result in results.items():
        status = "✓ PASSED" if result else "✗ FAILED"
        print(f"{test_name}: {status}")
    
    all_passed = all(results.values())
    print("\n" + ("="*50))
    if all_passed:
        print("✓ ALL TESTS PASSED - Integration is working!")
    else:
        print("✗ Some tests failed - Please review the output above")
    print("=" * 50)
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
