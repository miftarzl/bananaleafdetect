from flask import Flask, render_template, send_from_directory, make_response
import os

app = Flask(__name__, static_folder='static')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/model/<path:filename>')
def serve_model(filename):
    model_dir = os.path.join(app.root_path, 'model')
    response = make_response(send_from_directory(model_dir, filename))
    # Enable CORS
    response.headers['Access-Control-Allow-Origin'] = '*'
    # Set caching headers for model (cache for 1 day to make reloading fast)
    response.headers['Cache-Control'] = 'public, max-age=86400'
    response.headers['Content-Type'] = 'application/octet-stream'
    return response

if __name__ == '__main__':
    port = int(os.environ.get('PORT', '8085'))
    app.run(debug=False, host='0.0.0.0', port=port)
