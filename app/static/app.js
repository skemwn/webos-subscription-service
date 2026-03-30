// =============================================================================
// 전역 변수
// =============================================================================
let subscribers = [];
let currentDevices = [];
let selectedUserId = null;
let selectedDeviceId = null;
let usageChart = null;
let deviceLoadError = false;


// =============================================================================
// [요구사항 #3] 상태 기반 Badge 스타일
// =============================================================================
// TODO [요구사항 #3]: 상태 값(value)에 따라 적절한 CSS 클래스를 반환하세요.
//
// 매핑 규칙:
//   Active, Online, Normal   → "badge status-active"   (초록)
//   Paused, Standby          → "badge status-paused"   (파랑)
//   Expired, Error, Warning  → "badge status-expired"  (빨강)
//   Offline                  → "badge status-offline"  (회색)
//   On, Cleaning             → "badge status-on"       (노랑)
//   Off                      → "badge status-off"      (연회색)
//   그 외                     → "badge"
//
// Hint: value를 소문자로 변환 후 비교하세요.
function badgeClass(value) {
    const v = (value || "").toLowerCase();

    if (["active", "online", "normal"].includes(v)) return "badge status-active";
    if (["paused", "standby"].includes(v)) return "badge status-paused";
    if (["expired", "error", "warning"].includes(v)) return "badge status-expired";
    if (v === "offline") return "badge status-offline";
    if (["on", "cleaning"].includes(v)) return "badge status-on";
    if (v === "off") return "badge status-off";

    return "badge";
}


// =============================================================================
// [요구사항 #1] 구독 사용자 조회 + 검색/필터
// =============================================================================

// TODO [요구사항 #1-A]: GET /api/subscribers 를 호출하여
//   subscribers 변수에 저장하고 renderSubscribers()를 호출하세요.
//
// Hint:
//   const res = await fetch("/api/subscribers");
//   subscribers = await res.json();
async function fetchSubscribers() {
    const tbody = document.getElementById("subscriber-body");

    try {
        const res = await fetch("/api/subscribers");
        if (!res.ok) {
            throw new Error(`Failed to load subscribers (${res.status})`);
        }

        const data = await res.json();
        subscribers = Array.isArray(data) ? data : [];
        renderSubscribers();
    } catch (error) {
        subscribers = [];
        tbody.innerHTML = `<tr><td colspan="5">Failed to load subscribers.</td></tr>`;
        console.error(error);
    }
}

// TODO [요구사항 #1-B]: subscribers 배열을 테이블에 렌더링하세요.
//
// 구현 순서:
//   1. subscriber-search 입력값과 subscriber-status-filter 선택값을 가져온다
//   2. subscribers 배열에서 검색어(이름/플랜/상태/ID)와 상태 필터 조건으로 필터링한다
//   3. subscriber-body <tbody>에 필터링된 결과를 <tr>로 추가한다
//   4. 각 행에는 userId, name, plan, status(badge), deviceCount를 표시한다
//   5. 각 행 클릭 시 selectSubscriber(userId)를 호출한다
//   6. 현재 선택된 사용자(selectedUserId)는 "selected" 클래스를 추가한다
function renderSubscribers() {
    const tbody = document.getElementById("subscriber-body");
    const search = document.getElementById("subscriber-search").value.toLowerCase();
    const statusFilter = document.getElementById("subscriber-status-filter").value;

    tbody.innerHTML = "";

    const filtered = subscribers.filter((subscriber) => {
        const keyword = [
            subscriber.userId,
            subscriber.name,
            subscriber.plan,
            subscriber.status,
        ]
            .join(" ")
            .toLowerCase();

        const matchedSearch = !search || keyword.includes(search);
        const matchedStatus = !statusFilter || subscriber.status === statusFilter;

        return matchedSearch && matchedStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">No subscribers matched your filter.</td></tr>`;
        return;
    }

    filtered.forEach((subscriber) => {
        const tr = document.createElement("tr");
        tr.classList.add("clickable");
        if (subscriber.userId === selectedUserId) {
            tr.classList.add("selected");
        }

        tr.innerHTML = `
            <td>${subscriber.userId}</td>
            <td>${subscriber.name}</td>
            <td>${subscriber.plan}</td>
            <td><span class="${badgeClass(subscriber.status)}">${subscriber.status}</span></td>
            <td>${subscriber.deviceCount}</td>
        `;

        tr.addEventListener("click", () => selectSubscriber(subscriber.userId));
        tbody.appendChild(tr);
    });
}


// =============================================================================
// [요구사항 #2] 사용자별 가전 목록 + 사용 현황 + 차트
// =============================================================================

// TODO [요구사항 #2-A]: 사용자 클릭 시 해당 사용자의 가전 목록을 조회하세요.
//
// 구현 순서:
//   1. selectedUserId를 업데이트하고 selectedDeviceId를 null로 초기화
//   2. renderSubscribers()를 호출하여 선택 상태를 반영
//   3. usage-detail을 숨기고 usage-empty를 표시 (이전 사용 현황 초기화)
//   4. GET /api/subscribers/{userId}/devices 를 호출
//   5. currentDevices에 저장하고 renderDevices()를 호출
async function selectSubscriber(userId) {
    selectedUserId = userId;
    selectedDeviceId = null;
    deviceLoadError = false;
    renderSubscribers();

    const usageDetail = document.getElementById("usage-detail");
    const usageEmpty = document.getElementById("usage-empty");
    const usageInfo = document.getElementById("usage-info");
    usageDetail.classList.add("hidden");
    usageEmpty.classList.remove("hidden");
    usageEmpty.textContent = "Select a device to view usage details.";
    usageInfo.innerHTML = "";

    if (usageChart) {
        usageChart.destroy();
        usageChart = null;
    }

    try {
        const res = await fetch(`/api/subscribers/${userId}/devices`);
        if (!res.ok) {
            throw new Error(`Failed to load devices (${res.status})`);
        }

        const data = await res.json();
        currentDevices = Array.isArray(data) ? data : [];
    } catch (error) {
        currentDevices = [];
        deviceLoadError = true;
        console.error(error);
    }

    renderDevices();
}

// TODO [요구사항 #2-B]: currentDevices 배열을 테이블에 렌더링하세요.
//
// 구현 순서:
//   1. device-search, device-status-filter 값으로 필터링
//      (검색 대상: type, model, status, deviceId, location)
//   2. 가전이 없으면 device-empty에 "No registered devices" 메시지 표시
//   3. 필터 결과가 없으면 "No devices matched your filter." 메시지 표시
//   4. device-table <tbody>에 deviceId, type, model, location, status(badge) 표시
//   5. 각 행 클릭 시 selectDevice(deviceId)를 호출
//   6. 현재 선택된 가전(selectedDeviceId)은 "selected" 클래스를 추가
function renderDevices() {
    const emptyEl = document.getElementById("device-empty");
    const tableEl = document.getElementById("device-table");
    const tbody = document.getElementById("device-body");
    const search = document.getElementById("device-search").value.toLowerCase();
    const statusFilter = document.getElementById("device-status-filter").value;

    tbody.innerHTML = "";

    if (!selectedUserId) {
        tableEl.classList.add("hidden");
        emptyEl.classList.remove("hidden");
        emptyEl.textContent = "Select a subscriber to view devices.";
        return;
    }

    if (deviceLoadError) {
        tableEl.classList.add("hidden");
        emptyEl.classList.remove("hidden");
        emptyEl.textContent = "Failed to load devices.";
        return;
    }

    if (!currentDevices.length) {
        tableEl.classList.add("hidden");
        emptyEl.classList.remove("hidden");
        emptyEl.textContent = "No registered devices";
        return;
    }

    const filtered = currentDevices.filter((device) => {
        const keyword = [
            device.deviceId,
            device.type,
            device.model,
            device.location,
            device.status,
        ]
            .join(" ")
            .toLowerCase();

        const matchedSearch = !search || keyword.includes(search);
        const matchedStatus = !statusFilter || device.status === statusFilter;

        return matchedSearch && matchedStatus;
    });

    if (!filtered.length) {
        tableEl.classList.add("hidden");
        emptyEl.classList.remove("hidden");
        emptyEl.textContent = "No devices matched your filter.";
        return;
    }

    tableEl.classList.remove("hidden");
    emptyEl.classList.add("hidden");

    filtered.forEach((device) => {
        const tr = document.createElement("tr");
        tr.classList.add("clickable");
        if (device.deviceId === selectedDeviceId) {
            tr.classList.add("selected");
        }

        tr.innerHTML = `
            <td>${device.deviceId}</td>
            <td>${device.type}</td>
            <td>${device.model}</td>
            <td>${device.location}</td>
            <td><span class="${badgeClass(device.status)}">${device.status}</span></td>
        `;

        tr.addEventListener("click", () => selectDevice(device.deviceId));
        tbody.appendChild(tr);
    });
}

// TODO [요구사항 #2-C]: 가전 클릭 시 상세 사용 현황을 조회하세요.
//
// 구현 순서:
//   1. selectedDeviceId를 업데이트하고 renderDevices()를 호출
//   2. GET /api/devices/{deviceId}/usage 를 호출
//   3. usage-empty를 숨기고 usage-detail을 표시
//   4. usage-info에 아래 정보를 표시:
//      - Device ID, Device Name, Power Status(badge),
//        Last Used, Total Usage Hours, Weekly Usage Count,
//        Health Status(badge), Remark
//   5. renderUsageChart(data.weeklyUsageTrend)를 호출
async function selectDevice(deviceId) {
    selectedDeviceId = deviceId;
    renderDevices();

    const usageEmpty = document.getElementById("usage-empty");
    const usageDetail = document.getElementById("usage-detail");
    const usageInfo = document.getElementById("usage-info");

    try {
        const res = await fetch(`/api/devices/${deviceId}/usage`);
        if (!res.ok) {
            throw new Error(`Failed to load device usage (${res.status})`);
        }

        const data = await res.json();
        if (!data || typeof data !== "object") {
            throw new Error("Invalid usage response payload");
        }

        usageInfo.innerHTML = `
            <div class="label">Device ID</div><div class="value">${data.deviceId}</div>
            <div class="label">Device Name</div><div class="value">${data.deviceName}</div>
            <div class="label">Power Status</div><div class="value"><span class="${badgeClass(data.powerStatus)}">${data.powerStatus}</span></div>
            <div class="label">Last Used</div><div class="value">${data.lastUsedAt}</div>
            <div class="label">Total Usage Hours</div><div class="value">${data.totalUsageHours}</div>
            <div class="label">Weekly Usage Count</div><div class="value">${data.weeklyUsageCount}</div>
            <div class="label">Health Status</div><div class="value"><span class="${badgeClass(data.healthStatus)}">${data.healthStatus}</span></div>
            <div class="label">Remark</div><div class="value">${data.remark}</div>
        `;

        usageEmpty.classList.add("hidden");
        usageDetail.classList.remove("hidden");
        renderUsageChart(data.weeklyUsageTrend || []);
    } catch (error) {
        usageDetail.classList.add("hidden");
        usageEmpty.classList.remove("hidden");
        usageEmpty.textContent = "Failed to load usage details.";
        console.error(error);
    }
}

// TODO [요구사항 #2-D]: Chart.js를 사용하여 주간 사용량 Bar Chart를 그리세요.
//
// 구현 순서:
//   1. 기존 차트가 있으면 destroy() 호출
//   2. new Chart()로 Bar Chart를 생성
//      - labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
//      - data: trend 배열
//      - options: responsive, beginAtZero
//
// Hint:
//   usageChart = new Chart(ctx, { type: "bar", data: {...}, options: {...} });
function renderUsageChart(trend) {
    const ctx = document.getElementById("usageChart");
    const safeTrend = Array.isArray(trend) ? trend : [];

    if (usageChart) {
        usageChart.destroy();
    }

    usageChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            datasets: [
                {
                    label: "Usage Count",
                    data: safeTrend,
                    backgroundColor: "rgba(37, 99, 235, 0.6)",
                    borderColor: "rgba(37, 99, 235, 1)",
                    borderWidth: 1,
                    borderRadius: 6,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                    },
                },
            },
        },
    });
}


// =============================================================================
// 이벤트 바인딩 + 초기화
// =============================================================================
function bindEvents() {
    document.getElementById("subscriber-search").addEventListener("input", renderSubscribers);
    document.getElementById("subscriber-status-filter").addEventListener("change", renderSubscribers);

    document.getElementById("device-search").addEventListener("input", renderDevices);
    document.getElementById("device-status-filter").addEventListener("change", renderDevices);
}

bindEvents();

fetchSubscribers();
