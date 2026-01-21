#!/usr/bin/env python3
"""
Alert Broadcasting Test
Verifies that distress signals are properly broadcast to all connected clients
"""

import socketio
import time
import sys

# Create a client for testing
sio = socketio.Client(reconnection=True)

alerts_received = []
client_id = None

@sio.event
def connect():
    global client_id
    client_id = sio.sid
    print(f"✓ Client connected with SID: {client_id}")

@sio.on('alert')
def on_alert(data):
    """Receive alert messages"""
    alerts_received.append(data)
    print(f"\n✓ ALERT RECEIVED on client {client_id}:")
    print(f"  - Type: {data.get('type', 'N/A')}")
    print(f"  - Level: {data.get('level', 'N/A')}")
    print(f"  - Message: {data.get('message', 'N/A')}")
    print(f"  - Location: {data.get('location', 'N/A')}")
    print(f"  - Transcript: {data.get('transcript', 'N/A')}")
    print(f"  - Timestamp: {data.get('timestamp', 'N/A')}")

@sio.event
def disconnect():
    print(f"✗ Client disconnected")

def test_alert_broadcast():
    """Test alert broadcasting"""
    print("=" * 70)
    print("ALERT BROADCASTING TEST")
    print("=" * 70)
    
    try:
        # Connect multiple clients
        print("\n1. Connecting test clients...")
        clients = []
        
        # Client 1
        print("   - Connecting client 1...")
        sio.connect('http://localhost:5001', transports=['websocket'])
        time.sleep(1)
        print("   ✓ Client 1 connected")
        
        # Client 2 (for multi-client testing)
        sio2 = socketio.Client()
        alerts_received_2 = []
        
        @sio2.on('alert')
        def on_alert_2(data):
            alerts_received_2.append(data)
            print(f"\n✓ ALERT RECEIVED on client 2:")
            print(f"  - Message: {data.get('message', 'N/A')}")
        
        print("   - Connecting client 2...")
        sio2.connect('http://localhost:5001', transports=['websocket'])
        time.sleep(1)
        print("   ✓ Client 2 connected")
        
        # Send a test distress signal
        print("\n2. Sending test distress signal from client 1...")
        test_signal = {
            'location': 'Test Location',
            'timestamp': time.time(),
            'trigger': 'Manual',
            'audio': True,
            'transcript': 'Test emergency distress signal',
            'audio_data': 'mock_audio_data'
        }
        sio.emit('distress_signal', test_signal)
        print("   ✓ Distress signal sent")
        
        # Wait for alerts to be received
        print("\n3. Waiting for alerts (5 seconds)...")
        time.sleep(5)
        
        # Check results
        print("\n" + "=" * 70)
        print("TEST RESULTS")
        print("=" * 70)
        
        if len(alerts_received) > 0:
            print(f"✓ Client 1 received {len(alerts_received)} alert(s)")
        else:
            print(f"✗ Client 1 received 0 alerts")
        
        if len(alerts_received_2) > 0:
            print(f"✓ Client 2 received {len(alerts_received_2)} alert(s)")
        else:
            print(f"✗ Client 2 received 0 alerts")
        
        if len(alerts_received) > 0 and len(alerts_received_2) > 0:
            print("\n✓ BROADCAST WORKING - All clients received alerts!")
            return True
        else:
            print("\n✗ BROADCAST FAILED - Not all clients received alerts")
            return False
        
    except Exception as e:
        print(f"✗ Test error: {e}")
        return False
    
    finally:
        # Cleanup
        try:
            sio.disconnect()
            sio2.disconnect()
        except:
            pass

if __name__ == "__main__":
    print("\nStarting Alert Broadcasting Test...")
    print("Make sure backend is running on http://localhost:5001\n")
    
    try:
        success = test_alert_broadcast()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted")
        sys.exit(1)
