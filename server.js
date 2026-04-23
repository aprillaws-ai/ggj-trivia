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
const TRIVIA_LIB = [
    { 
        q: "Who is the king of the jungle?", 
        scene: "scene.jpg", 
        targetX: 608, 
        targetY: 250, 
        radius: 50 
    }
    // You can add more questions here following the exact format above
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
            </div>
            <script>setTimeout(() => location.reload(), 3000);</script>
        </body>
        </html>
    `);
});

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
    
    socket.on('joinGame', (data) => {
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
            const points = Math.max(100, Math.floor(1000 - (reactionTime * 60)));
            
            players[socket.id].score += points;
            gameActive = false; 
            
            io.emit('roundWinner', { 
                name: players[socket.id].name, 
                points: points 
            });

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
        
        setTimeout(() => {
            players = {}; 
            io.emit('resetGame');
        }, 15000);
        return;
    }

    const roundData = TRIVIA_LIB[Math.floor(Math.random() * TRIVIA_LIB.length)];
    
    io.emit('phaseThink', { 
        q: roundData.q, 
        round: currentRound, 
        time: 5 
    });

    setTimeout(() => {
        gameActive = true;
        searchStartTime = Date.now();
        io.emit('phaseSearch', { 
            scene: roundData.scene, 
            targetX: roundData.targetX, 
            targetY: roundData.targetY, 
            radius: roundData.radius,
            time: 15
        });

        setTimeout(() => {
            if (gameActive) {
                gameActive = false;
                io.emit('roundTimeout');
                setTimeout(runNextRound, 3000);
            }
        }, 15000);
    }, 5000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Game Server running on port ${PORT}`));
