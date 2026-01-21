from flask import Blueprint, jsonify
from mock_data import SYSTEM_STATE

status_bp = Blueprint('status', __name__)

@status_bp.route('/', methods=['GET'])
def get_status():
    return jsonify(SYSTEM_STATE)
