from flask import Blueprint, request, jsonify
from mock_data import SYSTEM_STATE
from flask_socketio import emit
from extensions import socketio

mission_bp = Blueprint('mission', __name__)

@mission_bp.route('/start', methods=['POST'])
def start_mission():
    data = request.json
    
    # Validation (Basic)
    if not all(k in data for k in ('lat', 'lon', 'payload', 'priority')):
        return jsonify({"error": "Missing fields"}), 400

    # Update State
    SYSTEM_STATE['lat'] = data['lat']
    SYSTEM_STATE['lon'] = data['lon']
    SYSTEM_STATE['payload'] = data['payload']
    SYSTEM_STATE['priority'] = data['priority']
    SYSTEM_STATE['mission_state'] = 'active'
    
    # Emit Update
    socketio.emit('status_update', SYSTEM_STATE)
    
    return jsonify({"status": "Mission started", "data": SYSTEM_STATE})
