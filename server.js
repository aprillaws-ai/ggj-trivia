const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- FILE PATHING ---
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Force the home route to load index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// --- GAME STATE ---
let players = {};
let currentRound = 0;
const MAX_ROUNDS = 10;
let gameActive = false;
let searchStartTime = 0;

// --- TRIVIA LIBRARY ---
const TRIVIA_LIB = [
    { 
        q: "Who is the king of the jungle?", 
        scene: "scene.jpg", 
        targetX: 608, 
        targetY: 250, 
        radius: 50 
    }
];

// --- ADMIN DASHBOARD ---
app.get('/admin-dashboard', (req, res) => {
    const sorted = Object.values(players).sort((a, b) => b.score - a.score);
    let rows = "";
    for (let i = 0; i < 20; i++) {
        const p = sorted[i];
        rows += `
            <tr style="${i === 0 && p ? 'background:#fff3cd;' : ''}">
                <td style="padding:10px; border:1px solid #ddd;">${i + 1}</td>
                <td style="padding:10px; border:1px solid #ddd;">${p ? p.name : '---'}</td>
                <td style="padding:10px; border:1px solid #ddd;">${p ? `<code>${p.userId}</code>` : '---'}</td>
                <td style="padding:10px; border:1px solid #ddd;">${p ? p.score : '0'}</td>
            </tr>`;
    }

    res.send(`
        <html>
        <head><title>Admin Control</title></head>
        <body style="font-family:sans-serif; padding:40px; background:#f4f4f4;">
            <div style="max-width:800px; margin:auto; background:white; padding:20px; border-radius:10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color:#2c3e50;">Admin Dashboard - Round ${currentRound}/10</h2>
                <p>Active Players: ${Object.keys(players).length} / 20</p>
                <table style="width:100%; border-collapse:collapse;">
                    <tr style="background:#2c3e50; color:white;">
                        <th style="padding:10px;">Rank</th><th style="padding:10px;">Nickname</th><th style="padding:10px;">User ID</th><th style="padding:10px;">Score</th>
                    </tr>
                    ${rows}
                </table>
                <br>
                <button onclick="fetch('/start-game-trigger')" style="padding:10px 20px; background:#27ae60; color:white; border:none; border-radius:5px; cursor:pointer;">START GAME FOR EVERYONE</button>
            </div>
            <script>setTimeout(() => location.reload(), 3000);</script>
        </body>
        </html>
    `);
});

// Admin trigger to start the game
app.get('/start-game-trigger', (req, res) => {
    currentRound = 0;
    runNextRound();
    res.send("Game Started!");
});

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
    socket.on('joinGame', (data) => {
        if (Object.keys(players).length < 20) {
            players[socket.id] = { name: data.nickname, userId: data.userId, score: 0 };
            io.emit('updatePlayerCount', Object.keys(players).length);
        }
    });

    socket.on('foundItem
