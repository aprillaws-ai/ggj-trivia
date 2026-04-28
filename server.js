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
let currentRoundIndex = -1; // Tracks which round index we are on (0 to 9)

const CHALLENGES = [
    "Trivia", "Hidden Animal", "Spot the Difference", 
    "Find Them All", "Name the Character", "Where in the World"
];
const MAX_REPEATS = 3;
const TOTAL_ROUNDS = 10;

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // 1. Player Joins
    socket.on('join-game', (userData) => {
        if (players.length < 20) {
            // Initialize an array of 10 zeros for round-by-round tracking
            const player = { 
                id: socket.id, 
                name: userData.name, 
                userId: userData.userId, 
                roundScores: Array(TOTAL_ROUNDS).fill(0), 
                totalScore: 0 
            };
            players.push(player);
            
            // Send updates to both the player screens and the admin screen
            io.emit('update-players', players);
            io.emit('update-admin', players); 
        } else {
            socket.emit('error-message', 'Game is full (max 20).');
        }
    });

    // 2. Admin Progresses the Game
    socket.on('admin-next-round', () => {
        // If we've reached 10 rounds, trigger the finale
        if (gameHistory.length >= TOTAL_ROUNDS) {
            return io.emit('game-over', players);
        }
        
        currentRoundIndex++; // Move to the next round column

        // Enforce max 3 repeats rule
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

    // 3. Precision Scoring Engine
    socket.on('submit-answer', (data) => {
        // data expects: { correct: boolean, timeMs: number, fraction: number }
        const player = players.find(p => p.id === socket.id);
        
        if (player && data.correct) {
            // MAX Score per challenge is 1000. 
            // 500 base points for accuracy + up to 500 points for speed.
            const maxSpeedBonus = 500;
            const maxTimeMs = 20000; // 20 seconds maximum
            
            // Safeguard: if they somehow bypass the UI lock and submit after 20s, give 0 points
            if (data.timeMs > maxTimeMs) return; 
            
            // Calculate speed bonus based on how fast they were
            let speedBonus = Math.max(0, maxSpeedBonus - ((data.timeMs / maxTimeMs) * maxSpeedBonus));
            let totalPointsEarned = 500 + speedBonus;

            // Multiply by the fraction (e.g., finding 1 of 5 differences = 20% of the points)
            let finalClickPoints = Math.round(totalPointsEarned * data.fraction);

            // Add points to the specific round column
            player.roundScores[currentRoundIndex] += finalClickPoints;
            
            // Recalculate the master total score
            player.totalScore = player.roundScores.reduce((a, b) => a + b, 0);

            // Update both screens
            io.emit('update-players', players); 
            io.emit('update-admin', players);
        }
    });

    // 4. Handle Disconnects
    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('update-players', players);
        io.emit('update-admin', players);
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Game running at http://localhost:${PORT}`));
