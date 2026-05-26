/* ─────────────────────────────────────────────
   WID guard
───────────────────────────────────────────── */
const urlParams = new URLSearchParams(window.location.search);
const wid = urlParams.get("wid") || "";

if (!wid) {
  document.body.innerHTML =
    "<h2 style='color:red;text-align:center;margin-top:40px'>Invalid QR Code. Please scan again.</h2>";
  throw new Error("No WID");
}

document.getElementById("wid").value = wid;



(function initPincodeAutofill() {
  const pincodeInput = document.getElementById("pincode");
  const cityInput = document.getElementById("city");
  const stateInput = document.getElementById("state");
  const statusEl = document.getElementById("pincode-status");

  let lastFetchedPin = "";
  let activeController = null;

  function setStatus(message, type = "") {
    statusEl.textContent = message;
    statusEl.className = "pincode-status" + (type ? " " + type : "");
  }

  function clearDependentFields() {
    cityInput.value = "";
    stateInput.value = "";
    lastFetchedPin = "";
  }

  function anySignal(signals) {
    if (typeof AbortSignal.any === "function") return AbortSignal.any(signals);
    const ctrl = new AbortController();
    for (const s of signals) {
      if (s.aborted) { ctrl.abort(); break; }
      s.addEventListener("abort", () => ctrl.abort(), { once: true });
    }
    return ctrl.signal;
  }

  async function timedFetch(url, parentSignal, ms = 8000) {
    const timer = new AbortController();
    const id = setTimeout(() => timer.abort(), ms);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: anySignal([parentSignal, timer.signal]),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(id);
    }
  }

  function parsePostalPincodeResponse(data, pin) {
    if (!Array.isArray(data) || !data[0]) throw new Error("Bad shape");
    const r = data[0];
    if (r.Status === "Error" || r.Status === "404") {
      const e = new Error("Invalid PIN"); e.isInvalidPin = true; throw e;
    }
    if (r.Status !== "Success" || !Array.isArray(r.PostOffice) || !r.PostOffice.length) {
      throw new Error("No data");
    }
    const po = r.PostOffice[0];
    const city = (po.District || po.Division || po.Block || "").trim();
    const state = (po.State || "").trim();
    if (!city || !state) throw new Error("Incomplete data");
    return { city, state };
  }

  /* ── Tier 1: api.postalpincode.in (direct) ── */
  async function tryPostalPincodeDirect(pin, signal) {
    const data = await timedFetch(
      `https://api.postalpincode.in/pincode/${pin}`,
      signal
    );
    return parsePostalPincodeResponse(data, pin);
  }

  async function tryPostalPincodeViaProxy(pin, signal) {

    const proxyUrl =
      `https://corsproxy.io/?${encodeURIComponent(
        `https://api.postalpincode.in/pincode/${pin}`
      )}`;

    const data = await timedFetch(proxyUrl, signal);

    console.log("Proxy Response:", data);

    return parsePostalPincodeResponse(data, pin);
  }

/* ── Tier 3: Nominatim OpenStreetMap (fully independent) ── */
async function tryNominatim(pin, signal) {

  const data = await timedFetch(
    `https://nominatim.openstreetmap.org/search?postalcode=${pin}&country=India&format=json&addressdetails=1&limit=1`,
    signal
  );

  if (!Array.isArray(data) || !data.length) {
    throw new Error("No results");
  }

  const addr = data[0]?.address || {};

  console.log("Nominatim address:", addr);

  let city = (
    addr.city ||
    addr.county ||
    addr.state_district ||
    addr.city_district ||
    addr.municipality ||
    addr.suburb ||
    addr.town ||
    addr.village ||
    ""
  ).trim();

  let state = (
    addr.state ||
    addr.union_territory ||
    addr.region ||
    ""
  ).trim();

  /* ── Delhi special handling ── */
  if (
    city === "New Delhi" ||
    city === "Delhi" ||
    addr.country_code === "in-dl"
  ) {
    city = "Delhi";
    state = "Delhi";
  }

  /* ── Mumbai normalization ── */
  if (city === "Greater Mumbai") city = "Mumbai";
  if (city === "Mumbai Suburban") city = "Mumbai";

  /* ── Bangalore normalization ── */
  if (city === "Bengaluru Urban") city = "Bangalore";

  if (!city || !state) {
    throw new Error("Incomplete data");
  }

  return { city, state };
}
  const TIERS = [
    { name: "postalpincode.in (direct)", fn: tryPostalPincodeDirect },
    { name: "postalpincode.in (proxy)", fn: tryPostalPincodeViaProxy },
    { name: "nominatim OSM", fn: tryNominatim },
  ];

  async function fetchPinData(pin) {
    if (activeController) activeController.abort();
    activeController = new AbortController();
    const { signal } = activeController;

    setStatus("Fetching location…", "loading");
    clearDependentFields();

    let lastErr = null;

    try {
      for (let i = 0; i < TIERS.length; i++) {
        if (signal.aborted) return;
        const { name, fn } = TIERS[i];
        try {
          console.info(`[PIN] Tier ${i + 1} (${name}) → ${pin}`);
          const { city, state } = await fn(pin, signal);
          cityInput.value = city;
          stateInput.value = state;
          lastFetchedPin = pin;
          setStatus(`✓ ${city}, ${state}`, "success");
          console.info(`[PIN] Success via ${name}: ${city}, ${state}`);
          return;
        } catch (err) {
          if (err.name === "AbortError") return;
          if (err.isInvalidPin) {
            setStatus("Invalid PIN code. Please check and re-enter.", "error");
            return;
          }
          console.warn(`[PIN] Tier ${i + 1} (${name}) failed:`, err.message);
          lastErr = err;
        }
      }

      console.error("[PIN] All tiers exhausted:", lastErr?.message);

      clearDependentFields();

      cityInput.removeAttribute("readonly");
      stateInput.removeAttribute("readonly");

      setStatus(
        "Could not fetch location. Please fill City and State manually.",
        "error"
      );

    } finally {
      activeController = null;
    }
  }

  function handlePincodeInput(e) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 6);
    if (e.target.value !== raw) e.target.value = raw;

    if (raw.length < 6) {
      if (lastFetchedPin !== "") {
        clearDependentFields();
        cityInput.setAttribute("readonly", "");
        stateInput.setAttribute("readonly", "");
      }
      const left = 6 - raw.length;
      setStatus(raw.length > 0 ? `Enter ${left} more digit${left !== 1 ? "s" : ""}` : "", "");
      return;
    }

    if (raw === lastFetchedPin) return;

    cityInput.setAttribute("readonly", "");
    stateInput.setAttribute("readonly", "");
    fetchPinData(raw);
  }

  pincodeInput.addEventListener("input", handlePincodeInput);
  pincodeInput.addEventListener("paste", () => {
    setTimeout(() => handlePincodeInput({ target: pincodeInput }), 0);
  });
})();


/* ─────────────────────────────────────────────
   SHA-512 HELPER
───────────────────────────────────────────── */
async function sha512(message) {
  const buf = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-512", buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}


/* ─────────────────────────────────────────────
   FORM SUBMISSION → PayU
───────────────────────────────────────────── */
document.getElementById("customerForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const btn = this.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Please wait...";

  const key = "GJ7pYZ";
  const salt = "ZqPhrDeFyxte05Uh8oHsBpRHtV5OTpyk";
  const txnid = "TXN_" + Date.now();
  const amount = "1";
  const firstname = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim() || "noemail@kalyan.org";
  const phone = document.getElementById("phone").value.trim();
  const productinfo = "Kalyan Subscription";

  const GAS_URL =
    "https://script.google.com/macros/s/AKfycbxudcAmn6oSYIc1A7lTeF9Lvai8QYuXkqebhpcocTdfPrDMqIjLvn-BL773sli6OxQokg/exec";
  const surl = GAS_URL + "?redirect=success";
  const furl = GAS_URL + "?redirect=fail";

  const hashString =
    `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${wid}||||||||||${salt}`;

  function addField(form, name, value) {
    const inp = document.createElement("input");
    inp.type = "hidden";
    inp.name = name;
    inp.value = value;
    form.appendChild(inp);
  }

  const payuForm = document.createElement("form");
  payuForm.method = "POST";
  payuForm.action = "https://secure.payu.in/_payment";
  payuForm.id = "payuHiddenForm";

  addField(payuForm, "key", key);
  addField(payuForm, "txnid", txnid);
  addField(payuForm, "amount", amount);
  addField(payuForm, "productinfo", productinfo);
  addField(payuForm, "firstname", firstname);
  addField(payuForm, "email", email);
  addField(payuForm, "phone", phone);
  addField(payuForm, "udf1", wid);
  addField(payuForm, "service_provider", "payu_paisa");
  addField(payuForm, "surl", surl);
  addField(payuForm, "furl", furl);

  const hashInput = document.createElement("input");
  hashInput.type = "hidden";
  hashInput.name = "hash";
  hashInput.value = "";
  payuForm.appendChild(hashInput);

  document.body.appendChild(payuForm);

  let hash;
  try {
    hash = await sha512(hashString);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Proceed to Pay ₹500 →";
    document.body.removeChild(payuForm);
    document.body.innerHTML +=
      "<p style='color:red;text-align:center'>Browser error. Please open this page in Chrome and try again.</p>";
    return;
  }

  hashInput.value = hash;
  payuForm.submit();
});
