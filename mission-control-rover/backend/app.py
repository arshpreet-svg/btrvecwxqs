from flask import Flask
from flask_cors import CORS
from extensions import socketio
from websocket import register_socketio_events

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'

# Fix 1: Add CORS config explicitly
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize SocketIO
socketio.init_app(app)

# Register SocketIO events
register_socketio_events(socketio)

# Import and register blueprints
from routes.mission import mission_bp
from routes.rover import rover_bp
from routes.status import status_bp

app.register_blueprint(mission_bp, url_prefix='/mission')
app.register_blueprint(rover_bp, url_prefix='/rover')
app.register_blueprint(status_bp, url_prefix='/status')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5001, debug=False, allow_unsafe_werkzeug=True)
