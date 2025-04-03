const express = require("express");
const cors = require("cors");
const path = require("path");
const { WebSocketServer } = require("ws");

const app = express();
const port = 3000;

// CORS 및 JSON 처리
app.use(cors());
app.use(express.json());

// 📌 정적 파일 제공 (public 폴더 내 HTML 제공)
app.use(express.static(path.join(__dirname, "public")));

// 📌 기본 루트
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 📌 테스트용 경로 리스트
const routes = {
    "경로1": ["좌표1", "좌표2", "좌표3"],
    "경로2": ["좌표A", "좌표B", "좌표C"],
    "경로3": ["위치X", "위치Y", "위치Z"]
};

// 📌 경로 리스트 조회 API
app.get("/routes", (req, res) => {
    res.json({
        message: "저장된 경로 리스트",
        routes: Object.keys(routes)
    });
});

// 📌 특정 경로의 좌표 조회 API
app.get("/route/:name", (req, res) => {
    const routeName = req.params.name;
    if (routes[routeName]) {
        res.json({
            routeName: routeName,
            coordinates: routes[routeName]
        });
    } else {
        res.status(404).json({ error: "해당 경로를 찾을 수 없습니다." });
    }
});

// 📌 새로운 경로 추가 API
app.post("/route", (req, res) => {
    const { name, coordinates } = req.body;
    if (!name || !Array.isArray(coordinates)) {
        return res.status(400).json({ error: "올바른 경로 이름과 좌표 배열을 제공하세요." });
    }

    routes[name] = coordinates;
    res.json({ message: `경로 '${name}' 추가됨`, routes });
});

// 📌 경로 삭제 API
app.delete("/route/:name", (req, res) => {
    const routeName = req.params.name;
    if (routes[routeName]) {
        delete routes[routeName];
        res.json({ message: `경로 '${routeName}' 삭제됨`, routes });
    } else {
        res.status(404).json({ error: "삭제할 경로를 찾을 수 없습니다." });
    }
});

// 📌 HTTP 서버 실행
const server = app.listen(port, () => {
    console.log(`🚀 서버 실행 중: http://localhost:${port}`);
    console.log("📍 저장된 경로 리스트:", Object.keys(routes));
});

// 📌 WebSocket 서버 추가
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
    console.log("✅ WebSocket 클라이언트 연결됨!");

    // 테스트용으로 주기적으로 가짜 Odometry 데이터 전송
    setInterval(() => {
        const fakeOdomData = {
            x: (Math.random() * 10).toFixed(2),
            y: (Math.random() * 10).toFixed(2),
            theta: (Math.random() * Math.PI * 2).toFixed(2),
        };
        ws.send(JSON.stringify(fakeOdomData));
    }, 2000);

    ws.on("message", (message) => {
        console.log("📩 받은 메시지:", message.toString());
    });

    ws.on("close", () => {
        console.log("🔌 WebSocket 연결 종료됨");
    });
});
