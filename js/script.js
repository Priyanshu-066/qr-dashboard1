const sheetURL = "https://opensheet.elk.sh/1qaiL7Cd6C8omXEgHa9QsQZShJepWBfM1AAtCQQsW96Y/Wholesellers_List";

const container = document.getElementById("cardsContainer");

let allData = []; // 🔥 store data globally


// 🔐 Admin session check
const admin = sessionStorage.getItem("admin");

if (!admin) {
  alert("Admin login required");
  window.location.href = "admin-login.html";
}


// ================= LOAD DATA =================
function loadWholesellers() {

  fetch(sheetURL)
  .then(res => res.json())
  .then(data => {

    allData = data; // ✅ store full data
    renderCards(allData); // render

  })
  .catch(err => {
    console.error(err);
    container.innerHTML = "<p style='color:red'>Failed to load data</p>";
  });
}


// ================= RENDER CARDS =================
function renderCards(data) {

  container.innerHTML = "";

  data.forEach(item => {

    if (!item.ID) return;

    const card = document.createElement("div");
    card.className = "card";

    const qrId = `qr-${item.ID}`;

    card.innerHTML = `
      <p class="id">WHOLESALER ID</p>
      <h2>${item.ID}</h2>
      <h3>${item.Name}</h3>
      <p>${item.Location}</p>

      <canvas id="${qrId}"></canvas>

      <div class="btn-group">
        <button class="btn download-btn" onclick="downloadQR('${qrId}', '${item.ID}')">
          Download QR
        </button>

        <button class="btn delete-btn" onclick="openDeleteModal('${item.ID}')">
          Delete
        </button>
      </div>
    `;

    container.appendChild(card);

    const qrData = `https://priyanshu-066.github.io/qr-dashboard1/tracking.html?wid=${item.ID}`;

    QRCode.toCanvas(document.getElementById(qrId), qrData, {
      width: 300,
      margin: 2
    });

  });
}


// ================= SEARCH =================
const searchInput = document.getElementById("searchInput");

if (searchInput) {
  searchInput.addEventListener("input", function(e) {

    const value = e.target.value.toLowerCase();

    const filtered = allData.filter(item =>
      item.ID.toLowerCase().includes(value) ||
      item.Name.toLowerCase().includes(value)
    );

    renderCards(filtered);

  });
}


// ================= DOWNLOAD =================
function downloadQR(canvasId, wid) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const link = document.createElement("a");
  link.download = `QR_${wid}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}


// ================= DELETE =================
let deleteId = null;

function openDeleteModal(wid) {
  deleteId = wid;
  document.getElementById("deleteText").innerText = `Delete ${wid}?`;
  document.getElementById("deleteModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("deleteModal").style.display = "none";
  deleteId = null;
}

function confirmDelete() {

  if (!deleteId) return;

  const loader = document.getElementById("loader");
  loader.classList.remove("hidden");

  const formData = new FormData();
  formData.append("type", "deleteWholeseller");
  formData.append("wid", deleteId);

  fetch("https://script.google.com/macros/s/AKfycbxudcAmn6oSYIc1A7lTeF9Lvai8QYuXkqebhpcocTdfPrDMqIjLvn-BL773sli6OxQokg/exec", {
    method: "POST",
    body: formData
  })
  .then(() => {

    // remove instantly
    renderCards(allData.filter(item => item.ID !== deleteId));

    loader.classList.add("hidden");
    closeModal();

  })
  .catch(err => {
    console.error(err);
    alert("Delete failed");
    loader.classList.add("hidden");
  });
}


// ================= DROPDOWN =================
function toggleDropdown() {
  document.getElementById("adminDropdown").classList.toggle("hidden");
}

window.addEventListener("click", function(e) {
  const dropdown = document.getElementById("adminDropdown");
  const adminSection = document.querySelector(".admin-section");

  if (!adminSection.contains(e.target)) {
    dropdown.classList.add("hidden");
  }
});

function logout(e) {
  e.stopPropagation();
  sessionStorage.removeItem("admin");
  window.location.href = "admin-login.html";
}


// ================= ADMIN NAME =================
const adminName = sessionStorage.getItem("admin");

if (adminName) {
  const nameEl = document.getElementById("adminName");
  const displayEl = document.getElementById("adminDisplay");

  if (nameEl) nameEl.innerText = adminName;
  if (displayEl) displayEl.innerText = "👤 " + adminName;
}


// ================= STATS =================
function loadStats() {

  fetch("https://opensheet.elk.sh/1qaiL7Cd6C8omXEgHa9QsQZShJepWBfM1AAtCQQsW96Y/Wholesellers_List")
  .then(res => res.json())
  .then(data => {
    document.getElementById("totalWholesellers").innerText = data.length;
  });

  fetch("https://opensheet.elk.sh/1qaiL7Cd6C8omXEgHa9QsQZShJepWBfM1AAtCQQsW96Y/All_Customers")
  .then(res => res.json())
  .then(data => {
    document.getElementById("totalCustomers").innerText = data.length;
  });
}


// ================= INIT =================
loadWholesellers();
loadStats();
setInterval(loadWholesellers, 10000);
