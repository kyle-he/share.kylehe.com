// /static/script.js

document.addEventListener('DOMContentLoaded', () => {
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
    const fileList = document.getElementById('fileList');

    // Initialize Socket.IO connection
    const socket = io('http://localhost:3000', {
        withCredentials: true,
        transports: ['websocket', 'polling'],
    });

    // Handle Socket.IO events
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

        // Replace "Start Torrent" with "Cancel Torrent"
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

    // Start Torrent Download
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
                    // Optionally, you can clear the input or provide feedback
                    // magnetInput.value = '';
                }
            })
            .catch(error => console.error('Error starting torrent:', error));
    };

    // Cancel Torrent Download
    cancelTorrentButton.onclick = function () {
        fetch('http://localhost:3000/cancel-torrent', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.message) {
                    alert(data.message);
                    resetTorrentUI();
                }
            })
            .catch(error => console.error('Error canceling torrent:', error));
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

    // Handle Tab Visibility Changes
    window.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            resetTorrentUI();
        }
    });

    // File Upload Form Handling
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');

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

        fetch('/', {
            method: 'POST',
            body: formData,
        })
            .then(response => {
                if (response.redirected) {
                    window.location.href = response.url;
                }
            })
            .catch(error => console.error('Error uploading files:', error));
    };

    // Function to Fetch and Update File List
    function fetchFileList() {
        fetch('/api/files')
            .then(response => response.json())
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
                    const fileInfo = document.createElement('span');
                    fileInfo.textContent = ` (${file.size})`;
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
            .catch(error => console.error('Error fetching file list:', error));
    }

    // Initial Fetch of File List on Page Load
    fetchFileList();
});
