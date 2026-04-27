const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// --- GAME STATE ---
let players = [];
let gameHistory = [];
const CHALLENGES = ["Trivia", "Hidden Animal", "Spot the Difference", "Find Them All", "Name the Character", "Where in the World", "Lose 50", "Free Coins!"];

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Player Joins
    socket.on('join-game', (name) => {
        if (players.length < 20) {
            const player = { id: socket.id, name: name, score: 0 };
            players.push(player);
            io.emit('update-players', players);
        }
    });

    // Admin Spins the Wheel
    socket.on('admin-spin', () => {
        // Simple logic: pick random. In production, add your "max 2 repeats" filter here.
        const result = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
        gameHistory.push(result);
        io.emit('wheel-result', { challenge: result, round: gameHistory.length });
    });

    // Handle Score Submissions
    socket.on('submit-score', (points) => {
        const player = players.find(p => p.id === socket.id);
        if (player) {
            player.score += points;
            io.emit('update-players', players);
        }
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('update-players', players);
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Game running at http://localhost:${PORT}`));
