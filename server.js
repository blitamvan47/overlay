const express = require("express");
const path = require("path");
const { WebcastPushConnection } = require("tiktok-live-connector");
const WebSocket = require("ws");

const app = express();
const server = require("http").createServer(app);
const wss = new WebSocket.Server({ server });

let connection = null;
let counts = {};
let resetInterval = parseInt(process.env.RESET_INTERVAL || "60", 10);
let timeRemaining = resetInterval;

function resetCounts() {
    counts = {};
    timeRemaining = resetInterval;
}
setInterval(() => {
    timeRemaining--;
    if (timeRemaining <= 0) {
        resetCounts();
    }
}, 1000);

app.use(express.static(path.join(__dirname, "public")));

// Endpoint connect ke username TikTok
app.get("/connect/:username", async (req, res) => {
    let username = req.params.username;
    try {
        connection = new WebcastPushConnection(username);
        await connection.connect();
        res.json({ success: true, message: `Connected to ${username}` });

        connection.on("chat", (data) => {
            let userId = data.userId.toString();
            if (!counts[userId]) {
                counts[userId] = {
                    text: data.nickname,
                    avatar: data.profilePictureUrl,
                    count: 0
                };
            }
            counts[userId].count++;
            broadcast(JSON.stringify({
                type: "chat",
                nickname: data.nickname,
                comment: data.comment,
                profilePictureUrl: data.profilePictureUrl
            }));
        });
    } catch (err) {
        res.json({ success: false, message: err.toString() });
    }
});

// Endpoint top3
app.get("/top3", (req, res) => {
    if (req.query.reset) {
        resetInterval = parseInt(req.query.reset, 10) || resetInterval;
    }
    let top3 = Object.values(counts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
    res.json({ top3, resetInterval, timeRemaining });
});

function broadcast(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port " + PORT));
