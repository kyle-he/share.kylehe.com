// /static/script.js

document.addEventListener('DOMContentLoaded', () => {
    // File Upload Elements
    const dropZone = document.getElementById('dropZone');
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');
    const selectedFiles = document.getElementById('selectedFiles');
    const uploading = document.getElementById('uploading');
    const progressBar = document.getElementById('progressBar');
    const timeLeft = document.getElementById('timeLeft');
    const timeSpan = document.getElementById('time');

    // Torrent Elements
    const torrentForm = document.getElementById('torrentForm');
    const magnetInput = document.getElementById('magnetInput');
    const cancelTorrentButton = document.getElementById('cancelTorrent');
    const torrentProgress = document.getElementById('torrentProgress');
    const dataDownloaded = document.getElementById('dataDownloaded');
    const totalSize = document.getElementById('totalSize');
    const downloadSpeed = document.getElementById('downloadSpeed');
    const downloadInfo = document.getElementById('downloadInfo');
    const torrentNameDisplay = document.getElementById('torrentName');

    // File List Element
    const fileList = document.getElementById('fileList');

    // Initialize Socket.IO connection
    const socket = io('http://localhost:3000', {
        withCredentials: true,
        transports: ['websocket', 'polling'],
    });

    // Handle Socket.IO events for Torrenting
    socket.on('connect', () => {
        console.log('Connected to WebSocket server');
    });

    socket.on('progress', (data) => {
        const downloadedMB = (data.downloaded / (1024 * 1024)).toFixed(2);
        const totalMB = (data.total / (1024 * 1024)).toFixed(2);
        const speedKBps = (data.speed / 1024).toFixed(2);

        torrentProgress.value = data.progress;
        dataDownloaded.textContent = `${downloadedMB} MB`;
        totalSize.textContent = `${totalMB} MB`;
        downloadSpeed.textContent = `${speedKBps} KB/s`;
        torrentNameDisplay.textContent = data.name;

        downloadInfo.style.display = 'block';
        torrentProgress.style.display = 'block';
        cancelTorrentButton.style.display = 'block';

        // Hide the torrent form after starting the torrent
        torrentForm.style.display = 'none';
    });

    socket.on('done', (data) => {
        alert(data.message);
        resetTorrentUI();
        fetchFileList(); // Fetch and update the file list
    });

    socket.on('canceled', (data) => {
        alert(data.message);
        resetTorrentUI();
    });

    socket.on('error', (data) => {
        alert(data.message || 'An unknown error occurred.');
        resetTorrentUI();
    });

    // Handle Drag-and-Drop Events
    dropZone.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (event) => {
        event.preventDefault();
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (event) => {
        event.preventDefault();
        dropZone.classList.remove('dragover');
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            handleFiles(files);
        }
    });

    // Handle File Selection via Input
    fileInput.addEventListener('change', (event) => {
        const files = event.target.files;
        if (files.length > 0) {
            handleFiles(files);
        }
    });

    // Handle Files (Display Selected Files)
    function handleFiles(files) {
        selectedFiles.innerHTML = '';
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const div = document.createElement('div');
            div.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
            selectedFiles.appendChild(div);
        }
        uploadForm.classList.add('active');
    }

    // Handle File Upload Form Submission
    uploadForm.onsubmit = function (event) {
        event.preventDefault();
        const files = fileInput.files;
        if (files.length === 0) {
            alert('Please select files or folders to upload.');
            return;
        }

        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('file', files[i]);
        }

        // Show uploading indicators
        uploading.style.display = 'block';
        progressBar.style.display = 'block';
        timeLeft.style.display = 'block';
        progressBar.value = 0;
        timeSpan.textContent = '';

        // Perform the upload using Fetch API
        fetch('/', {
            method: 'POST',
            body: formData,
        })
            .then(response => {
                if (response.ok) {
                    return response.json(); // Successful upload
                } else {
                    return response.json().then(data => {
                        throw new Error(data.error || 'Upload failed.');
                    });
                }
            })
            .then(data => {
                if (data.message) {
                    alert(data.message);
                    // Refresh the file list to include new uploads
                    fetchFileList();
                }
            })
            .catch(error => {
                console.error('Error uploading files:', error);
                alert(error.message);
            })
            .finally(() => {
                // Hide uploading indicators
                uploading.style.display = 'none';
                progressBar.style.display = 'none';
                timeLeft.style.display = 'none';
                selectedFiles.innerHTML = '';
                uploadForm.classList.remove('active');
                fileInput.value = ''; // Reset the file input
            });
    };

    // Handle Torrent Form Submission
    torrentForm.onsubmit = function (event) {
        event.preventDefault();
        const magnetURI = magnetInput.value.trim();
        if (!magnetURI) {
            alert('Please enter a valid Magnet URI.');
            return;
        }

        fetch('http://localhost:3000/start-torrent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ magnetURI }),
        })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                } else {
                    // Optionally, clear the input field
                    // magnetInput.value = '';
                }
            })
            .catch(error => {
                console.error('Error starting torrent:', error);
                alert('An error occurred while starting the torrent.');
            });
    };

    // Handle Cancel Torrent Button Click
    cancelTorrentButton.onclick = function () {
        fetch('http://localhost:3000/cancel-torrent', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.message) {
                    alert(data.message);
                    resetTorrentUI();
                }
            })
            .catch(error => {
                console.error('Error canceling torrent:', error);
                alert('An error occurred while canceling the torrent.');
            });
    };

    // Reset Torrent UI Elements
    function resetTorrentUI() {
        torrentForm.style.display = 'flex';
        magnetInput.value = '';
        torrentProgress.style.display = 'none';
        torrentProgress.value = 0;
        downloadInfo.style.display = 'none';
        cancelTorrentButton.style.display = 'none';
        torrentNameDisplay.textContent = 'N/A';
    }

    // Fetch and Update File List
    function fetchFileList() {
        fetch('/api/files')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Clear the existing file list
                fileList.innerHTML = '';

                data.forEach(file => {
                    const li = document.createElement('li');

                    const fileTextDiv = document.createElement('div');
                    fileTextDiv.classList.add('fileText');

                    const fileLink = document.createElement('a');
                    fileLink.href = `/uploads/${encodeURIComponent(file.name)}`;
                    fileLink.textContent = file.name;
                    fileLink.classList.add('filename');

                    fileTextDiv.appendChild(fileLink);

                    // Display 'directory' if it's a directory, else show size
                    const fileInfo = document.createElement('span');
                    if (file.is_dir) {
                        fileInfo.textContent = ' (directory)';
                    } else {
                        fileInfo.textContent = ` (${file.size})`;
                    }
                    fileTextDiv.appendChild(fileInfo);

                    li.appendChild(fileTextDiv);

                    const deleteForm = document.createElement('form');
                    deleteForm.method = 'post';
                    deleteForm.action = `/delete/${encodeURIComponent(file.name)}`;

                    const deleteButton = document.createElement('input');
                    deleteButton.type = 'submit';
                    deleteButton.value = 'Delete';
                    deleteButton.classList.add('submit-button', 'delete-button');

                    deleteForm.appendChild(deleteButton);
                    li.appendChild(deleteForm);

                    fileList.appendChild(li);
                });
            })
            .catch(error => {
                console.error('Error fetching file list:', error);
                alert('Failed to load file list.');
            });
    }

    // Initial Fetch of File List on Page Load
    fetchFileList();
});
