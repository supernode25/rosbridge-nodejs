document.getElementById("load-routes").addEventListener("click", () => {
    fetch("http://localhost:3000/routes")
        .then(response => response.json())
        .then(data => {
            if (data.routes) {
                console.log("📍 불러온 경로 리스트:", data.routes);
                
                // 경로 목록 표시
                const routeList = document.getElementById("route-list");
                routeList.innerHTML = "";

                data.routes.forEach(route => {
                    const routeContainer = document.createElement("div");
                    routeContainer.classList.add("route-container");

                    // 경로 버튼 생성
                    const routeButton = document.createElement("button");
                    routeButton.textContent = route;
                    routeButton.addEventListener("click", () => loadCoordinates(route, routeContainer));
                    
                    routeContainer.appendChild(routeButton);
                    routeList.appendChild(routeContainer);
                });
            }
        })
        .catch(error => console.error("❌ 경로 불러오기 오류:", error));
});

// 특정 경로의 좌표 불러오기
function loadCoordinates(routeName, container) {
    fetch(`http://localhost:3000/route/${routeName}`)
        .then(response => response.json())
        .then(data => {
            if (data.coordinates) {
                console.log(`📍 ${routeName}의 좌표:`, data.coordinates);
                
                // 기존 좌표 목록 제거 후 추가
                let coordContainer = container.querySelector(".coordinates");
                if (!coordContainer) {
                    coordContainer = document.createElement("div");
                    coordContainer.classList.add("coordinates");
                    container.appendChild(coordContainer);
                }
                coordContainer.innerHTML = "";

                data.coordinates.forEach(coord => {
                    const coordButton = document.createElement("button");
                    coordButton.textContent = coord;
                    coordContainer.appendChild(coordButton);
                });
            }
        })
        .catch(error => console.error(`❌ ${routeName} 좌표 불러오기 오류:`, error));
}
