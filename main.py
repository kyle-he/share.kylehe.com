from flask import Flask, request, redirect, url_for, send_from_directory, render_template
import os
import shutil
import config
import json
from datetime import datetime, timezone

app = Flask(__name__)

if not os.path.exists(config.UPLOAD_FOLDER):
    os.makedirs(config.UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = config.UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = config.MAX_CONTENT_LENGTH

metadata_file = os.path.join(app.config['UPLOAD_FOLDER'], 'metadata.json')

def get_file_size(file_path):
    return os.path.getsize(file_path)

def get_storage_info():
    total, used, free = shutil.disk_usage(app.config['UPLOAD_FOLDER'])
    return total, used, free

def load_metadata():
    if os.path.exists(metadata_file):
        with open(metadata_file, 'r') as f:
            return json.load(f)
    return {}

def save_metadata(metadata):
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f)

def add_file_metadata(filename, timestamp):
    metadata = load_metadata()
    metadata[filename] = timestamp
    save_metadata(metadata)

@app.route('/')
def index():
    metadata = load_metadata()
    files = os.listdir(app.config['UPLOAD_FOLDER'])
    files = [file for file in files if file != 'metadata.json']
    file_info = [(file, get_file_size(os.path.join(app.config['UPLOAD_FOLDER'], file)), metadata.get(file)) for file in files]
    file_info.sort(key=lambda x: x[2], reverse=True)
    total_storage, used_storage, free_storage = get_storage_info()
    return render_template('index.html', file_info=file_info, total_storage=total_storage, used_storage=used_storage, free_storage=free_storage)

@app.route('/', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return redirect(request.url)
    file = request.files['file']
    if file.filename == '':
        return redirect(request.url)
    if file:
        filename = file.filename
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        base, extension = os.path.splitext(filename)
        counter = 1
        while os.path.exists(file_path):
            filename = f"{base}_{counter}{extension}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            counter += 1
        file.save(file_path)

        # Add metadata with UTC timestamp
        timestamp = datetime.now(timezone.utc).isoformat()
        add_file_metadata(filename, timestamp)
        
        return redirect(url_for('index'))

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/delete/<filename>', methods=['POST'])
def delete_file(filename):
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if os.path.exists(file_path):
        os.remove(file_path)
    metadata = load_metadata()
    if filename in metadata:
        del metadata[filename]
        save_metadata(metadata)
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
