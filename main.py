from flask import Flask, request, redirect, url_for, send_from_directory, render_template, jsonify
import os
import shutil
import config
import json
from datetime import datetime, timezone, timedelta
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration
app.config['UPLOAD_FOLDER'] = config.UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = config.MAX_CONTENT_LENGTH

# Ensure the upload folder exists
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

metadata_file = os.path.join(app.config['UPLOAD_FOLDER'], 'metadata.json')

# Rate limiting settings
RATE_LIMIT = 5  # Max number of requests
TIME_WINDOW = timedelta(minutes=1)  # Time window in minutes
clients = {}  # Dictionary to store client IPs and their request count

def get_file_size(file_path):
    """Return the size of the file in bytes."""
    return os.path.getsize(file_path)

def get_storage_info():
    """Return total, used, and free storage space in bytes."""
    total, used, free = shutil.disk_usage(app.config['UPLOAD_FOLDER'])
    return total, used, free

def load_metadata():
    """Load metadata from the JSON file."""
    if os.path.exists(metadata_file):
        with open(metadata_file, 'r') as f:
            return json.load(f)
    return {}

def save_metadata(metadata):
    """Save metadata to the JSON file."""
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f)

def add_file_metadata(filename, timestamp):
    """Add or update metadata for a given file."""
    metadata = load_metadata()
    metadata[filename] = timestamp
    save_metadata(metadata)

def is_rate_limited(client_ip):
    """Check if a client IP has exceeded the rate limit."""
    now = datetime.now(timezone.utc)
    if client_ip not in clients:
        clients[client_ip] = {'count': 1, 'start_time': now}
        return False
    
    client_data = clients[client_ip]
    if now - client_data['start_time'] > TIME_WINDOW:
        # Reset count and start time after the time window has passed
        clients[client_ip] = {'count': 1, 'start_time': now}
        return False
    elif client_data['count'] < RATE_LIMIT:
        # Increment the request count if within the time window
        clients[client_ip]['count'] += 1
        return False
    else:
        # Rate limit exceeded
        return True

def get_file_info():
    """Retrieve file and directory info from the upload folder."""
    metadata = load_metadata()
    files = []
    for root, dirs, filenames in os.walk(app.config['UPLOAD_FOLDER']):
        # Skip the metadata file
        if 'metadata.json' in filenames:
            filenames.remove('metadata.json')
        # Calculate relative path from upload folder
        rel_root = os.path.relpath(root, app.config['UPLOAD_FOLDER'])
        if rel_root == '.':
            rel_root = ''
        for d in dirs:
            dir_path = os.path.join(rel_root, d).replace('\\', '/')
            files.append((dir_path, 'directory', True))
        for f in filenames:
            file_rel_path = os.path.join(rel_root, f).replace('\\', '/')
            file_abs_path = os.path.join(root, f)
            size = get_file_size(file_abs_path)
            timestamp = metadata.get(file_rel_path, '')
            files.append((file_rel_path, size, False))
    # Sort files by timestamp descending (newest first)
    files_sorted = sorted(files, key=lambda x: metadata.get(x[0], ''), reverse=True)
    return files_sorted

@app.route('/')
def index():
    """Render the main page with file and folder listings."""
    file_info = get_file_info()
    total_storage, used_storage, free_storage = get_storage_info()
    return render_template('index.html', file_info=file_info, total_storage=total_storage, used_storage=used_storage, free_storage=free_storage)

@app.route('/', methods=['POST'])
def upload_file():
    """Handle file and folder uploads."""
    client_ip = request.remote_addr
    if is_rate_limited(client_ip):
        return jsonify({'error': 'Rate limit exceeded. Try again later.'}), 429

    if 'file' not in request.files:
        return redirect(request.url)
    
    uploaded_files = request.files.getlist('file')
    for file in uploaded_files:
        if file.filename == '':
            continue  # Skip empty filenames
        # Secure the filename
        filename = secure_filename(file.filename)
        # Handle nested directories by preserving the relative path
        # For example, 'folder1/file.txt' remains as such
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        # Ensure parent directories exist
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        # Save the file
        file.save(file_path)
        # Add metadata
        timestamp = datetime.now(timezone.utc).isoformat()
        add_file_metadata(filename, timestamp)
    
    return redirect(url_for('index'))

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    """Serve uploaded files and directories."""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/delete/<path:filename>', methods=['POST'])
def delete_file(filename):
    """Delete a specific file or folder."""
    client_ip = request.remote_addr
    if is_rate_limited(client_ip):
        return jsonify({'error': 'Rate limit exceeded. Try again later.'}), 429

    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if os.path.exists(file_path):
        if os.path.isdir(file_path):
            shutil.rmtree(file_path)
        else:
            os.remove(file_path)
    # Remove metadata
    metadata = load_metadata()
    if filename in metadata:
        del metadata[filename]
        save_metadata(metadata)
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
