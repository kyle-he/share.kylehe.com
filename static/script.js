let droppedFiles = [];
const fileInput = document.getElementById('fileInput');
const uploadForm = document.getElementById('uploadForm');
const progressBar = document.getElementById('progressBar');
const uploading = document.getElementById('uploading');
const timeLeft = document.getElementById('timeLeft');
const timeElement = document.getElementById('time');
const fileList = document.getElementById('fileList');

uploadForm.onsubmit = function(event) {
    event.preventDefault();
    let files = fileInput.files;
    if (files.length > 0) {
        uploadFiles(files);
    } else if (droppedFiles.length > 0) {
        uploadFiles(droppedFiles);
    }
};

function uploadFiles(files) {
    if (files.length === 0) return;

    let file = files[0];
    let formData = new FormData();
    formData.append('file', file);

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/', true);

    var startTime = null;

    xhr.upload.onprogress = function(event) {
        if (event.lengthComputable) {
            if (!startTime) startTime = new Date().getTime();
            var elapsed = (new Date().getTime() - startTime) / 1000;
            var percentComplete = (event.loaded / event.total) * 100;
            progressBar.value = percentComplete;

            var uploadSpeed = event.loaded / elapsed; // bytes per second
            var timeRemaining = (event.total - event.loaded) / uploadSpeed; // seconds

            var minutes = Math.floor(timeRemaining / 60);
            var seconds = Math.floor(timeRemaining % 60);

            timeElement.textContent = minutes + 'm ' + seconds + 's';
        }
    };

    xhr.onloadstart = function(event) {
        uploading.style.display = 'block';
        progressBar.style.display = 'block';
        timeLeft.style.display = 'block';
    };

    xhr.onloadend = function(event) {
        uploading.style.display = 'none';
        progressBar.style.display = 'none';
        timeLeft.style.display = 'none';
        fileInput.value = ""; // Reset file input
    };

    xhr.onload = function() {
        if (xhr.status === 200) {
            let remainingFiles = Array.from(files).slice(1);
            droppedFiles = remainingFiles;
            updateFileList();
            uploadFiles(remainingFiles);
        } else {
            alert('An error occurred while uploading the file.');
        }
    };

    xhr.send(formData);
}

function updateFileList() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/', true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4 && xhr.status == 200) {
            var newDocument = document.implementation.createHTMLDocument("New Document");
            newDocument.documentElement.innerHTML = xhr.responseText;
            var newFileList = newDocument.getElementById('fileList');

            // Sort the files based on the timestamp
            let listItems = Array.from(newFileList.children);
            console.log(listItems)
            listItems.sort((a, b) => {
                let aTime = new Date(a.querySelector('.timestamp').dataset.timestamp);
                let bTime = new Date(b.querySelector('.timestamp').dataset.timestamp);
                return bTime - aTime; // Sort descending
            });

            // Clear the existing list and append the sorted items
            fileList.innerHTML = '';
            listItems.forEach(item => fileList.appendChild(item));

            updateTimestamps();
        }
    };
    xhr.send();
}

function updateTimestamps() {
    const timestamps = document.querySelectorAll('.timestamp');
    timestamps.forEach(timestamp => {
        const utcDate = new Date(timestamp.dataset.timestamp);
        const localDate = new Intl.DateTimeFormat(navigator.language, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            timeZoneName: 'short'
        }).format(utcDate);
        timestamp.textContent = localDate;
    });
}

// Drag and drop functionality
var dropZone = document.getElementById('dropZone');

dropZone.ondragover = function(event) {
    event.preventDefault();
    dropZone.classList.add('dragover');
};

dropZone.ondragleave = function(event) {
    event.preventDefault();
    dropZone.classList.remove('dragover');
};

dropZone.ondrop = function(event) {
    event.preventDefault();
    dropZone.classList.remove('dragover');

    var files = event.dataTransfer.files;
    if (files.length > 0) {
        droppedFiles = Array.from(files); // Store files to be uploaded later
        updateFileInput();
    }
};

// Paste functionality
document.body.onpaste = function(event) {
    var items = event.clipboardData.items;
    for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
            var file = items[i].getAsFile();
            droppedFiles.push(file);
        }
    }
    if (droppedFiles.length > 0) {
        updateFileInput();
    }
};

function updateFileInput() {
    const dataTransfer = new DataTransfer();
    droppedFiles.forEach(file => dataTransfer.items.add(file));
    fileInput.files = dataTransfer.files;
}

document.addEventListener('DOMContentLoaded', updateTimestamps);

document.addEventListener('DOMContentLoaded', function() {
    function checkMobileDevice() {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile = /iphone|ipad|ipod|android|blackberry|mini|windows\sce|palm/i.test(userAgent);
      if (isMobile) {
        document.body.classList.add('mobile');
      } else {
        document.body.classList.add('not-mobile');
      }
    }
  
    checkMobileDevice();
  });
  