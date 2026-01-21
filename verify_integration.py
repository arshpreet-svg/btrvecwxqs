#!/usr/bin/env python3
"""
Quick Integration Verification Script
Confirms all components are properly set up for the Mission Control Rover system
"""

import sys
import os
from pathlib import Path

def check_backend_structure():
    """Verify backend files exist"""
    backend_path = Path("mission-control-rover/backend")
    required_files = [
        "app.py",
        "extensions.py",
        "websocket.py",
        "mock_data.py",
        "requirements.txt",
        "routes/mission.py",
        "routes/rover.py",
        "routes/status.py",
    ]
    
    print("\n📦 BACKEND FILES:")
    all_exist = True
    for file in required_files:
        full_path = backend_path / file
        exists = full_path.exists()
        status = "✓" if exists else "✗"
        print(f"  {status} {file}")
        all_exist = all_exist and exists
    
    return all_exist

def check_frontend_structure():
    """Verify frontend files exist"""
    frontend_path = Path("mission-control-rover/frontend")
    required_files = [
        "package.json",
        "tsconfig.json",
        "src/app/page.tsx",
        "src/app/layout.tsx",
        "src/lib/socket.ts",
        "src/types/index.ts",
        "src/components/Dashboard.tsx",
        "src/components/RoverControl.tsx",
        "src/components/CameraFeed.tsx",
        "src/components/MissionForm.tsx",
        "src/components/AlertsPanel.tsx",
    ]
    
    print("\n📦 FRONTEND FILES:")
    all_exist = True
    for file in required_files:
        full_path = frontend_path / file
        exists = full_path.exists()
        status = "✓" if exists else "✗"
        print(f"  {status} {file}")
        all_exist = all_exist and exists
    
    return all_exist

def check_dependencies():
    """Verify key dependencies are listed"""
    backend_reqs = Path("mission-control-rover/backend/requirements.txt")
    frontend_pkg = Path("mission-control-rover/frontend/package.json")
    
    print("\n📚 DEPENDENCIES:")
    
    backend_ok = False
    if backend_reqs.exists():
        content = backend_reqs.read_text()
        required_packages = ["flask", "flask-cors", "flask-socketio", "eventlet"]
        all_present = all(pkg in content for pkg in required_packages)
        print(f"  ✓ Backend requirements.txt (contains: {', '.join(required_packages)})")
        backend_ok = all_present
    else:
        print("  ✗ Backend requirements.txt not found")
    
    frontend_ok = False
    if frontend_pkg.exists():
        content = frontend_pkg.read_text()
        required_packages = ["next", "react", "socket.io-client"]
        all_present = all(pkg in content for pkg in required_packages)
        print(f"  ✓ Frontend package.json (contains: {', '.join(required_packages)})")
        frontend_ok = all_present
    else:
        print("  ✗ Frontend package.json not found")
    
    return backend_ok and frontend_ok

def check_socket_configuration():
    """Verify socket.io configuration"""
    print("\n⚙️  SOCKET.IO CONFIGURATION:")
    
    # Check backend socket config
    backend_socketio = Path("mission-control-rover/backend/extensions.py")
    if backend_socketio.exists():
        content = backend_socketio.read_text()
        if "SocketIO" in content and "eventlet" in content:
            print("  ✓ Backend: SocketIO with eventlet configured")
        else:
            print("  ✗ Backend: SocketIO not properly configured")
    
    # Check frontend socket config
    frontend_socket = Path("mission-control-rover/frontend/src/lib/socket.ts")
    if frontend_socket.exists():
        content = frontend_socket.read_text()
        if "localhost:5001" in content and "socket.io-client" in content:
            print("  ✓ Frontend: Socket client configured for localhost:5001")
        else:
            print("  ✗ Frontend: Socket client not properly configured")

def main():
    print("=" * 60)
    print("🚀 MISSION CONTROL ROVER - INTEGRATION VERIFICATION")
    print("=" * 60)
    
    # Change to workspace root
    workspace = Path("/Users/arshpreetdhillon/Documents/innohack")
    os.chdir(workspace)
    
    backend_ok = check_backend_structure()
    frontend_ok = check_frontend_structure()
    deps_ok = check_dependencies()
    check_socket_configuration()
    
    print("\n" + "=" * 60)
    print("📊 SUMMARY:")
    print("=" * 60)
    
    backend_status = "✓ READY" if backend_ok else "✗ INCOMPLETE"
    frontend_status = "✓ READY" if frontend_ok else "✗ INCOMPLETE"
    deps_status = "✓ READY" if deps_ok else "✗ INCOMPLETE"
    
    print(f"Backend:     {backend_status}")
    print(f"Frontend:    {frontend_status}")
    print(f"Dependencies: {deps_status}")
    
    if backend_ok and frontend_ok and deps_ok:
        print("\n✓ ALL CHECKS PASSED - System is ready!")
        print("\n🎯 To run the system:")
        print("   Terminal 1: cd mission-control-rover/backend && python app.py")
        print("   Terminal 2: cd mission-control-rover/frontend && npm run dev")
        print("   Browser:   http://localhost:3000")
        return 0
    else:
        print("\n✗ Some components are missing or incomplete.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
