from flask import Blueprint, request, jsonify
from mock_data import SYSTEM_STATE
from extensions import socketio

rover_bp = Blueprint('rover', __name__)

@rover_bp.route('/control', methods=['POST'])
def control_rover():
    data = request.json
    command = data.get('command')
    rover_id = data.get('rover_id')
    
    if not rover_id or rover_id not in SYSTEM_STATE['rovers']:
        return jsonify({"error": "Invalid or missing rover_id"}), 400

    if command not in ['forward', 'backward', 'left', 'right', 'stop']:
        return jsonify({"error": "Invalid command"}), 400
        
    print(f"Executing command: {command} for {rover_id}")
    
    # Get specific rover state
    rover = SYSTEM_STATE['rovers'][rover_id]
    
    # Simulation Logic
    step = 0.0001
    is_moving = False
    
    if command == 'forward':
        rover['lat'] += step
        is_moving = True
    elif command == 'backward':
        rover['lat'] -= step
        is_moving = True
    elif command == 'left':
        rover['lon'] -= step
        is_moving = True
    elif command == 'right':
        rover['lon'] += step
        is_moving = True
    elif command == 'stop':
        is_moving = False
    
    # Update movement state
    rover['moving'] = is_moving
    
    # Log command
    if is_moving:
        socketio.emit('alert', {"type": "INFO", "level": "info", "message": f"{rover_id.upper()} ROVER \u2013 MOVING {command.upper()}"})
    
    # Emit global update (containing new rover states)
    socketio.emit('status_update', SYSTEM_STATE)
    
    return jsonify({
        "status": "Command received", 
        "rover_id": rover_id,
        "command": command, 
        "new_position": {"lat": rover['lat'], "lon": rover['lon']}
    })
