# Fix 3: Add ONE global “system state”
SYSTEM_STATE = {
    "mission_state": "idle", # idle, active, completed
    "battery": 100,
    "payload": None,
    "priority": None,
    # Dual Rover State
    "rovers": {
        "jetson": {
            "status": "offline",
            "moving": False,
            "lat": 0.0,
            "lon": 0.0,
            "camera_url": "https://images.unsplash.com/photo-1614728853975-6b45d2e057ba?q=80&w=2670&fit=crop"
        },
        "pi": {
            "status": "offline", 
            "moving": False,
            "lat": 0.0, 
            "lon": 0.0,
            "camera_url": "https://images.unsplash.com/photo-1614728853975-6b45d2e057ba?q=80&w=2670&fit=crop"
        }
    }
}
