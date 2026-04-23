const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// --- GAME STATE ---
let players = {};
let currentRound = 0;
const MAX_ROUNDS = 10;
let gameActive = false;
let searchStartTime = 0;

// --- TRIVIA LIBRARY ---
// I've added your specific test coordinates as the first question.
const TRIVIA_LIB = [
    { 
        q: "Who is the king of the jungle?", 
        scene: "scene.jpg", 
        targetX: 608, 
        targetY: 250, 
        radius: 50 
    },
    { 
        q: "Which bird has a massive, colorful beak?", 
        scene: "scene2.jpg", 
        targetX: 1200, 
        targetY: 400, 
        radius: 60 
    }
    // You can continue adding your other 98 questions here!
];

// --- ADMIN DASHBOARD ---
app.get('/admin-dashboard', (req, res) => {
    const sorted = Object.values(players).sort((a, b) => b.score - a.score);
    let rows = "";
    for (let i = 0; i < 20; i++) {
        const p = sorted[i];
        rows += `
            <tr style="${i === 0 ? 'background:#fff3cd;' : ''}">
                <td style="padding:10px; border:1px solid #ddd;">${i + 1}</td>
                <td style="padding:10px; border:1px solid #ddd;">${p ? p.name : '---'}</td>
                <td style="padding:10px; border:1px solid #ddd;">${p ? `<code>${p.userId}</code>` : '---'}</td>
                <td style="padding:10px; border:1px solid #ddd;">${p ? p.score : '0'}</td>
            </tr>`;
    }

    res.send(`
        <html>
        <body style="font-family:sans-serif; padding:40px; background:#f4f4f4;">
            <div style="max-width:800px; margin:auto; background:white; padding:20px; border-radius:10px;">
                <h2>Admin Live Dashboard - Round ${currentRound}/10</h2>
                <table style="width:100%; border-collapse:collapse;">
                    <tr style="background:#2c3e50; color:white;">
                        <th>Rank</th><th>Nickname</th><th>User ID</th><th>Score</th>
                    </tr>
                    ${rows}
                </table>
            </div>
            <script>setTimeout(() => location.reload(), 3000);</script>
        </body>
        </html>
    `);
});

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
    
    socket.on('joinGame', (data) => {
        // Prevent more than 20 players
        if (Object.keys(players).length < 20) {
            players[socket.id] = { 
                name: data.nickname, 
                userId: data.userId, 
                score: 0 
            };
            io.emit('updatePlayerCount', Object.keys(players).length);
        }
    });

    socket.on('startGame', () => {
        currentRound = 0;
        runNextRound();
    });

    socket.on('foundItem', () => {
        if (gameActive && players[socket.id]) {
            const reactionTime = (Date.now() - searchStartTime) / 1000;
            // Scoring: 1000 base, minus 60 per second. Min 100.
            const points = Math.max(100, Math.floor(1000 - (reactionTime * 60)));
            
            players[socket.id].score += points;
            gameActive = false; // Ends search for this round
            
            io.emit('roundWinner', { 
                name: players[socket.id].name, 
                points: points 
            });

            // Wait 3 seconds to show winner, then move to next round
            setTimeout(runNextRound, 3000);
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

function runNextRound() {
    currentRound++;
    
    if (currentRound > MAX_ROUNDS) {
