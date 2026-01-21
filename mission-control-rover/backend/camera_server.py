from flask import Flask, Response
import cv2

app = Flask(__name__)

jetson_cam = cv2.VideoCapture(0)  # USB camera
pi_cam = cv2.VideoCapture(0)      # same cam for demo (change later)

def gen(cam):
    while True:
        success, frame = cam.read()
        if not success:
            break
        _, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/jetson')
def jetson_feed():
    return Response(gen(jetson_cam),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/pi')
def pi_feed():
    return Response(gen(pi_cam),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, threaded=True)
