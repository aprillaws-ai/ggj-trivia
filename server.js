const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let players = {};
let currentRound = 0;
const MAX_ROUNDS = 10;
let gameActive = false;
let searchStartTime = 0;

const TRIVIA_LIB = [
    { q: "Who is the king of the jungle?", scene: "scene.jpg", targetX: 608, targetY: 250, radius: 50 }
];

app.get('/admin-dashboard', (req, res) => {
    const sorted = Object.values(players).sort((a, b) => b.score - a.score);
    let rows = sorted.map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.userId}</td><td>${p.score}</td></tr>`).join('');
    res.send(`<html><body><h1>Admin - Round ${currentRound}</h1><table border="1"><tr><th>Rank</th><th>Name</th><th>ID</th><th>Score</th></tr>${rows}</table><br><button onclick="fetch('/start-game-trigger')">START GAME</button><script>setTimeout(()=>location.reload(),3000)</script></body></html>`);
});

app.get('/start-game-trigger', (req, res) => {
    currentRound = 0;
    runNextRound();
    res.send("Started");
});

io.on('connection', (socket) => {
    socket.on('joinGame', (data) => {
        if (Object.keys(players).length < 20) {
            players[socket.id] = { name: data.nickname, userId: data.userId, score: 0 };
            io.emit('updatePlayerCount', Object.keys(players).length);
        }
    });
    socket.on('foundItem', () => {
        if (gameActive && players[socket.id]) {
            const reactionTime = (Date.now() - searchStartTime) / 1000;
            const points = Math.max(100, Math.floor(1000 - (reactionTime * 60)));
            players[socket.id].score += points;
            gameActive = false; 
            io.emit('roundWinner', { name: players[socket.id].name, points: points });
            setTimeout(runNextRound, 3000);
        }
    });
    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayerCount', Object.keys(players).length);
    });
});

function runNextRound() {
    currentRound++;
    if (currentRound > MAX_ROUNDS) {
        const finalStandings = Object.values(players).sort((a, b) => b.score - a.score);
        io.emit('tournamentComplete', finalStandings);
        setTimeout(() => { players = {}; io.emit('resetGame'); }, 15000);
        return;
    }
    const rd = TRIVIA_LIB[Math.floor(Math.random() * TRIVIA_LIB.length)];
    io.emit('phaseThink', { q: rd.q, round: currentRound, time: 5 });
    setTimeout(() => {
        gameActive = true;
        searchStartTime = Date.now();
        io.emit('phaseSearch', { scene: rd.scene, targetX: rd.targetX, targetY: rd.targetY, radius: rd.radius, time: 15 });
        setTimeout(() => {
            if (gameActive) {
                gameActive = false;
                io.emit('roundTimeout');
                setTimeout(runNextRound, 3000);
            }
        }, 15000);
    }, 5000);
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
