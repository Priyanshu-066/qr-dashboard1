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
  updateFilteredStat(data);
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

  if (e) e.stopPropagation();

  sessionStorage.removeItem("admin");

  window.location.href = "index.html";
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

    // ✅ Today registrations
    const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const todayCount = data.filter(item => {
      if (!item.CreatedDate) return false;
      // CreatedDate stored as "DD-MM-YYYY" from Apps Script new Date()
      // normalise both formats for safe comparison
      const raw = item.CreatedDate.toString().trim();
      // try parsing directly
      const parsed = new Date(raw);
      if (!isNaN(parsed)) {
        return parsed.toISOString().slice(0, 10) === todayStr;
      }
      // fallback: DD-MM-YYYY → compare after converting
      const parts = raw.split("-");
      if (parts.length === 3) {
        const iso = `${parts[2]}-${parts[1]}-${parts[0]}`;
        return iso === todayStr;
      }
      return false;
    }).length;

    document.getElementById("statToday").innerText = todayCount;
  });

  fetch("https://opensheet.elk.sh/1qaiL7Cd6C8omXEgHa9QsQZShJepWBfM1AAtCQQsW96Y/All_Customers")
  .then(res => res.json())
  .then(data => {
    document.getElementById("totalCustomers").innerText = data.length;
  });
}
// ================= FILTERED COUNT STAT =================
function updateFilteredStat(data) {
  const el = document.getElementById("statFiltered");
  if (el) el.innerText = data.length;
}


// ================= DATE FILTER =================
function applyDateFilter() {
  const startVal = document.getElementById("filterStart").value;
  const endVal   = document.getElementById("filterEnd").value;

  if (!startVal && !endVal) {
    renderCards(allData);
    return;
  }

  const startMs = startVal ? new Date(startVal).setHours(0, 0, 0, 0)     : 0;
  const endMs   = endVal   ? new Date(endVal).setHours(23, 59, 59, 999)  : Infinity;

  const filtered = allData.filter(item => {
    if (!item.CreatedDate) return false;
    const raw    = item.CreatedDate.toString().trim();
    let dateMs;
    const parsed = new Date(raw);
    if (!isNaN(parsed)) {
      dateMs = parsed.getTime();
    } else {
      // DD-MM-YYYY fallback
      const parts = raw.split("-");
      if (parts.length === 3) {
        dateMs = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
      } else {
        return false;
      }
    }
    return dateMs >= startMs && dateMs <= endMs;
  });

  renderCards(filtered);
}


// ================= RESET FILTER =================
function resetDateFilter() {
  document.getElementById("filterStart").value = "";
  document.getElementById("filterEnd").value   = "";
  renderCards(allData);
}


// ================= EXPORT CSV =================
function exportWholesellersCSV() {

  // Export whichever cards are currently rendered — read from allData filtered state
  const visibleCards = document.querySelectorAll("#cardsContainer .card");

  if (!visibleCards || visibleCards.length === 0) {
    alert("No wholesalers to export.");
    return;
  }

  // Match visible card IDs back to allData to get full row data including CreatedDate
  const visibleIDs = Array.from(visibleCards).map(card => {
    return card.querySelector("h2") ? card.querySelector("h2").innerText.trim() : null;
  }).filter(Boolean);

  const exportRows = allData.filter(item => visibleIDs.includes(item.ID));

  if (exportRows.length === 0) {
    alert("No data to export.");
    return;
  }

  // BOM for Excel UTF-8 compatibility
  let csv = "\uFEFF";
  csv += "ID,Name,Location,CreatedDate\n";

  exportRows.forEach(item => {
    const row = [
      item.ID       || "",
      item.Name     || "",
      item.Location || "",
      item.CreatedDate || ""
    ].map(v => '"' + v.toString().replace(/"/g, '""') + '"').join(",");
    csv += row + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "wholesalers_" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ================= INIT =================
loadWholesellers();
loadStats();
setInterval(loadWholesellers, 10000);
