const express = require("express");
const cors = require("cors");
const path = require("path");
const { WebSocketServer } = require("ws");
const rosnodejs = require("rosnodejs");

const app = express();
const port = 3000;

// CORS 및 JSON 처리
app.use(cors());
app.use(express.json());

// 정적 파일 제공 (index.html 포함)
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ROS 초기화
rosnodejs.initNode("/move_base_client").then((rosNode) => {
    const goalPub = rosNode.advertise("/move_base/goal", "move_base_msgs/MoveBaseActionGoal");

    console.log("✅ ROS Publisher 설정 완료!");

    // 📌 테스트용 경로 리스트
    const routes = {
        "경로1": [
            { x: 4.446, y: -1.609, z: -0.561, orientation: { x: 0.0, y: 0.0, z: 0.002, w: 0.999 } },
            { x: 3.200, y: -0.800, z: 0.0, orientation: { x: 0.0, y: 0.0, z: 0.005, w: 0.999 } }
        ],
        "경로2": [
            { x: 1.000, y: 2.000, z: 0.0, orientation: { x: 0.0, y: 0.0, z: 0.002, w: 1.0 } }
        ]
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

    app.post("/set_goal", (req, res) => {
        const { route, index } = req.body;
    
        if (!routes[route] || index === undefined || index < 0 || index >= routes[route].length) {
            return res.status(400).json({ error: "올바르지 않은 경로 또는 인덱스입니다." });
        }
    
        const target = routes[route][index];  // 선택한 인덱스의 좌표
    
        const goalMsg = {
            header: {
                stamp: rosnodejs.Time.now(),
                frame_id: "map"
            },
            goal_id: {
                stamp: rosnodejs.Time.now(),
                id: `/loas_navi_client-${Date.now()}`
            },
            goal: {
                target_pose: {
                    header: {
                        stamp: rosnodejs.Time.now(),
                        frame_id: "map"
                    },
                    pose: {
                        position: {
                            x: target.x,
                            y: target.y,
                            z: target.z
                        },
                        orientation: target.orientation
                    }
                }
            }
        };
    
        goalPub.publish(goalMsg);
        console.log("📌 목표 위치 전송 완료:", goalMsg);
    
        res.json({ message: `목표 위치 설정 완료 (경로: ${route}, 인덱스: ${index})`, goal: target });
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
});
