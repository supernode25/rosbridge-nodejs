const express = require("express");
const cors = require("cors");
const path = require("path");
const { WebSocketServer } = require("ws");
const rosnodejs = require("rosnodejs");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

rosnodejs.initNode("/move_base_client").then((rosNode) => {
    const goalPub = rosNode.advertise("/move_base/goal", "move_base_msgs/MoveBaseActionGoal");
    console.log("✅ ROS Publisher 설정 완료!");

    let latestPose = null;
    let latestPointCloudRaw = null;
    let latestMapData = null;

    // ✅ PointCloud2 파싱 함수 추가
    function parsePointCloud2(msg) {
        const buffer = Buffer.from(msg.data);
        const points = [];
        const offsetX = 0;
        const offsetY = 4;
        const offsetZ = 8;

        for (let i = 0; i < msg.width; i++) {
            const base = i * msg.point_step;
            const x = buffer.readFloatLE(base + offsetX);
            const y = buffer.readFloatLE(base + offsetY);
            const z = buffer.readFloatLE(base + offsetZ);
            points.push({ x, y, z });
        }

        return points;
    }

    rosNode.subscribe('/map', 'nav_msgs/OccupancyGrid', (msg) => {
        console.log("📍 맵 데이터 수신 완료");
        latestMapData = {
            width: msg.info.width,
            height: msg.info.height,
            resolution: msg.info.resolution,
            origin: msg.info.origin,
            data: msg.data
        };
    });

    rosNode.subscribe('/loas_localization_client/current_pose', 'geometry_msgs/PoseStamped', (msg) => {
        latestPose = {
            position: {
                x: msg.pose.position.x,
                y: msg.pose.position.y,
                z: msg.pose.position.z
            },
            orientation: msg.pose.orientation
        };
    });

    // ✅ 포인트 클라우드 수신 및 원본 저장
    rosNode.subscribe('/lslidar_point_cloud', 'sensor_msgs/PointCloud2', (msg) => {
        latestPointCloudRaw = msg;
    });

    const routes = {
        "경로1": [
            { x: 4.446, y: -1.609, z: -0.561, orientation: { x: 0.0, y: 0.0, z: 0.002, w: 0.999 } },
            { x: 3.200, y: -0.800, z: 0.0, orientation: { x: 0.0, y: 0.0, z: 0.005, w: 0.999 } }
        ],
        "경로2": [
            { x: 1.000, y: 2.000, z: 0.0, orientation: { x: 0.0, y: 0.0, z: 0.002, w: 1.0 } }
        ]
    };

    app.get("/map", (req, res) => {
        if (latestMapData) {
            res.json(latestMapData);
        } else {
            res.status(503).json({ error: "맵 데이터가 아직 수신되지 않았습니다." });
        }
    });

    app.get("/routes", (req, res) => {
        res.json({
            message: "저장된 경로 리스트",
            routes: Object.keys(routes)
        });
    });

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

        const target = routes[route][index];

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

    const server = app.listen(port, () => {
        console.log(`🚀 서버 실행 중: http://localhost:${port}`);
        console.log("📍 저장된 경로 리스트:", Object.keys(routes));
    });

    const wss = new WebSocketServer({ server });

    wss.on("connection", (ws) => {
        console.log("✅ WebSocket 클라이언트 연결됨!");

        const intervalId = setInterval(() => {
            const fakeOdomData = {
                x: (Math.random() * 10).toFixed(2),
                y: (Math.random() * 10).toFixed(2),
                theta: (Math.random() * Math.PI * 2).toFixed(2),
            };

            // ✅ PointCloud 변환된 좌표 포함
            const parsedPointCloud = latestPointCloudRaw
                ? {
                    header: latestPointCloudRaw.header,
                    width: latestPointCloudRaw.width,
                    height: latestPointCloudRaw.height,
                    point_step: latestPointCloudRaw.point_step,
                    row_step: latestPointCloudRaw.row_step,
                    points: parsePointCloud2(latestPointCloudRaw).slice(0, 200) // 최대 200개만 전송 (과부하 방지)
                }
                : null;

            ws.send(JSON.stringify({
                odom: fakeOdomData,
                current_pose: latestPose,
                point_cloud: parsedPointCloud,
                map: latestMapData
            }));
        }, 2000);

        ws.on("message", (message) => {
            console.log("📩 받은 메시지:", message.toString());
        });

        ws.on("close", () => {
            console.log("🔌 WebSocket 연결 종료됨");
            clearInterval(intervalId);
        });
    });
});
