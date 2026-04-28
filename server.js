const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- LOAD GAME CONTENT ---
const contentPath = path.join(__dirname, 'data', 'content.json');
let gameData = {};
try {
    const rawData = fs.readFileSync(contentPath);
    gameData = JSON.parse(rawData);
    console.log("Game content loaded successfully.");
} catch (error) {
    console.error("Could not load data/content.json. Please ensure the file exists!");
}

// --- GAME STATE ---
let players = [];
let gameHistory = [];
const CHALLENGES = [
    "Trivia", "Hidden Animal", "Spot the Difference", 
    "Find Them All", "Name the Character", "Where in the World"
];
const MAX_REPEATS = 3;
const TOTAL_ROUNDS = 10;

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // 1. Player Joins
    socket.on('join-game', (name) => {
        if (players.length < 20) {
            const player = { id: socket.id, name: name, score: 0 };
            players.push(player);
            io.emit('update-players', players);
        } else {
            socket.emit('error-message', 'Game is full (max 20).');
        }
    });

    // 2. Admin Progresses the Game
    socket.on('admin-next-round', () => {
        if (gameHistory.length >= TOTAL_ROUNDS) {
            return io.emit('game-over', players);
        }

        // Enforce max repeats rule
        const available = CHALLENGES.filter(c => {
            const count = gameHistory.filter(h => h === c).length;
            return count < MAX_REPEATS;
        });

        // Pick a random challenge category
        const result = available[Math.floor(Math.random() * available.length)];
        gameHistory.push(result);
        
        // Pick a random question from that category in content.json
        const categoryQuestions = gameData[result] || [];
        let questionData = null;
        if (categoryQuestions.length > 0) {
            const randomIndex = Math.floor(Math.random() * categoryQuestions.length);
            questionData = categoryQuestions[randomIndex];
        }

        // Broadcast to all players
        io.emit('new-round', { 
            challenge: result, 
            round: gameHistory.length,
            content: questionData 
        });
    });

    // 3. Handle Score Submissions
    socket.on('submit-score', (points) => {
        const player = players.find(p => p.id === socket.id);
        if (player) {
            player.score += points;
            io.emit('update-players', players);
        }
    });

    // 4. Handle Disconnects
    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('update-players', players);
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Game running at http://localhost:${PORT}`));
