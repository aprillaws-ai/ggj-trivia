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
// Removed the bonus/penalty slices
const CHALLENGES = [
    "Trivia", "Hidden Animal", "Spot the Difference", 
    "Find Them All", "Name the Character", "Where in the World"
];
const MAX_REPEATS = 3; // Updated to max 3 repeats per game
const TOTAL_ROUNDS = 10;

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

    // Admin Progresses the Game (Kahoot Style)
    socket.on('admin-next-round', () => {
        if (gameHistory.length >= TOTAL_ROUNDS) {
            return io.emit('game-over', players);
        }

        // Filter challenges that haven't hit the 3-repeat limit
        const available = CHALLENGES.filter(c => {
            const count = gameHistory.filter(h => h === c).length;
            return count < MAX_REPEATS;
        });

        // Pick a random challenge from the available pool
        const result = available[Math.floor(Math.random() * available.length)];
        gameHistory.push(result);
        
        // Broadcast the result instantly (No wheel wait time)
        io.emit('new-round', { challenge: result, round: gameHistory.length });
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
