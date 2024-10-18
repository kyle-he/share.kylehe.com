// torrent_service.mjs

import WebTorrent from 'webtorrent';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { UPLOAD_FOLDER } from './config.mjs';
import fs from 'fs';
import http from 'http';
import { Server } from 'socket.io';

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with proper CORS settings
const io = new Server(server, {
    cors: {
        origin: 'http://127.0.0.1:8000', // Flask app origin
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'],
});

// Initialize WebTorrent client
const client = new WebTorrent();
let activeTorrent = null;

// Ensure the upload folder exists
if (!fs.existsSync(UPLOAD_FOLDER)) {
    fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });
}

// Middleware setup
app.use(bodyParser.json());
app.use(cors({
    origin: 'http://127.0.0.1:8000',
    methods: ['GET', 'POST'],
    credentials: true,
}));

// Start torrent download
app.post('/start-torrent', (req, res) => {
    const { magnetURI } = req.body;

    if (!magnetURI) {
        return res.status(400).json({ error: 'Magnet URI is required.' });
    }

    if (activeTorrent) {
        return res.status(400).json({ error: 'A torrent is already downloading. Please wait until it finishes or cancel it before starting a new one.' });
    }

    let parsed;
    try {
        parsed = WebTorrent.parseTorrent(magnetURI);
    } catch (err) {
        return res.status(400).json({ error: 'Invalid Magnet URI.' });
    }

    const infoHash = parsed.infoHash;
    const existingTorrent = client.torrents.find(t => t.infoHash === infoHash);

    if (existingTorrent) {
        return res.status(400).json({ error: 'This torrent is already being downloaded.' });
    }

    activeTorrent = client.add(magnetURI, { path: UPLOAD_FOLDER });

    // Handle torrent errors
    activeTorrent.on('error', (err) => {
        console.error('Torrent Error:', err.message);
        io.emit('error', { message: `Torrent Error: ${err.message}` });
        activeTorrent = null;
    });

    // Handle download progress
    activeTorrent.on('download', () => {
        if (activeTorrent) { // Ensure activeTorrent is not null
            const progress = (activeTorrent.progress * 100).toFixed(2);
            const downloaded = activeTorrent.downloaded; // Bytes downloaded
            const total = activeTorrent.length; // Total size in bytes
            const speed = activeTorrent.downloadSpeed; // Bytes per second

            io.emit('progress', { progress, downloaded, total, speed, name: activeTorrent.name });
        }
    });

    // Handle torrent completion
    activeTorrent.on('done', () => {
        console.log(`Download complete: ${activeTorrent.name}`);
        io.emit('done', { message: `Download complete: ${activeTorrent.name}`, name: activeTorrent.name });
        activeTorrent = null;
    });

    res.status(200).json({ message: 'Torrent started successfully.' });
});

// Cancel torrent download
app.post('/cancel-torrent', (req, res) => {
    if (activeTorrent) {
        activeTorrent.destroy((err) => {
            if (err) {
                console.error(`Failed to cancel torrent: ${err.message}`);
                return res.status(500).json({ error: 'Failed to cancel torrent.' });
            }
            console.log('Torrent canceled');
            io.emit('canceled', { message: 'Torrent download canceled.' });
            activeTorrent = null;
            res.status(200).json({ message: 'Torrent canceled successfully.' });
        });
    } else {
        res.status(400).json({ error: 'No active torrent to cancel.' });
    }
});

// Handle unexpected errors to prevent crashing
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Torrent service running on http://localhost:${PORT}`);
});
