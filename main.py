from flask import Flask, request, redirect, url_for, send_from_directory, render_template_string
import os
import shutil
import config

app = Flask(__name__)

if not os.path.exists(config.UPLOAD_FOLDER):
    os.makedirs(config.UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = config.UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = config.MAX_CONTENT_LENGTH

def get_file_size(file_path):
    return os.path.getsize(file_path)

def get_storage_info():
    total, used, free = shutil.disk_usage(app.config['UPLOAD_FOLDER'])
    return total, used, free

@app.route('/')
def index():
    files = os.listdir(app.config['UPLOAD_FOLDER'])
    file_info = [(file, get_file_size(os.path.join(app.config['UPLOAD_FOLDER'], file))) for file in files]
    total_storage, used_storage, free_storage = get_storage_info()
    return render_template_string('''
    <!doctype html>
    <title>share.kylehe.com</title>
    <h1>share.kylehe.com</h1>
    <form id="uploadForm" method=post enctype=multipart/form-data>
      <input type=file name=file>
      <input type=submit value=Upload>
    </form>
    <div id="uploading" style="display:none;">Uploading...</div>
    <h2>Storage Information</h2>
    <p>Total storage: {{ total_storage | filesizeformat }}</p>
    <p>Used storage: {{ used_storage | filesizeformat }}</p>
    <p>Available storage: {{ free_storage | filesizeformat }}</p>
    <h1>Files</h1>
    <ul>
    {% for file, size in file_info %}
      <li>
        <a href="{{ url_for('uploaded_file', filename=file) }}">{{ file }}</a> ({{ size | filesizeformat }})
        <form method="post" action="{{ url_for('delete_file', filename=file) }}" style="display:inline;">
          <input type="submit" value="Delete">
        </form>
      </li>
    {% endfor %}
    </ul>
    <script>
      document.getElementById('uploadForm').onsubmit = function() {
          document.getElementById('uploading').style.display = 'block';
      };
    </script>
    ''', file_info=file_info, total_storage=total_storage, used_storage=used_storage, free_storage=free_storage)

@app.route('/', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return redirect(request.url)
    file = request.files['file']
    if file.filename == '':
        return redirect(request.url)
    if file:
        filename = file.filename
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        return redirect(url_for('index'))

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/delete/<filename>', methods=['POST'])
def delete_file(filename):
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if os.path.exists(file_path):
        os.remove(file_path)
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
