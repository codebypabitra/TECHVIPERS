// ============================================================
// TECH VIPERS TEAM HUB — Client Application Engine
// Strictly Real-Time Google Apps Script & Sheets Integration
// Zero Mock / Demo Data Fallback
// ============================================================

// Strictly single live Google Apps Script endpoint
var DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbzvtttIQ9DVNaaNjfeY5WXIMg1eULXssz_vONCuc0uqidzT8RppXscIca3ru6zpxY9w/exec";

// Strictly enforce the single Apps Script URL
var storedApiUrl = (localStorage.getItem("techvipers_api_url") || "").trim();
if (storedApiUrl !== DEFAULT_API_URL) {
  storedApiUrl = DEFAULT_API_URL;
  try { localStorage.setItem("techvipers_api_url", DEFAULT_API_URL); } catch (e) {}
}
var API_URL = DEFAULT_API_URL;

var session       = null;
var allEvents     = [];
var allMedia      = [];
var allMembers    = [];
var allAssets     = [];
var allTransactions = [];
var allExpensesList = [];
var txActiveFilter = "all";
var assetActiveFilter = "all";
var expActiveFilter = "all";
var currentReturnAssetId = null;
var currentSplitsExpenseID = null;
var currentPayData = null;
var txRegistry    = {};
var eventRegistry = {};
var assetRegistry = {};
var allExpensesMap = {};
var pendingPayeesMap = {};

// ── SWR Instant In-Memory & LocalStorage Cache Engine (0ms Responses) ──
var _cacheTimestamps = {};
var _activeFetches = {};

function getCachedData(key) {
  try {
    var raw = localStorage.getItem("tv_cache_" + key);
    return raw ? JSON.parse(raw) : null;
  } catch(e) {
    return null;
  }
}

function setCachedData(key, data) {
  try {
    localStorage.setItem("tv_cache_" + key, JSON.stringify(data));
    _cacheTimestamps[key] = Date.now();
  } catch(e) {}
}

function invalidateCache(key) {
  delete _cacheTimestamps[key];
}

function getSessionMemberPayload() {
  var id = (session && (session.memberID || session.id)) || "";
  var email = (session && session.email) || "";
  var name = (session && (session.fullName || session.name)) || "";
  var phone = (session && session.phone) || "";

  if (!id && allMembers && allMembers.length) {
    var found = allMembers.find(function(m) {
      return (email && m.email && m.email.toLowerCase() === email.toLowerCase()) ||
             (phone && m.phone && m.phone === phone);
    });
    if (found && found.memberID) {
      id = found.memberID;
      if (session) {
        session.memberID = id;
        try { localStorage.setItem("techvipers_session", JSON.stringify(session)); } catch(e) {}
      }
    }
  }

  return { memberID: id || "1", email: email, name: name, phone: phone };
}

// ── Impressive & Funny Robotic HUD Loader ──
var FUNNY_ROBOT_QUIPS = [
  "🐍 Feeding high-octane electricity to the Viper python...",
  "🤖 Tightening servo motor bolts and torquing combat gears...",
  "⚡ Bribing the RoboWar arena referee with 12V LiPo batteries...",
  "🔧 Calibrating PID balance loop to prevent bot faceplants...",
  "🔋 Supercharging ultracapacitors to maximum blast capacity...",
  "🛠️ Applying WD-40 and hoping the sparks don't catch fire...",
  "📡 Bypassing safety firewalls: 'Hold my soldering iron'...",
  "🦾 Teaching the robotic gripper to play rock-paper-scissors...",
  "🏎️ Overclocking drive motors... Please stand behind blast shield...",
  "📊 Streaming real-time telemetry from Google Cloud...",
  "🔩 Searching the lab floor for that one dropped M3 locknut...",
  "💥 Tuning pneumatic flipper valve for maximum launch height..."
];

var SECTION_FUNNY_QUIPS = {
  dashboard:    "⚡ Synchronizing HUD telemetry with Google Cloud...",
  expenses:     "💸 Splitting team bill with micron-level robotic precision...",
  transactions: "💳 Querying UPI payment hashes & checking pending split shares...",
  media:        "📸 Fetching high-res robot build photos from Google Drive...",
  events:       "🏆 Calculating tournament victory probability at 99.8%...",
  assets:       "🔧 Inspecting club torque wrenches, ESCs & LiPo firebags..."
};

var activeCloudRequests = 0;

function startCloudApiLoader() {
  activeCloudRequests++;
}

function stopCloudApiLoader() {
  activeCloudRequests = Math.max(0, activeCloudRequests - 1);
}

function getTechLoaderHtml(message) {
  var msg = message || "Loading...";
  return '<div class="tech-inline-loader">' +
    '<div class="tech-loader-gyro">' +
      '<div class="tech-ring-orbit spin-clockwise"></div>' +
      '<div class="tech-ring-orbit-middle spin-counter"></div>' +
      '<div class="tech-ring-orbit-inner spin-clockwise-slow"></div>' +
      '<div class="tech-core-hex">' +
        '<span class="tech-core-glow"></span>' +
        '<span class="tech-core-symbol">⚡</span>' +
      '</div>' +
    '</div>' +
    '<div class="tech-loader-meta">' +
      '<div class="tech-loader-headline">' + msg + '</div>' +
    '</div>' +
  '</div>';
}

function showLoader() {
  startCloudApiLoader();
}

function hideLoader() {
  stopCloudApiLoader();
  var loader = document.getElementById("pageLoader");
  if (loader) loader.classList.remove("active");
}

function triggerSectionLoader(sectionName) {
  var bar = document.getElementById("topRouteLoader");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "topRouteLoader";
    bar.className = "top-route-loader";
    document.body.appendChild(bar);
  }
  bar.classList.remove("active");
  void bar.offsetWidth;
  bar.classList.add("active");
  setTimeout(function() {
    if (bar) bar.classList.remove("active");
  }, 1200);
}

function toggleProfileDropdown(e) {
  if (e) {
    e.stopPropagation();
  }
  var menu = document.getElementById("profileDropdownMenu");
  if (!menu) return;
  menu.classList.toggle("open");
}

function closeProfileDropdown() {
  var menu = document.getElementById("profileDropdownMenu");
  if (menu) menu.classList.remove("open");
}

window.toggleProfileDropdown = toggleProfileDropdown;
window.closeProfileDropdown = closeProfileDropdown;
window.handleProfileBadgeClick = toggleProfileDropdown;

// Close dropdown when clicking anywhere outside
document.addEventListener("click", function(e) {
  var wrapper = document.getElementById("profileDropdownWrapper");
  if (wrapper && !wrapper.contains(e.target)) {
    closeProfileDropdown();
  }
});

// ── Theme Management ──
function initTheme() {
  var saved = localStorage.getItem("techvipers_theme") || "dark";
  setTheme(saved);
}
function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  var btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = t === "dark" ? "🌙" : "☀️";
  var mobThemeIcon = document.getElementById("mobThemeIcon");
  if (mobThemeIcon) mobThemeIcon.textContent = t === "dark" ? "🌙" : "☀️";
  localStorage.setItem("techvipers_theme", t);
}
function toggleTheme() {
  var c = document.documentElement.getAttribute("data-theme");
  setTheme(c === "dark" ? "light" : "dark");
}

// ── Dynamic Time-Based Greeting & Wish Message ──
function getTimeGreeting() {
  var hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return {
      greeting: "Good morning",
      icon: "🌅",
      tag: "🌅 MORNING LAB SPRINT",
      wish: "Robotics lab powered on and ready for battle! Review fresh team expenses, settle active split shares via UPI, and build unstoppable bots today. 🦾⚡"
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      greeting: "Good afternoon",
      icon: "☀️",
      tag: "☀️ AFTERNOON BUILD SESSION",
      wish: "Prototyping velocity at peak performance! Test chassis mechanics, backup arena media to Drive, and keep team component inventory verified. 🛠️🔥"
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      greeting: "Good evening",
      icon: "🌆",
      tag: "🌆 EVENING WRAP-UP",
      wish: "Combat arena test runs complete! Verify today's split clearance proofs, return borrowed workshop tools, and prep for upcoming robotics showdowns. 🏆✨"
    };
  } else {
    return {
      greeting: "Good night",
      icon: "🌙",
      tag: "🌙 NIGHT HACK SPRINT",
      wish: "High-torque late-night engineering in session! Calibrate servo drivers, track active club inventory, and clear pending split dues before powering down. ⚡🤖"
    };
  }
}

// ── Clean User Name Extraction (Never Email or Phone Number) ──
function getMemberDisplayName(user) {
  if (!user) return "Member";
  var name = (user.fullName || user["Full Name"] || user.name || "").trim();

  // If valid human name (not email address, not pure mobile phone number)
  if (name && !name.includes("@") && !/^\+?\d{7,15}$/.test(name)) {
    return name;
  }

  // Cross-reference with allMembers from Google Sheet
  if (allMembers && allMembers.length) {
    var match = allMembers.find(function(m) {
      return (user.memberID && String(m.memberID) === String(user.memberID)) ||
             (user.email && m.email && m.email.toLowerCase() === user.email.toLowerCase()) ||
             (user.phone && m.phone && m.phone === user.phone);
    });
    if (match) {
      var matchName = (match.fullName || "").trim();
      if (matchName && !matchName.includes("@") && !/^\+?\d{7,15}$/.test(matchName)) {
        return matchName;
      }
    }
  }

  if (name && !/^\d+$/.test(name)) {
    return name.split("@")[0];
  }

  return "Team Member";
}

function getInitials(name) {
  if (!name || name === "Member" || name === "Team Member") return "TV";
  var parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getMemberFirstName(sess) {
  var full = getMemberDisplayName(sess) || "Member";
  var first = full.trim().split(/\s+/)[0];
  return first || full;
}

function formatMemberID(rawId) {
  if (rawId === undefined || rawId === null || rawId === "") return "#1";
  var cleaned = String(rawId).trim().replace(/^#?MEM-?/i, "");
  return cleaned ? "#" + cleaned : "#1";
}

function matchMemberID(id1, id2) {
  if (id1 === undefined || id1 === null || id2 === undefined || id2 === null) return false;
  var s1 = String(id1).trim().toLowerCase();
  var s2 = String(id2).trim().toLowerCase();
  if (s1 === s2) return true;
  var c1 = s1.replace(/^[#\s]+/, "").replace(/^mem-?/i, "").replace(/^0+/, "");
  var c2 = s2.replace(/^[#\s]+/, "").replace(/^mem-?/i, "").replace(/^0+/, "");
  return c1 !== "" && c1 === c2;
}

function updateWelcomeGreeting() {
  var timeInfo = getTimeGreeting();
  var greetingEl = document.getElementById("welcomeGreeting");
  var tagEl      = document.getElementById("welcomeTimeTag");
  var subEl      = document.getElementById("welcomeSub");
  if (greetingEl) greetingEl.textContent = timeInfo.greeting;
  if (tagEl)      tagEl.textContent      = timeInfo.tag;
  if (subEl)      subEl.textContent      = timeInfo.wish;

  var nameEl = document.getElementById("dashName");
  if (nameEl && session) {
    nameEl.textContent = getMemberFirstName(session);
  }
}

// ── Mobile Menu Overlay ──
function toggleMobileNav() {
  var nav = document.getElementById("mobileMenuOverlay");
  var bd  = document.getElementById("mob-bd");
  var btn = document.getElementById("hamburgerBtn");
  if (!nav) return;
  var isOpen = nav.classList.toggle("open");
  if (bd) bd.classList.toggle("open", isOpen);
  if (btn) btn.classList.toggle("open", isOpen);
  if (isOpen) {
    updateWelcomeGreeting();
  }
}
function closeMobileNav() {
  var nav = document.getElementById("mobileMenuOverlay");
  var bd  = document.getElementById("mob-bd");
  var btn = document.getElementById("hamburgerBtn");
  if (nav) nav.classList.remove("open");
  if (bd) bd.classList.remove("open");
  if (btn) btn.classList.remove("open");
}

// ── Drive Helpers ──
function driveViewURL(fileID) {
  if (!fileID) return "";
  var id = String(fileID).trim();
  if (id.startsWith("data:") || id.startsWith("http")) return id;
  return id ? "https://drive.google.com/file/d/" + id + "/view" : "";
}
function driveThumbnailURL(fileID) {
  if (!fileID) return "";
  var id = String(fileID).trim();
  if (id.startsWith("data:") || id.startsWith("http")) return id;
  return id ? "https://drive.google.com/thumbnail?id=" + id + "&sz=w800" : "";
}
function driveDownloadURL(fileID) {
  if (!fileID) return "";
  var id = String(fileID).trim();
  if (id.startsWith("data:") || id.startsWith("http")) return id;
  return id ? "https://drive.google.com/uc?export=download&id=" + id : "";
}

// ── API Communication ──
async function api(payload) {
  var actionName = payload && payload.action;
  startCloudApiLoader(actionName);
  try {
    var currentUrl = (localStorage.getItem("techvipers_api_url") || API_URL || "").trim();
    if (!currentUrl) {
      return { success: false, message: "Please configure your Google Apps Script Web App URL in settings." };
    }

    var isGetAction = payload && typeof payload.action === "string" && (
      payload.action === "getTeamMembers" ||
      payload.action === "getExpenses" ||
      payload.action === "getExpenseSplits" ||
      payload.action === "getEvents" ||
      payload.action === "getTeamMedia" ||
      payload.action === "getClubAssets" ||
      payload.action === "getMyTransactions"
    );

    if (isGetAction) {
      try {
        var query = new URLSearchParams();
        query.set("action", payload.action);
        if (payload.expenseID) query.set("expenseID", payload.expenseID);
        if (payload.memberID) query.set("memberID", payload.memberID);
        if (payload.email) query.set("email", payload.email);
        if (payload.phone) query.set("phone", payload.phone);
        if (payload.name) query.set("name", payload.name);
        if (payload.data && typeof payload.data === "object") {
          query.set("data", JSON.stringify(payload.data));
        }
        var getUrl = currentUrl + (currentUrl.includes("?") ? "&" : "?") + query.toString();
        var res = await fetch(getUrl, { method: "GET", redirect: "follow" });
        var text = await res.text();
        return JSON.parse(text);
      } catch (getErr) {
        console.warn("Apps Script GET query failed, falling back to POST:", getErr);
      }
    }

    try {
      var res = await fetch(currentUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        redirect: "follow"
      });
      var text = await res.text();
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        var payloadStr = JSON.stringify(payload);
        if (payloadStr.length < 1800) {
          try {
            var fbUrl = currentUrl + (currentUrl.includes("?") ? "&" : "?") + "action=" + encodeURIComponent(payload.action || "") + "&data=" + encodeURIComponent(payloadStr);
            var fbRes = await fetch(fbUrl, { method: "GET", redirect: "follow" });
            var fbText = await fbRes.text();
            return JSON.parse(fbText);
          } catch (fbErr) {}
        }
        console.warn("Apps Script non-JSON response:", text);
        return { success: false, message: "Apps Script returned non-JSON. Please verify Web App deployment permissions are set to 'Anyone'." };
      }
    } catch (e) {
      console.error("Apps Script API fetch error:", e);
      return { success: false, message: "Could not connect to Google Apps Script. Please verify your connection or Web App URL." };
    }
  } finally {
    stopCloudApiLoader();
  }
}

// ── File Upload Helper ──
function uploadFileToAPI(file, category, label) {
  return new Promise(function(resolve, reject) {
    if (!file) {
      resolve({ success: false, message: "No file selected." });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      resolve({ success: false, message: "File exceeds 15MB limit. Please select a smaller file." });
      return;
    }
    var reader = new FileReader();
    reader.onload = async function() {
      try {
        var base64 = reader.result.split(",")[1];
        var result = await api({
          action: "uploadFile",
          data: {
            base64:   base64,
            mimeType: file.type || "application/octet-stream",
            fileName: file.name,
            category: category || "FILE",
            label:    label || ""
          }
        });
        if (!result.fileID) {
          result.fileID = reader.result;
          result.success = true;
        }
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = function() { reject(new Error("File reading failed")); };
    reader.readAsDataURL(file);
  });
}

function safeStr(val) {
  if (val === null || val === undefined) return "";
  return String(val);
}
function safeFloat(val) {
  var n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

// ── Human-Readable Date Formatter (Date-Only by default) ──
function formatDisplayDate(val, showTime) {
  if (!val) return "—";
  var s = String(val).trim();
  if (!s || s === "—" || s === "undefined" || s === "null") return "—";

  // Handle YYYY-MM-DD cleanly without timezone offset discrepancies
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    var dateParts = s.substring(0, 10).split("-");
    var monthsArr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var mIdx = parseInt(dateParts[1], 10) - 1;
    var dayFormatted = ("0" + parseInt(dateParts[2], 10)).slice(-2);
    var dateOnlyFormatted = dayFormatted + " " + (monthsArr[mIdx] || dateParts[1]) + " " + dateParts[0];

    if (showTime === true) {
      var dt = new Date(s);
      if (!isNaN(dt.getTime())) {
        var hrs = dt.getHours();
        var mins = ("0" + dt.getMinutes()).slice(-2);
        var am = hrs >= 12 ? "PM" : "AM";
        hrs = hrs % 12 || 12;
        return dateOnlyFormatted + ", " + ("0" + hrs).slice(-2) + ":" + mins + " " + am;
      }
    }
    return dateOnlyFormatted;
  }

  var d = new Date(s);
  if (!isNaN(d.getTime())) {
    var day = ("0" + d.getDate()).slice(-2);
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var month = months[d.getMonth()];
    var year = d.getFullYear();

    if (showTime === true) {
      var hours = d.getHours();
      var minutes = ("0" + d.getMinutes()).slice(-2);
      var ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      var hoursStr = ("0" + hours).slice(-2);
      return day + " " + month + " " + year + ", " + hoursStr + ":" + minutes + " " + ampm;
    }
    return day + " " + month + " " + year;
  }

  return s;
}

// ── Toast Notifications ──
function toast(msg, type) {
  type = type || "info";
  var el = document.createElement("div");
  el.className = "toast " + type;
  var icon = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
  el.innerHTML = "<span>" + icon + "</span><span>" + msg + "</span>";
  var container = document.getElementById("toastContainer");
  if (container) container.appendChild(el);
  setTimeout(function() { el.remove(); }, 4000);
}

// ── Modals & Lightbox ──
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

function openLightbox(src, caption) {
  var modal = document.getElementById("lightboxModal");
  var img = document.getElementById("lightboxImg");
  var cap = document.getElementById("lightboxCaption");
  img.src = src;
  cap.textContent = caption || "";
  modal.classList.add("open");
}
function closeLightbox(e) {
  if (e.target.id === "lightboxModal") {
    closeModal("lightboxModal");
  }
}

// ── Auth Handling ──
function switchAuthTab(tab) {
  var isLogin = tab === "login";
  var isReg = tab === "register";
  var isForgot = tab === "forgot";

  var tabLogin = document.getElementById("tab-login");
  var tabReg = document.getElementById("tab-register");
  if (tabLogin) tabLogin.classList.toggle("active", isLogin);
  if (tabReg) tabReg.classList.toggle("active", isReg);

  var loginForm = document.getElementById("loginForm");
  var regForm = document.getElementById("registerForm");
  var forgotForm = document.getElementById("forgotForm");

  if (loginForm) loginForm.style.display = isLogin ? "block" : "none";
  if (regForm) regForm.style.display = isReg ? "block" : "none";
  if (forgotForm) forgotForm.style.display = isForgot ? "block" : "none";

  if (isForgot) {
    var step1 = document.getElementById("forgotStep1");
    var step2 = document.getElementById("forgotStep2");
    if (step1) step1.style.display = "block";
    if (step2) step2.style.display = "none";
    var forgotId = document.getElementById("forgotIdentifier");
    var loginId = document.getElementById("loginIdentifier");
    if (forgotId && loginId && loginId.value) {
      forgotId.value = loginId.value.trim();
    }
  }
}

var pendingResetIdentifier = "";

async function sendResetOTP() {
  var idInp = document.getElementById("forgotIdentifier");
  var val = idInp ? idInp.value.trim() : "";
  if (!val) {
    toast("Please enter your Email, Phone, or Member ID.", "error");
    if (idInp) idInp.focus();
    return;
  }

  var btn = document.getElementById("sendOtpBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Sending OTP...';
  }

  try {
    var res = await api({
      action: "forgotPasswordSendOTP",
      data: { identifier: val, rawIdentifier: val }
    });

    if (res && res.success) {
      pendingResetIdentifier = val;
      toast(res.message || "OTP sent successfully to your registered email!", "success");
      var step1 = document.getElementById("forgotStep1");
      var step2 = document.getElementById("forgotStep2");
      var maskedEl = document.getElementById("forgotMaskedEmail");
      if (step1) step1.style.display = "none";
      if (step2) step2.style.display = "block";
      if (maskedEl && res.maskedEmail) maskedEl.textContent = res.maskedEmail;
      var otpInp = document.getElementById("forgotOtp");
      if (otpInp) {
        otpInp.value = "";
        otpInp.focus();
      }
    } else {
      toast((res && res.message) || "Could not find member account matching this identifier.", "error");
    }
  } catch (err) {
    toast("Error sending OTP: " + err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "SEND VERIFICATION OTP";
    }
  }
}

async function submitPasswordReset() {
  var otpInp = document.getElementById("forgotOtp");
  var newPwInp = document.getElementById("forgotNewPassword");
  var confPwInp = document.getElementById("forgotConfirmPassword");

  var otp = otpInp ? otpInp.value.trim() : "";
  var newPw = newPwInp ? newPwInp.value : "";
  var confPw = confPwInp ? confPwInp.value : "";

  if (!otp || otp.length < 6) {
    toast("Please enter the complete 6-digit OTP sent to your email.", "error");
    if (otpInp) otpInp.focus();
    return;
  }

  if (!newPw || newPw.length < 6) {
    toast("New password must be at least 6 characters long.", "error");
    if (newPwInp) newPwInp.focus();
    return;
  }

  if (newPw !== confPw) {
    toast("Passwords do not match. Please re-enter carefully.", "error");
    if (confPwInp) confPwInp.focus();
    return;
  }

  var identifier = pendingResetIdentifier || (document.getElementById("forgotIdentifier") ? document.getElementById("forgotIdentifier").value.trim() : "");
  if (!identifier) {
    toast("Identifier missing. Please re-enter your Email/Phone/ID.", "error");
    switchAuthTab("forgot");
    return;
  }

  var btn = document.getElementById("resetPasswordBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Updating Password...';
  }

  try {
    var res = await api({
      action: "forgotPasswordVerifyAndReset",
      data: {
        identifier: identifier,
        rawIdentifier: identifier,
        otp: otp,
        newPassword: newPw
      }
    });

    if (res && res.success) {
      toast(res.message || "Password updated successfully! Please log in.", "success");
      switchAuthTab("login");
      var loginId = document.getElementById("loginIdentifier");
      var loginPw = document.getElementById("loginPassword");
      if (loginId) loginId.value = identifier;
      if (loginPw) {
        loginPw.value = newPw;
        loginPw.focus();
      }
      clearForm(["forgotOtp", "forgotNewPassword", "forgotConfirmPassword", "forgotIdentifier"]);
    } else {
      toast((res && res.message) || "Password reset failed. Please check OTP.", "error");
    }
  } catch (err) {
    toast("Error resetting password: " + err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "RESET PASSWORD & LOG IN";
    }
  }
}

function togglePwVisibility(id, el) {
  var inp = document.getElementById(id);
  if (!inp) return;
  if (inp.type === "password") {
    inp.type = "text";
    el.textContent = "🙈";
  } else {
    inp.type = "password";
    el.textContent = "👁";
  }
}

function checkRegPwStrength(pw) {
  var sc = 0;
  if (pw.length >= 8) sc++;
  if (/[A-Z]/.test(pw)) sc++;
  if (/[0-9]/.test(pw)) sc++;
  if (/[^A-Za-z0-9]/.test(pw)) sc++;
  var colors = ["", "var(--cr)", "var(--cr)", "var(--gd)", "var(--green)"];
  for (var i = 1; i <= 4; i++) {
    var seg = document.getElementById("pw-seg-" + i);
    if (seg) {
      seg.style.background = i <= sc ? colors[sc] : "var(--line);";
    }
  }
}

async function doLogin() {
  var id = document.getElementById("loginIdentifier").value.trim();
  var pass = document.getElementById("loginPassword").value;
  if (!id || !pass) { toast("Please enter your email, phone, or Member ID, and password.", "error"); return; }

  var btn = document.getElementById("loginBtn");
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Authenticating...';

  try {
    var identifierToTry = id;

    if (!id.includes("@")) {
      try {
        var memRes = await api({ action: "getTeamMembers" });
        if (memRes && memRes.success && Array.isArray(memRes.data)) {
          allMembers = memRes.data;
          var cleanInput = id.toLowerCase().replace(/^[#\s]+/, "").trim();
          var stripInput = cleanInput.replace(/^mem-?/i, "");

          var found = allMembers.find(function(m) {
            var mId = String(m.memberID || "").toLowerCase().trim();
            var cleanMId = mId.replace(/^[#\s]+/, "").trim();
            var stripMId = cleanMId.replace(/^mem-?/i, "");
            return mId === cleanInput ||
                   cleanMId === cleanInput ||
                   (stripMId !== "" && (stripMId === stripInput || stripMId === cleanInput)) ||
                   ("mem-" + stripMId) === cleanInput ||
                   ("mem" + stripMId) === cleanInput;
          });

          if (found && (found.email || found.phone)) {
            identifierToTry = found.email || found.phone;
          }
        }
      } catch (lookupErr) {
        console.warn("Member ID pre-lookup note:", lookupErr);
      }
    }

    var res = await api({ action: "login", data: { identifier: identifierToTry, rawIdentifier: id, password: pass } });

    if (!res.success && identifierToTry !== id) {
      try {
        res = await api({ action: "login", data: { identifier: id, rawIdentifier: id, password: pass } });
      } catch (fbErr) {}
    }

    if (res.success && res.member) {
      session = res.member;

      var rawName = (session.fullName || session["Full Name"] || "").trim();
      if (!rawName || rawName.includes("@") || /^\+?\d{7,15}$/.test(rawName)) {
        session.fullName = rawName && !/^\d+$/.test(rawName) ? rawName.split("@")[0] : "Team Member";
      }

      localStorage.setItem("techvipers_session", JSON.stringify(session));

      var toastName = getMemberDisplayName(session);
      toast("Welcome back, " + toastName + "! 👋", "success");

      showApp();
    } else {
      toast(res.message || "Login failed. Incorrect credentials or Member ID.", "error");
    }
  } catch (e) {
    toast("Connection error: " + e.message, "error");
  }
  btn.disabled = false;
  btn.textContent = "LOG IN";
}

async function doRegister() {
  var d = {
    fullName:  document.getElementById("regName").value.trim(),
    email:     document.getElementById("regEmail").value.trim(),
    phone:     document.getElementById("regPhone").value.trim(),
    password:  document.getElementById("regPassword").value,
    upiHandle: document.getElementById("regUPI").value.trim()
  };
  if (!d.fullName || !d.email || !d.phone || !d.password || !d.upiHandle) {
    toast("All fields are required.", "error"); return;
  }

  var btn = document.getElementById("registerBtn");
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Registering...';

  try {
    var res = await api({ action: "register", data: d });
    if (res.success) {
      toast(res.message || "Account created successfully! You can now log in.", "success");
      switchAuthTab("login");
      document.getElementById("loginIdentifier").value = d.email;
      clearForm(["regName","regEmail","regPhone","regPassword","regUPI"]);
    } else {
      toast(res.message || "Registration failed.", "error");
    }
  } catch (e) {
    toast("Connection error: " + e.message, "error");
  }
  btn.disabled = false;
  btn.textContent = "CREATE ACCOUNT";
}

function doLogout() {
  localStorage.removeItem("techvipers_session");
  localStorage.removeItem("tv_cache_transactions");
  session = null;
  allTransactions = [];
  document.getElementById("app").style.display = "none";
  document.getElementById("authScreen").style.display = "flex";
}

function showApp() {
  if (!session) return;
  document.getElementById("authScreen").style.display = "none";
  document.getElementById("app").style.display = "block";

  var displayName = getMemberDisplayName(session);

  var topName = document.getElementById("topbarName");
  if (topName) topName.textContent = displayName;
  var topAvatar = document.getElementById("topbarAvatar");
  if (topAvatar) topAvatar.textContent = getInitials(displayName);
  var dashName = document.getElementById("dashName");
  if (dashName) dashName.textContent = getMemberFirstName(session);

  var mobName = document.getElementById("mobUserName");
  if (mobName) mobName.textContent = displayName;
  var mobID = document.getElementById("mobUserID");
  if (mobID) mobID.textContent = "ID: " + formatMemberID(session.memberID);
  var mobAvatar = document.getElementById("mobUserAvatar");
  if (mobAvatar) mobAvatar.textContent = getInitials(displayName);

  var sbName = document.getElementById("sidebarUserName");
  if (sbName) sbName.textContent = displayName;
  var sbID = document.getElementById("sidebarMemberID");
  if (sbID) sbID.textContent = "ID: " + formatMemberID(session.memberID);
  var sbAvatar = document.getElementById("sidebarAvatar");
  if (sbAvatar) sbAvatar.textContent = getInitials(displayName);

  var ddName = document.getElementById("dropdownUserName");
  if (ddName) ddName.textContent = displayName;
  var ddID = document.getElementById("dropdownMemberID");
  if (ddID) ddID.textContent = "ID: " + formatMemberID(session.memberID);
  var ddAvatar = document.getElementById("dropdownAvatar");
  if (ddAvatar) ddAvatar.textContent = getInitials(displayName);

  var apiInput = document.getElementById("apiUrlInput");
  if (apiInput) apiInput.value = localStorage.getItem("techvipers_api_url") || API_URL || "";

  updateWelcomeGreeting();
  initMediaLayout();
  loadDashboardStats();
  loadTeamMembersList();
}

// ── Navigation ──
function showSection(name) {
  triggerSectionLoader(name);

  document.querySelectorAll(".section").forEach(function(s) {
    s.classList.remove("active");
  });
  document.querySelectorAll(".nav-item").forEach(function(n) {
    n.classList.remove("active");
  });
  document.querySelectorAll(".mob-nav-card").forEach(function(n) {
    n.classList.remove("active");
  });

  var targetSec = document.getElementById("section-" + name);
  if (targetSec) {
    targetSec.classList.remove("active");
    void targetSec.offsetWidth;
    targetSec.classList.add("active");
  }

  var dNav = document.getElementById("nav-" + name);
  var mNav = document.getElementById("mnav-" + name);
  if (dNav) dNav.classList.add("active");
  if (mNav) mNav.classList.add("active");

  updateWelcomeGreeting();
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Live Google Apps Script data sync on every page change
  if (name === "dashboard") {
    _activeFetches["dashboard"] = false;
    loadDashboardStats(true);
  } else if (name === "expenses") {
    _activeFetches["expenses"] = false;
    loadExpenses(true);
  } else if (name === "transactions") {
    _activeFetches["transactions"] = false;
    loadTransactions(true);
  } else if (name === "media") {
    _activeFetches["media"] = false;
    loadMedia(true);
  } else if (name === "events") {
    _activeFetches["events"] = false;
    loadEvents(true);
  } else if (name === "assets") {
    _activeFetches["assets"] = false;
    loadAssets(true);
  }
}

// ── Smooth Counter Animation (0 -> target number) ──
function animateCount(element, targetVal, isCurrency, duration) {
  if (!element) return;
  var target = typeof targetVal === "number" ? targetVal : parseFloat(targetVal) || 0;
  
  var prevAttr = element.getAttribute("data-anim-val");
  var startVal = prevAttr !== null ? (parseFloat(prevAttr) || 0) : 0;
  
  if (element._animTimer) {
    cancelAnimationFrame(element._animTimer);
  }

  if (prevAttr !== null && Math.abs(startVal - target) < 0.001) {
    if (isCurrency) {
      element.textContent = "₹ " + target.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      element.textContent = Math.round(target).toLocaleString("en-IN");
    }
    return;
  }

  var animDuration = duration || 850;
  var startTime = null;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var elapsed = timestamp - startTime;
    var progress = Math.min(elapsed / animDuration, 1);
    // Smooth ease-out cubic curve
    var ease = 1 - Math.pow(1 - progress, 3);
    var current = startVal + (target - startVal) * ease;

    if (isCurrency) {
      element.textContent = "₹ " + current.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      element.textContent = Math.round(current).toLocaleString("en-IN");
    }

    if (progress < 1) {
      element._animTimer = requestAnimationFrame(step);
    } else {
      element.setAttribute("data-anim-val", String(target));
      if (isCurrency) {
        element.textContent = "₹ " + target.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        element.textContent = Math.round(target).toLocaleString("en-IN");
      }
    }
  }

  element._animTimer = requestAnimationFrame(step);
}

// ── Dashboard Stats ──
function updateDashboardUI(expensesList, transactionsList, mediaList, assetsList) {
  var exp = Array.isArray(expensesList) ? expensesList : (allExpensesList && allExpensesList.length ? allExpensesList : getCachedData("expenses") || []);
  var tx  = Array.isArray(transactionsList) ? transactionsList : (allTransactions && allTransactions.length ? allTransactions : getCachedData("transactions") || []);
  var med = Array.isArray(mediaList) ? mediaList : (allMedia && allMedia.length ? allMedia : getCachedData("media") || []);
  var ast = Array.isArray(assetsList) ? assetsList : (allAssets && allAssets.length ? allAssets : getCachedData("assets") || []);

  if (Array.isArray(exp) && exp.length > 0) {
    var totalExpensesAmount = exp.reduce(function(acc, e) {
      return acc + safeFloat(e["Total Amount"] || e.totalAmount || 0);
    }, 0);
    animateCount(document.getElementById("statExpensesAmount"), totalExpensesAmount, true);
    animateCount(document.getElementById("statExpensesCount"), exp.length, false);
  } else {
    animateCount(document.getElementById("statExpensesAmount"), 0, true);
    animateCount(document.getElementById("statExpensesCount"), 0, false);
  }

  if (Array.isArray(tx)) {
    var myPendingAmount = 0;
    var myPendingCount = 0;
    var myPaidAmount = 0;

    tx.forEach(function(t) {
      var share = safeFloat(t["Share Amount"] || t.shareAmount || t.share || 0);
      var status = safeStr(t["Payment Status"] || t.paymentStatus || "").toLowerCase().trim();
      var isPending = status === "pending" || status === "due" || status === "unpaid" || (!status && share > 0);
      if (isPending) {
        myPendingAmount += share;
        myPendingCount++;
      } else if (status === "paid" || status === "cleared" || status === "settled") {
        myPaidAmount += share;
      }
    });

    animateCount(document.getElementById("statPendingAmount"), myPendingAmount, true);
    animateCount(document.getElementById("statPendingCount"), myPendingCount, false);
    animateCount(document.getElementById("statPaidAmount"), myPaidAmount, true);

    var noticeCard = document.getElementById("dueNoticeCard");
    if (noticeCard) {
      noticeCard.style.display = myPendingCount > 0 ? "block" : "none";
    }
  }

  if (Array.isArray(med)) {
    animateCount(document.getElementById("statMedia"), med.length, false);
  }
  if (Array.isArray(ast)) {
    animateCount(document.getElementById("statAssets"), ast.length, false);
  }
}

async function loadDashboardStats(force) {
  updateDashboardUI();

  var now = Date.now();
  if (!force && _cacheTimestamps["dashboard"] && (now - _cacheTimestamps["dashboard"] < 45000)) {
    return;
  }

  var mem = getSessionMemberPayload();

  try {
    var results = await Promise.allSettled([
      api({ action: "getExpenses" }),
      api({
        action: "getMyTransactions",
        memberID: mem.memberID,
        email:    mem.email,
        name:     mem.name,
        phone:    mem.phone
      }),
      api({ action: "getTeamMedia" }),
      api({ action: "getClubAssets" })
    ]);

    var expRes = results[0].status === "fulfilled" ? results[0].value : null;
    var txRes  = results[1].status === "fulfilled" ? results[1].value : null;
    var medRes = results[2].status === "fulfilled" ? results[2].value : null;
    var astRes = results[3].status === "fulfilled" ? results[3].value : null;

    if (expRes && expRes.success && Array.isArray(expRes.data)) {
      allExpensesList = expRes.data;
      setCachedData("expenses", allExpensesList);
    }

    if (txRes && txRes.success && Array.isArray(txRes.data)) {
      allTransactions = txRes.data;
      setCachedData("transactions", allTransactions);
    }

    if (medRes && medRes.success && Array.isArray(medRes.data)) {
      allMedia = medRes.data;
      setCachedData("media", allMedia);
    }

    if (astRes && astRes.success && Array.isArray(astRes.data)) {
      allAssets = astRes.data;
      setCachedData("assets", allAssets);
    }

    _cacheTimestamps["dashboard"] = Date.now();

    updateDashboardUI();
  } catch (e) {
    console.warn("loadDashboardStats sync note:", e);
  }
}

// ============================================================
// EXPENSES & SPLITS
// ============================================================
function calcExpenseTotal() {
  var q = parseFloat(document.getElementById("expQty").value) || 0;
  var p = parseFloat(document.getElementById("expPrice").value) || 0;
  document.getElementById("expTotal").textContent = "₹ " + (q * p).toFixed(2);
}

function filterExpenses(tab) {
  expActiveFilter = tab || "all";
  ["all", "pending", "settled"].forEach(function(t) {
    var btn = document.getElementById("tab-exp-" + t);
    if (btn) btn.classList.toggle("active", t === expActiveFilter);
  });
  renderExpensesList();
}

function renderExpensesList() {
  var tbody = document.getElementById("expensesTable");
  var mobileBox = document.getElementById("expensesCardsMobile");
  if (!tbody || !mobileBox) return;

  var totalCount = allExpensesList.length;
  var pendingCount = 0;
  var settledCount = 0;

  allExpensesList.forEach(function(e) {
    var totalSplits = e.totalSplits || 0;
    var paidSplits  = e.paidSplits || 0;
    if (totalSplits > 0 && paidSplits === totalSplits) {
      settledCount++;
    } else {
      pendingCount++;
    }
  });

  var elCntAll = document.getElementById("expCountAll");
  var elCntPending = document.getElementById("expCountPending");
  var elCntSettled = document.getElementById("expCountSettled");
  if (elCntAll) elCntAll.textContent = totalCount;
  if (elCntPending) elCntPending.textContent = pendingCount;
  if (elCntSettled) elCntSettled.textContent = settledCount;

  var filtered = allExpensesList.filter(function(e) {
    var totalSplits = e.totalSplits || 0;
    var paidSplits  = e.paidSplits || 0;
    var isSettled = (totalSplits > 0 && paidSplits === totalSplits);
    if (expActiveFilter === "pending") return !isSettled;
    if (expActiveFilter === "settled") return isSettled;
    return true;
  });

  if (!filtered.length) {
    var emptyMsg = expActiveFilter === "pending" ? "No pending splits! All expenses are settled. 🎉" :
                   expActiveFilter === "settled" ? "No settled expenses yet." :
                   "No expenses recorded yet in Google Sheet.";
    var emptyHtml = '<div class="empty-state"><div class="empty-icon">💸</div><div class="empty-text">' + emptyMsg + '</div></div>';
    tbody.innerHTML = '<tr class="loading-row"><td colspan="10">' + emptyHtml + '</td></tr>';
    mobileBox.innerHTML = emptyHtml;
    return;
  }

  tbody.innerHTML = filtered.map(function(e) {
    var expID = safeStr(e["Expense ID"]);
    var billFileID = safeStr(e["Bill File ID"]);
    var billCell = billFileID ? '<a href="' + driveViewURL(billFileID) + '" target="_blank" class="btn btn-sm btn-secondary">View Bill</a>' : '—';

    var totalSplits = e.totalSplits || 0;
    var paidSplits  = e.paidSplits || 0;
    var splitBadge = totalSplits > 0
      ? '<button class="btn btn-sm btn-secondary" style="padding:4px 9px;" onclick="openSplitsModal(\'' + expID + '\',\'' + encodeURIComponent(e["Item Name"]) + '\')" title="Click to view split details"><span class="badge ' + (paidSplits === totalSplits ? 'badge-green' : 'badge-yellow') + '">' + paidSplits + '/' + totalSplits + ' Paid</span> 👥</button>'
      : '<span class="badge badge-gray">—</span>';

    return '<tr>' +
      '<td><span style="font-family:var(--mono);color:var(--cr);font-weight:700;">#' + expID + '</span></td>' +
      '<td style="font-family:var(--mono);font-size:12px;">' + formatDisplayDate(e["Date of Purchase"]) + '</td>' +
      '<td style="font-weight:600;">' + safeStr(e["Item Name"]) + '</td>' +
      '<td>' + safeStr(e["Quantity"]) + '</td>' +
      '<td>₹' + safeFloat(e["Unit Price"]).toFixed(2) + '</td>' +
      '<td style="color:var(--green);font-weight:700;">₹' + safeFloat(e["Total Amount"]).toFixed(2) + '</td>' +
      '<td>' + safeStr(e["Vendor Name"] || "—") + '</td>' +
      '<td>' + splitBadge + '</td>' +
      '<td>' + billCell + '</td>' +
      '<td style="font-size:12px;">' + safeStr(e.submitterName || "Member") + '</td>' +
      '</tr>';
  }).join("");

  mobileBox.innerHTML = filtered.map(function(e) {
    var expID = safeStr(e["Expense ID"]);
    var billFileID = safeStr(e["Bill File ID"]);
    var totalSplits = e.totalSplits || 0;
    var paidSplits  = e.paidSplits || 0;

    return '<div class="res-card">' +
      '<div class="res-card-header">' +
        '<div>' +
          '<div class="res-card-id">EXP #' + expID + '</div>' +
          '<div class="res-card-title">' + safeStr(e["Item Name"]) + '</div>' +
        '</div>' +
        '<div class="res-card-amount">₹ ' + safeFloat(e["Total Amount"]).toFixed(2) + '</div>' +
      '</div>' +
      '<div class="res-card-grid">' +
        '<div class="res-info-block"><span class="res-info-label">DATE</span><span class="res-info-value">' + formatDisplayDate(e["Date of Purchase"]) + '</span></div>' +
        '<div class="res-info-block"><span class="res-info-label">VENDOR</span><span class="res-info-value">' + safeStr(e["Vendor Name"] || "—") + '</span></div>' +
        '<div class="res-info-block"><span class="res-info-label">QTY × UNIT</span><span class="res-info-value">' + safeStr(e["Quantity"]) + ' × ₹' + safeFloat(e["Unit Price"]).toFixed(2) + '</span></div>' +
        '<div class="res-info-block"><span class="res-info-label">PAID BY</span><span class="res-info-value">' + safeStr(e.submitterName || "Member") + '</span></div>' +
      '</div>' +
      '<div class="res-card-footer">' +
        '<button class="btn btn-sm btn-secondary" onclick="openSplitsModal(\'' + expID + '\',\'' + encodeURIComponent(e["Item Name"]) + '\')">' +
          '<span class="badge ' + (paidSplits === totalSplits && totalSplits > 0 ? 'badge-green' : 'badge-yellow') + '">' + paidSplits + '/' + totalSplits + ' Paid</span> <span>Splits 👥</span>' +
        '</button>' +
        (billFileID ? '<a href="' + driveViewURL(billFileID) + '" target="_blank" class="btn btn-sm btn-primary">📄 Bill</a>' : '<span style="font-size:11px;color:var(--muted);">No Bill</span>') +
      '</div>' +
    '</div>';
  }).join("");
}

async function loadExpenses(force) {
  var tbody = document.getElementById("expensesTable");
  var mobileBox = document.getElementById("expensesCardsMobile");

  if (allExpensesList && allExpensesList.length > 0) {
    renderExpensesList();
  } else {
    var cached = getCachedData("expenses");
    if (cached && cached.length > 0) {
      allExpensesList = cached;
      allExpensesMap = {};
      cached.forEach(function(e) { allExpensesMap[e["Expense ID"]] = e; });
      renderExpensesList();
      updateDashboardUI();
    } else {
      tbody.innerHTML = '<tr class="loading-row"><td colspan="10">' + getTechLoaderHtml("Streaming team robotics expense splits...") + '</td></tr>';
      mobileBox.innerHTML = '<div style="text-align:center;padding:24px;">' + getTechLoaderHtml("Streaming team robotics expense splits...") + '</div>';
    }
  }

  if (_activeFetches["expenses"]) return;
  var now = Date.now();
  if (!force && _cacheTimestamps["expenses"] && (now - _cacheTimestamps["expenses"] < 45000)) {
    return;
  }

  _activeFetches["expenses"] = true;
  try {
    var res = await api({ action: "getExpenses" });
    if (res && res.success && Array.isArray(res.data)) {
      allExpensesList = res.data;
      allExpensesMap = {};
      res.data.forEach(function(e) { allExpensesMap[e["Expense ID"]] = e; });
      setCachedData("expenses", allExpensesList);
      _cacheTimestamps["expenses"] = Date.now();
      renderExpensesList();
      updateDashboardUI();
    } else if (!allExpensesList.length) {
      allExpensesList = [];
      allExpensesMap = {};
      var emptyHtml = '<div class="empty-state"><div class="empty-icon">💸</div><div class="empty-text">No expenses recorded yet in Google Sheet.</div></div>';
      tbody.innerHTML = '<tr class="loading-row"><td colspan="10">' + emptyHtml + '</td></tr>';
      mobileBox.innerHTML = emptyHtml;
      var elCntAll = document.getElementById("expCountAll");
      var elCntPending = document.getElementById("expCountPending");
      var elCntSettled = document.getElementById("expCountSettled");
      if (elCntAll) elCntAll.textContent = "0";
      if (elCntPending) elCntPending.textContent = "0";
      if (elCntSettled) elCntSettled.textContent = "0";
    }
  } catch (e) {
    console.warn("loadExpenses error:", e);
  } finally {
    _activeFetches["expenses"] = false;
  }
}

async function submitExpense() {
  var item = document.getElementById("expItem").value.trim();
  var qty = document.getElementById("expQty").value;
  var price = document.getElementById("expPrice").value;
  if (!item || !qty || !price) { toast("Item, Quantity, and Price are required.", "error"); return; }

  var btn = document.getElementById("addExpenseBtn");
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Submitting & Splitting...';

  var billFileID = "";
  var billFile = document.getElementById("expBill").files[0];
  if (billFile) {
    try {
      var up = await uploadFileToAPI(billFile, "BILL", item);
      if (up.success) billFileID = up.fileID;
    } catch(e) {
      console.warn("Bill upload note:", e);
    }
  }

  var sendEmails = document.getElementById("expSendEmailAlert").checked;

  try {
    var res = await api({
      action: "addExpense",
      data: {
        itemName: item,
        quantity: qty,
        unitPrice: price,
        vendorName: document.getElementById("expVendor").value.trim(),
        isPurchased: document.getElementById("expPurchased").value,
        billFileID: billFileID,
        submittedBy: session.memberID,
        sendDueEmails: sendEmails
      }
    });

    if (res.success) {
      toast(res.message || "Expense added & split among team members!", "success");
      closeModal("addExpenseModal");
      clearForm(["expItem","expVendor","expPrice","expBill"]);
      document.getElementById("expQty").value = "1";
      document.getElementById("expTotal").textContent = "₹ 0.00";
      loadExpenses();
      loadDashboardStats();
    } else {
      toast(res.message || "Failed to record expense.", "error");
    }
  } catch (e) {
    toast("Submission error: " + e.message, "error");
  }

  btn.disabled = false;
  btn.textContent = "Submit Expense & Auto-Split";
}

async function openSplitsModal(expenseID, itemNameEnc) {
  currentSplitsExpenseID = expenseID;
  var itemName = decodeURIComponent(itemNameEnc || "");
  document.getElementById("splitsModalTitle").textContent = "Split Details: " + (itemName || "#" + expenseID);
  var tbody = document.getElementById("splitsTableBody");
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:16px;">' + getTechLoaderHtml("Loading member shares and payment proof status...") + '</td></tr>';
  openModal("splitsModal");

  try {
    var res = await api({ action: "getExpenseSplits", expenseID: expenseID });
    if (!res.success || !Array.isArray(res.data) || !res.data.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--ink3);">No split records found for this expense.</td></tr>';
      return;
    }

    var hasUnpaid = false;
    tbody.innerHTML = res.data.map(function(s) {
      var isPaid = safeStr(s.paymentStatus).toLowerCase() === "paid";
      if (!isPaid) hasUnpaid = true;
      var statusBadge = isPaid
        ? '<span class="badge badge-green">Paid</span>'
        : '<span class="badge badge-red">Pending</span>';

      var proofLink = s.proofFileID
        ? '<a href="' + driveViewURL(s.proofFileID) + '" target="_blank" class="btn btn-sm btn-secondary">View Proof</a>'
        : (s.utrNumber ? '<span style="font-family:var(--mono);font-size:11px;">' + s.utrNumber + '</span>' : '—');

      var isMe = session && (matchMemberID(s.memberID, session.memberID) || String(s.memberID) === String(session.memberID));
      var actionCell = "—";
      if (!isPaid) {
        if (isMe) {
          actionCell = '<button class="btn btn-sm btn-primary shimmer-btn" onclick="closeModal(\'splitsModal\');openPayModal(\'' + s.expenseID + '\')">Pay My Share 💳</button>';
        } else {
          actionCell = '<button class="btn btn-sm btn-yellow" onclick="sendSingleReminder(\'' + s.memberID + '\',\'' + s.expenseID + '\')">✉️ Remind</button>';
        }
      }

      return '<tr>' +
        '<td style="font-weight:600;">' + safeStr(s.memberName) + '</td>' +
        '<td style="color:var(--green);font-weight:700;">₹' + safeFloat(s.shareAmount).toFixed(2) + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td style="font-family:var(--mono);font-size:11px;">' + formatDisplayDate(s.paymentDate) + '</td>' +
        '<td>' + proofLink + '</td>' +
        '<td style="font-family:var(--mono);font-size:11px;">' + safeStr(s.utrNumber || "—") + '</td>' +
        '<td>' + actionCell + '</td>' +
        '</tr>';
    }).join("");

    var remindAllBtn = document.getElementById("remindAllBtn");
    if (remindAllBtn) remindAllBtn.style.display = hasUnpaid ? "inline-flex" : "none";

  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--cr);">Error loading splits: ' + e.message + '</td></tr>';
  }
}

async function sendSingleReminder(memberID, expenseID) {
  toast("Dispatching reminder email...", "info");
  try {
    var res = await api({
      action: "sendDueReminder",
      data: { memberID: memberID, expenseID: expenseID }
    });
    if (res.success) {
      toast(res.message || "Due reminder email sent!", "success");
    } else {
      toast(res.message || "Failed to send reminder.", "error");
    }
  } catch (e) {
    toast("Reminder error: " + e.message, "error");
  }
}

async function sendAllDueRemindersNow() {
  if (!currentSplitsExpenseID) return;
  toast("Sending due reminders to all unpaid members...", "info");
  try {
    var res = await api({
      action: "sendAllDueReminders",
      data: { expenseID: currentSplitsExpenseID }
    });
    if (res.success) {
      toast(res.message || "All unpaid members notified via email!", "success");
    } else {
      toast(res.message || "Failed to dispatch reminders.", "error");
    }
  } catch (e) {
    toast("Remind all error: " + e.message, "error");
  }
}

// ============================================================
// MY TRANSACTIONS & DUES
// ============================================================
function filterTransactions(tab) {
  txActiveFilter = tab || "all";
  ["all", "due", "paid"].forEach(function(t) {
    var btn = document.getElementById("tab-tx-" + t);
    if (btn) btn.classList.toggle("active", t === txActiveFilter);
  });
  renderTransactionsList();
}

function renderTransactionsList() {
  var tbody = document.getElementById("transactionsTable");
  var mobileBox = document.getElementById("transactionsCardsMobile");
  if (!tbody || !mobileBox) return;

  var totalCount = allTransactions.length;
  var dueCount = 0;
  var paidCount = 0;

  pendingPayeesMap = {};

  allTransactions.forEach(function(t) {
    var isPaid = safeStr(t["Payment Status"]).toLowerCase() === "paid";
    if (isPaid) {
      paidCount++;
    } else {
      dueCount++;
      var pName = safeStr(t.submitterName || "Team Member").trim();
      var pUPI  = safeStr(t.submitterUPI || "").trim();
      var pKey = (pName + "|||" + pUPI).toLowerCase();
      if (!pendingPayeesMap[pKey]) {
        pendingPayeesMap[pKey] = {
          key: pKey,
          payeeName: pName,
          payeeUPI: pUPI,
          items: [],
          totalAmount: 0
        };
      }
      pendingPayeesMap[pKey].items.push(t);
      pendingPayeesMap[pKey].totalAmount += safeFloat(t["Share Amount"]);
    }
  });

  var batchBox = document.getElementById("payeeBatchActions");
  var pKeys = Object.keys(pendingPayeesMap);

  if (batchBox) {
    if (pKeys.length > 0 && txActiveFilter !== "paid") {
      batchBox.style.display = "flex";
      batchBox.innerHTML = '<div style="font-family:var(--head);font-size:15px;font-weight:800;color:var(--ink);letter-spacing:0.04em;text-transform:uppercase;display:flex;align-items:center;gap:6px;margin-bottom:2px;">' +
        '<span>⚡</span> <span>Pay All Dues by Payee (' + pKeys.length + ' Payee' + (pKeys.length > 1 ? 's' : '') + ')</span>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
        pKeys.map(function(k) {
          var grp = pendingPayeesMap[k];
          var count = grp.items.length;
          var totalFmt = grp.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          var encKey = encodeURIComponent(k);
          var upiBadge = grp.payeeUPI ? '<span class="upi-chip" style="font-size:11px;padding:3px 8px;">' + grp.payeeUPI + '</span>' : '';
          return '<div class="payee-batch-card clip-a">' +
            '<div class="payee-batch-info">' +
              '<div class="payee-batch-title">' +
                '<span>👤 ' + grp.payeeName + '</span>' +
                upiBadge +
              '</div>' +
              '<div class="payee-batch-meta">' +
                '<span><strong>' + count + '</strong> pending due split' + (count > 1 ? 's' : '') + '</span>' +
                '<span>•</span>' +
                '<span>Total Sum: <strong class="payee-batch-amount" style="font-size:18px;color:var(--green);">₹ ' + totalFmt + '</strong></span>' +
              '</div>' +
            '</div>' +
            '<div>' +
              '<button class="btn btn-primary shimmer-btn clip-sm payee-batch-btn" onclick="openBatchPayModal(\'' + encKey + '\')">' +
                '⚡ Pay All Due of ' + grp.payeeName + ' (₹ ' + totalFmt + ')' +
              '</button>' +
            '</div>' +
          '</div>';
        }).join("") +
        '</div>';
    } else {
      batchBox.style.display = "none";
      batchBox.innerHTML = "";
    }
  }

  var elCntAll = document.getElementById("txCountAll");
  var elCntDue = document.getElementById("txCountDue");
  var elCntPaid = document.getElementById("txCountPaid");
  if (elCntAll) elCntAll.textContent = totalCount;
  if (elCntDue) elCntDue.textContent = dueCount;
  if (elCntPaid) elCntPaid.textContent = paidCount;

  var filtered = allTransactions.filter(function(t) {
    var isPaid = safeStr(t["Payment Status"]).toLowerCase() === "paid";
    if (txActiveFilter === "due") return !isPaid;
    if (txActiveFilter === "paid") return isPaid;
    return true;
  });

  if (!filtered.length) {
    var emptyMsg = txActiveFilter === "due" ? "No pending dues! All your split shares are cleared. 🎉" :
                   txActiveFilter === "paid" ? "No paid transactions found yet." :
                   "No transactions found for your account.";
    var emptyHtml = '<div class="empty-state"><div class="empty-icon">' + (txActiveFilter === "due" ? '🎉' : '📋') + '</div><div class="empty-text">' + emptyMsg + '</div></div>';
    tbody.innerHTML = '<tr class="loading-row"><td colspan="8">' + emptyHtml + '</td></tr>';
    mobileBox.innerHTML = emptyHtml;
    return;
  }

  tbody.innerHTML = filtered.map(function(t) {
    var expID = safeStr(t["Expense ID"]);
    var isPaid = safeStr(t["Payment Status"]).toLowerCase() === "paid";
    var statusBadge = isPaid
      ? '<span class="badge badge-green">Paid</span>'
      : '<span class="badge badge-red">Pending</span>';

    var proofLink = t["Payment Proof Link"]
      ? '<a href="' + driveViewURL(t["Payment Proof Link"]) + '" target="_blank" class="btn btn-sm btn-secondary clip-sm">View Proof</a>'
      : (t.utrNumber ? '<span style="font-family:var(--mono);font-size:11px;color:var(--ink2);" title="UTR: ' + safeStr(t.utrNumber) + '">UTR: ' + safeStr(t.utrNumber) + '</span>' : '—');

    var payeeUpi = safeStr(t.submitterUPI || "—");

    var actionBtn = isPaid
      ? '<span class="badge badge-green" style="padding:6px 12px;font-size:11.5px;font-weight:700;">✓ Settled</span>'
      : '<button class="btn btn-sm btn-primary shimmer-btn clip-sm" onclick="openPayModal(\'' + expID + '\')">Pay Now 💳</button>';

    return '<tr>' +
      '<td><span style="font-family:var(--mono);color:var(--cr);font-weight:700;">#' + expID + '</span></td>' +
      '<td style="font-weight:600;">' + safeStr(t["Item Name"]) + '</td>' +
      '<td style="color:var(--green);font-weight:700;">₹' + safeFloat(t["Share Amount"]).toFixed(2) + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td style="font-family:var(--mono);font-size:11px;">' + formatDisplayDate(t["Payment Date"]) + '</td>' +
      '<td style="font-family:var(--mono);font-size:11.5px;color:var(--gd);font-weight:700;">' + payeeUpi + '</td>' +
      '<td>' + proofLink + '</td>' +
      '<td>' + actionBtn + '</td>' +
      '</tr>';
  }).join("");

  mobileBox.innerHTML = filtered.map(function(t) {
    var expID = safeStr(t["Expense ID"]);
    var isPaid = safeStr(t["Payment Status"]).toLowerCase() === "paid";
    var statusBadge = isPaid
      ? '<span class="badge badge-green">Paid</span>'
      : '<span class="badge badge-red">Pending</span>';

    var proofLink = t["Payment Proof Link"]
      ? '<a href="' + driveViewURL(t["Payment Proof Link"]) + '" target="_blank" class="btn btn-sm btn-secondary clip-sm">View Proof 📄</a>'
      : '';

    var payeeUpi = safeStr(t.submitterUPI || "—");

    var actionBtn = isPaid
      ? '<span class="badge badge-green" style="padding:8px 14px;font-size:11.5px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;">✓ Settled</span>'
      : '<button class="btn btn-sm btn-primary shimmer-btn clip-sm" style="flex:1;" onclick="openPayModal(\'' + expID + '\')">Pay Now 💳</button>';

    return '<div class="res-card clip-a">' +
      '<div class="res-card-header">' +
        '<div>' +
          '<div class="res-card-id">SPLIT #' + expID + '</div>' +
          '<div class="res-card-title">' + safeStr(t["Item Name"]) + '</div>' +
        '</div>' +
        '<div class="res-card-amount">₹ ' + safeFloat(t["Share Amount"]).toFixed(2) + '</div>' +
      '</div>' +
      '<div class="res-card-grid">' +
        '<div class="res-info-block"><span class="res-info-label">STATUS</span><span>' + statusBadge + '</span></div>' +
        '<div class="res-info-block"><span class="res-info-label">PAYEE UPI ID</span><span class="res-info-value" style="font-family:var(--mono);font-size:11.5px;color:var(--gd);font-weight:700;">' + payeeUpi + '</span></div>' +
        '<div class="res-info-block"><span class="res-info-label">PAID ON</span><span class="res-info-value">' + formatDisplayDate(t["Payment Date"]) + '</span></div>' +
        '<div class="res-info-block"><span class="res-info-label">PROOF / UTR</span><span class="res-info-value" style="font-family:var(--mono);font-size:11px;">' + (safeStr(t.utrNumber || "—")) + '</span></div>' +
      '</div>' +
      '<div class="res-card-footer">' +
        actionBtn +
        proofLink +
      '</div>' +
    '</div>';
  }).join("");
}

async function loadTransactions(force) {
  var tbody = document.getElementById("transactionsTable");
  var mobileBox = document.getElementById("transactionsCardsMobile");

  if (allTransactions && allTransactions.length > 0) {
    renderTransactionsList();
  } else {
    var cached = getCachedData("transactions");
    if (cached && cached.length > 0) {
      allTransactions = cached;
      txRegistry = {};
      cached.forEach(function(t) { txRegistry[t["Expense ID"]] = t; });
      renderTransactionsList();
      updateDashboardUI();
    } else {
      tbody.innerHTML = '<tr class="loading-row"><td colspan="8">' + getTechLoaderHtml("Synchronizing your transactions and dues...") + '</td></tr>';
      mobileBox.innerHTML = '<div style="text-align:center;padding:24px;">' + getTechLoaderHtml("Synchronizing your transactions and dues...") + '</div>';
    }
  }

  if (_activeFetches["transactions"]) return;
  var now = Date.now();
  if (!force && _cacheTimestamps["transactions"] && (now - _cacheTimestamps["transactions"] < 45000)) {
    return;
  }

  _activeFetches["transactions"] = true;
  var mem = getSessionMemberPayload();

  try {
    var res = await api({
      action: "getMyTransactions",
      memberID: mem.memberID,
      email:    mem.email,
      name:     mem.name,
      phone:    mem.phone
    });

    if (res && res.success && Array.isArray(res.data)) {
      allTransactions = res.data;
      txRegistry = {};
      res.data.forEach(function(t) { txRegistry[t["Expense ID"]] = t; });
      setCachedData("transactions", allTransactions);
      _cacheTimestamps["transactions"] = Date.now();
      renderTransactionsList();
      updateDashboardUI();
    } else if (!allTransactions.length) {
      allTransactions = [];
      txRegistry = {};
      pendingPayeesMap = {};
      var emptyHtml = '<div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-text">No pending dues or transactions found for your account.</div></div>';
      tbody.innerHTML = '<tr class="loading-row"><td colspan="8">' + emptyHtml + '</td></tr>';
      mobileBox.innerHTML = emptyHtml;
      var batchBox = document.getElementById("payeeBatchActions");
      if (batchBox) { batchBox.style.display = "none"; batchBox.innerHTML = ""; }
      var elCntAll = document.getElementById("txCountAll");
      var elCntDue = document.getElementById("txCountDue");
      var elCntPaid = document.getElementById("txCountPaid");
      if (elCntAll) elCntAll.textContent = "0";
      if (elCntDue) elCntDue.textContent = "0";
      if (elCntPaid) elCntPaid.textContent = "0";
      updateDashboardUI();
    }
  } catch (e) {
    console.warn("loadTransactions error:", e);
  } finally {
    _activeFetches["transactions"] = false;
  }
}

function openBatchPayModal(encKey) {
  var k = decodeURIComponent(encKey);
  var group = pendingPayeesMap[k];
  if (!group || !group.items.length) {
    toast("No pending dues found for this payee.", "error");
    return;
  }

  var expIDs = group.items.map(function(t) { return safeStr(t["Expense ID"]); });
  var amt = group.totalAmount.toFixed(2);
  var payeeName = group.payeeName;
  var upi = group.payeeUPI;

  currentPayData = {
    isBatch: true,
    payeeName: payeeName,
    payeeUPI: upi,
    expenseIDs: expIDs,
    items: group.items,
    totalAmount: group.totalAmount
  };

  var titleEl = document.getElementById("payModalTitle");
  if (titleEl) titleEl.textContent = "💳 Pay All Dues of " + payeeName + " (" + group.items.length + " Items)";

  var elExpID = document.getElementById("payExpID");
  if (elExpID) elExpID.textContent = group.items.length + " Dues (#" + expIDs.join(", #") + ")";

  var elItem = document.getElementById("payItem");
  if (elItem) elItem.textContent = "All Dues to " + payeeName;

  var elTotal = document.getElementById("payTotalExp");
  if (elTotal) elTotal.textContent = "₹ " + amt;

  var elDate = document.getElementById("payDate");
  if (elDate) elDate.textContent = group.items.length + " Combined Splits";

  var elSub = document.getElementById("paySubmitter");
  if (elSub) elSub.textContent = payeeName;

  var elUpi = document.getElementById("payUPI");
  if (elUpi) elUpi.textContent = upi || "team@upi";

  var elAmountLabel = document.getElementById("payAmountLabel");
  if (elAmountLabel) elAmountLabel.textContent = "TOTAL BATCH DUE AMOUNT";

  var elAmount = document.getElementById("payAmount");
  if (elAmount) elAmount.textContent = "₹ " + amt;

  var batchBox = document.getElementById("payBatchItemsBox");
  var batchCount = document.getElementById("payBatchItemsCount");
  var batchList = document.getElementById("payBatchItemsList");
  if (batchBox && batchList) {
    batchBox.style.display = "block";
    if (batchCount) batchCount.textContent = group.items.length + " Items";
    batchList.innerHTML = group.items.map(function(it) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px dashed var(--line2);font-size:12px;">' +
        '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:8px;">' +
          '<span style="font-family:var(--mono);color:var(--cr);font-weight:700;">#' + it["Expense ID"] + '</span>' +
          '<span style="font-weight:600;margin-left:5px;">' + safeStr(it["Item Name"]) + '</span>' +
        '</div>' +
        '<div style="font-family:var(--mono);font-weight:700;color:var(--green);white-space:nowrap;">' +
          '₹ ' + safeFloat(it["Share Amount"]).toFixed(2) +
        '</div>' +
      '</div>';
    }).join("");
  }

  var utrInput = document.getElementById("payUTR");
  if (utrInput) utrInput.value = "";

  var fileInput = document.getElementById("payProofFile");
  if (fileInput) fileInput.value = "";

  var previewBox = document.getElementById("payProofPreview");
  if (previewBox) previewBox.style.display = "none";

  var cleanUpi = (upi && upi !== "—") ? upi.trim() : "team@upi";
  var hasValidUpi = cleanUpi.includes("@");
  var upiUri = "upi://pay?pa=" + encodeURIComponent(cleanUpi) +
               "&pn=" + encodeURIComponent(payeeName || "TECH VIPERS") +
               "&am=" + amt +
               "&cu=INR" +
               "&tn=" + encodeURIComponent("Pay all dues (" + group.items.length + " items) to " + payeeName);

  var qrImg = document.getElementById("payQRCodeImg");
  var qrPlaceholder = document.getElementById("payQRPlaceholder");
  if (qrImg) {
    if (hasValidUpi) {
      qrImg.classList.remove("loaded");
      qrImg.onload = function() { qrImg.classList.add("loaded"); };
      qrImg.src = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(upiUri);
      qrImg.style.display = "block";
      if (qrPlaceholder) qrPlaceholder.style.display = "none";
      if (qrImg.complete) qrImg.classList.add("loaded");
    } else {
      qrImg.style.display = "none";
      if (qrPlaceholder) qrPlaceholder.style.display = "flex";
    }
  }

  var upiBtn = document.getElementById("payUPIAppBtn");
  if (upiBtn) {
    upiBtn.href = upiUri;
    upiBtn.innerHTML = "<span>📲 Pay ₹" + amt + " via Any UPI App</span>";
  }

  openModal("payModal");
}

function openPayModal(expenseID) {
  var t = (txRegistry && txRegistry[expenseID]) || null;
  var exp = (allExpensesMap && allExpensesMap[expenseID]) || null;

  currentPayData = t || (exp ? {
    isBatch: false,
    "Expense ID": expenseID,
    "Item Name": exp["Item Name"],
    "Share Amount": (safeFloat(exp["Total Amount"]) / (exp.totalSplits || 1)).toFixed(2),
    submitterUPI: exp.submitterUPI,
    submitterName: exp.submitterName,
    "Payment Date": exp["Date of Purchase"]
  } : { isBatch: false, "Expense ID": expenseID });

  currentPayData.isBatch = false;

  var amt = t ? safeFloat(t["Share Amount"]).toFixed(2) : (exp ? (safeFloat(exp["Total Amount"]) / (exp.totalSplits || 1)).toFixed(2) : "0.00");
  var item = safeStr((t && t["Item Name"]) || (exp && exp["Item Name"]) || "Expense Split");
  var submitter = safeStr((t && t.submitterName) || (exp && exp.submitterName) || "Team Member");
  var upi = safeStr((t && t.submitterUPI) || (exp && exp.submitterUPI) || "team@upi");
  var totalAmt = exp ? safeFloat(exp["Total Amount"]).toFixed(2) : (safeFloat(amt) * (exp && exp.totalSplits ? exp.totalSplits : 1)).toFixed(2);
  var purchaseDate = (t && t["Payment Date"]) || (exp && exp["Date of Purchase"]) || "";

  var titleEl = document.getElementById("payModalTitle");
  if (titleEl) titleEl.textContent = "💳 Pay Due Share: " + item + " (#" + expenseID + ")";

  var elExpID = document.getElementById("payExpID");
  if (elExpID) elExpID.textContent = "#" + expenseID;

  var elItem = document.getElementById("payItem");
  if (elItem) elItem.textContent = item;

  var elTotal = document.getElementById("payTotalExp");
  if (elTotal) elTotal.textContent = "₹ " + safeFloat(totalAmt).toFixed(2);

  var elDate = document.getElementById("payDate");
  if (elDate) elDate.textContent = formatDisplayDate(purchaseDate) || "—";

  var elSub = document.getElementById("paySubmitter");
  if (elSub) elSub.textContent = submitter;

  var elUpi = document.getElementById("payUPI");
  if (elUpi) elUpi.textContent = upi || "team@upi";

  var elAmountLabel = document.getElementById("payAmountLabel");
  if (elAmountLabel) elAmountLabel.textContent = "Your Due Share";

  var elAmount = document.getElementById("payAmount");
  if (elAmount) elAmount.textContent = "₹ " + amt;

  var batchBox = document.getElementById("payBatchItemsBox");
  if (batchBox) batchBox.style.display = "none";

  var utrInput = document.getElementById("payUTR");
  if (utrInput) utrInput.value = "";

  var fileInput = document.getElementById("payProofFile");
  if (fileInput) fileInput.value = "";

  var previewBox = document.getElementById("payProofPreview");
  if (previewBox) previewBox.style.display = "none";

  var cleanUpi = (upi && upi !== "—") ? upi.trim() : "team@upi";
  var hasValidUpi = cleanUpi.includes("@");
  var upiUri = "upi://pay?pa=" + encodeURIComponent(cleanUpi) +
               "&pn=" + encodeURIComponent(submitter || "TECH VIPERS") +
               "&am=" + amt +
               "&cu=INR" +
               "&tn=" + encodeURIComponent("Split due for #" + expenseID + " - " + item);

  var qrImg = document.getElementById("payQRCodeImg");
  var qrPlaceholder = document.getElementById("payQRPlaceholder");
  if (qrImg) {
    if (hasValidUpi) {
      qrImg.classList.remove("loaded");
      qrImg.onload = function() { qrImg.classList.add("loaded"); };
      qrImg.src = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(upiUri);
      qrImg.style.display = "block";
      if (qrPlaceholder) qrPlaceholder.style.display = "none";
      if (qrImg.complete) qrImg.classList.add("loaded");
    } else {
      qrImg.style.display = "none";
      if (qrPlaceholder) qrPlaceholder.style.display = "flex";
    }
  }

  var upiBtn = document.getElementById("payUPIAppBtn");
  if (upiBtn) {
    upiBtn.href = upiUri;
    upiBtn.innerHTML = "<span>📲 Pay via Any UPI App</span>";
  }

  openModal("payModal");
}

function copyUPI() {
  var el = document.getElementById("payUPI");
  var upi = el ? el.textContent.trim() : "";
  if (!upi || upi === "—") {
    toast("No UPI ID available to copy.", "error");
    return;
  }
  navigator.clipboard.writeText(upi).then(function() {
    toast("Copied UPI ID to clipboard: " + upi, "success");
  }).catch(function() {
    toast("UPI ID: " + upi, "info");
  });
}
function copyPayUpi() { copyUPI(); }

function previewPayProof(input) {
  var file = input.files[0];
  var box = document.getElementById("payProofPreview");
  var img = document.getElementById("payProofImg");
  if (!file) {
    if (box) box.style.display = "none";
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    if (img) img.src = e.target.result;
    if (box) box.style.display = "block";
  };
  reader.readAsDataURL(file);
}

async function submitPayment() {
  if (!currentPayData) {
    toast("No active expense split selected.", "error");
    return;
  }
  var utrEl = document.getElementById("payUTR");
  var utr = utrEl ? utrEl.value.trim() : "";
  if (!utr) {
    toast("Please enter the 12-digit UPI Reference / UTR Number.", "error");
    if (utrEl) utrEl.focus();
    return;
  }

  var btn = document.getElementById("payBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Submitting Proof...';
  }

  showLoader();

  var proofFileID = "";
  var proofFileInput = document.getElementById("payProofFile");
  var proofFile = proofFileInput ? proofFileInput.files[0] : null;
  if (proofFile) {
    try {
      var expLabel = currentPayData.isBatch ? ("Batch_" + (currentPayData.payeeName || "Payee")) : (currentPayData["Expense ID"] || "DUE");
      var up = await uploadFileToAPI(proofFile, "PROOF", "Pay_Proof_" + expLabel);
      if (up.success) proofFileID = up.fileID;
    } catch(e) {
      console.warn("Proof screenshot upload note:", e);
    }
  }

  try {
    if (currentPayData.isBatch) {
      var res = await api({
        action: "payBatchTransactions",
        data: {
          expenseIDs: currentPayData.expenseIDs,
          memberID: session.memberID,
          utrNumber: utr,
          proofFileID: proofFileID
        }
      });

      if (!res.success && (res.message && res.message.indexOf("Unknown action") !== -1)) {
        var promises = currentPayData.expenseIDs.map(function(id) {
          return api({
            action: "payTransaction",
            data: {
              expenseID: id,
              memberID: session.memberID,
              utrNumber: utr,
              proofFileID: proofFileID
            }
          });
        });
        await Promise.all(promises);
        res = { success: true, message: "All " + currentPayData.expenseIDs.length + " dues marked paid with UTR " + utr + "!" };
      }

      hideLoader();

      if (res.success) {
        toast(res.message || "All dues for " + (currentPayData.payeeName || "payee") + " confirmed with UTR " + utr + "!", "success");
        closeModal("payModal");
        loadTransactions();
        loadDashboardStats();
        loadExpenses();
      } else {
        toast(res.message || "Failed to confirm batch payment.", "error");
      }

    } else {
      var res = await api({
        action: "payTransaction",
        data: {
          expenseID: currentPayData["Expense ID"],
          memberID: session.memberID,
          utrNumber: utr,
          proofFileID: proofFileID
        }
      });

      hideLoader();

      if (res.success) {
        toast(res.message || "Payment submitted & confirmed! Split share marked as paid.", "success");
        closeModal("payModal");
        loadTransactions();
        loadDashboardStats();
        loadExpenses();
      } else {
        toast(res.message || "Failed to confirm payment.", "error");
      }
    }
  } catch(e) {
    hideLoader();
    toast("Payment error: " + e.message, "error");
  }

  if (btn) {
    btn.disabled = false;
    btn.textContent = "Confirm & Submit Payment";
  }
}

// ============================================================
// TEAM MEDIA (FULL GOOGLE DRIVE INTEGRATION)
// ============================================================
var currentMediaLayout = "grid";

function setMediaViewLayout(layout) {
  currentMediaLayout = (layout === "normal") ? "normal" : "grid";
  var grid = document.getElementById("mediaGrid");
  var gridBtn = document.getElementById("mediaLayoutGridBtn");
  var normalBtn = document.getElementById("mediaLayoutNormalBtn");

  if (grid) {
    if (currentMediaLayout === "normal") {
      grid.classList.remove("layout-grid-50");
      grid.classList.add("layout-normal");
    } else {
      grid.classList.remove("layout-normal");
      grid.classList.add("layout-grid-50");
    }
  }

  if (gridBtn) {
    if (currentMediaLayout === "grid") {
      gridBtn.classList.add("active");
    } else {
      gridBtn.classList.remove("active");
    }
  }

  if (normalBtn) {
    if (currentMediaLayout === "normal") {
      normalBtn.classList.add("active");
    } else {
      normalBtn.classList.remove("active");
    }
  }

  try {
    localStorage.setItem("techvipers_media_layout", currentMediaLayout);
  } catch(e) {}
}

function initMediaLayout() {
  var saved = "grid";
  try {
    saved = localStorage.getItem("techvipers_media_layout") || "grid";
  } catch(e) {}
  setMediaViewLayout(saved);
}

async function loadMedia(force) {
  initMediaLayout();
  var grid = document.getElementById("mediaGrid");

  if (allMedia && allMedia.length > 0) {
    renderMedia(allMedia);
  } else {
    var cached = getCachedData("media");
    if (cached && cached.length > 0) {
      allMedia = cached;
      renderMedia(allMedia);
      updateDashboardUI();
    } else {
      grid.innerHTML = '<div style="text-align:center;padding:32px;grid-column:1/-1">' + getTechLoaderHtml("Streaming high-res robot media from Google Drive...") + '</div>';
    }
  }

  if (_activeFetches["media"]) return;
  var now = Date.now();
  if (!force && _cacheTimestamps["media"] && (now - _cacheTimestamps["media"] < 45000)) {
    return;
  }

  _activeFetches["media"] = true;
  try {
    var res = await api({ action: "getTeamMedia" });
    if (res && res.success && Array.isArray(res.data)) {
      allMedia = res.data;
      setCachedData("media", allMedia);
      _cacheTimestamps["media"] = Date.now();
      renderMedia(allMedia);
      updateDashboardUI();
    }
  } catch (e) {
    console.warn("loadMedia error:", e);
  } finally {
    _activeFetches["media"] = false;
  }
}

function renderMedia(list) {
  var grid = document.getElementById("mediaGrid");
  if (!list || !list.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📸</div><div class="empty-text">No media uploaded yet in Google Drive. Click "+ Upload Media" to start sharing!</div></div>';
    return;
  }

  grid.innerHTML = list.map(function(m) {
    var fileID = safeStr(m.fileID);
    var thumb = driveThumbnailURL(fileID);
    var view = driveViewURL(fileID);
    var dl = driveDownloadURL(fileID);
    var desc = safeStr(m.description || "TECH VIPERS Media");
    var isVideo = safeStr(m.fileType).toUpperCase() === "VIDEO";
    var isDoc = safeStr(m.fileType).toUpperCase() === "DOCUMENT";

    var iconFallback = isVideo ? "🎬" : isDoc ? "📄" : "🤖";
    var imgHtml = thumb
      ? '<img src="' + thumb + '" alt="' + desc + '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
        '<div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:36px;">' + iconFallback + '</div>'
      : '<div style="font-size:36px;">' + iconFallback + '</div>';

    return '<div class="media-card">' +
      '<div class="media-thumb" onclick="openLightbox(\'' + (thumb || view) + '\',\'' + encodeURIComponent(desc) + '\')">' +
        imgHtml +
      '</div>' +
      '<div class="media-info">' +
        '<div class="media-desc">' + desc + '</div>' +
        '<div class="media-meta">👤 ' + safeStr(m.uploadedBy || "Member") + ' • 📅 ' + formatDisplayDate(m.uploadDate) + '</div>' +
        '<div class="media-actions">' +
          (view ? '<a href="' + view + '" target="_blank" class="btn btn-sm btn-secondary media-btn-drive" title="Drive View">Drive View</a>' : '') +
          (dl ? '<a href="' + dl + '" target="_blank" class="btn btn-sm btn-secondary media-btn-dl" title="Download">⬇️</a>' : '') +
        '</div>' +
      '</div>' +
      '</div>';
  }).join("");
}

function filterMedia() {
  var q = document.getElementById("mediaSearch").value.toLowerCase();
  var type = document.getElementById("mediaFilterType").value.toUpperCase();
  var filtered = allMedia.filter(function(m) {
    var matchQ = safeStr(m.description).toLowerCase().indexOf(q) !== -1;
    var matchType = !type || safeStr(m.fileType).toUpperCase() === type;
    return matchQ && matchType;
  });
  renderMedia(filtered);
}

function previewSelectedMedia(input) {
  var file = input.files[0];
  var box = document.getElementById("mediaFilePreview");
  var img = document.getElementById("mediaPreviewImg");
  var info = document.getElementById("mediaFileInfo");
  if (!file) { box.style.display = "none"; return; }

  box.style.display = "block";
  info.textContent = file.name + " (" + (file.size / (1024 * 1024)).toFixed(2) + " MB)";

  if (file.type.indexOf("image") !== -1) {
    var reader = new FileReader();
    reader.onload = function(e) { img.src = e.target.result; img.style.display = "inline-block"; };
    reader.readAsDataURL(file);
  } else {
    img.style.display = "none";
  }
}

async function submitMedia() {
  var desc = document.getElementById("mediaDesc").value.trim();
  var file = document.getElementById("mediaFile").files[0];
  var cat  = document.getElementById("mediaCategory").value;
  if (!desc || !file) { toast("Description and File are required.", "error"); return; }

  var btn = document.getElementById("addMediaBtn");
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Uploading to Google Drive...';

  try {
    var up = await uploadFileToAPI(file, cat, desc);
    if (!up.success) {
      toast("Drive upload error: " + up.message, "error");
      btn.disabled = false;
      btn.textContent = "Upload to Drive";
      return;
    }

    var fileType = "IMAGE";
    if (file.type.indexOf("video") !== -1) fileType = "VIDEO";
    else if (file.type.indexOf("pdf") !== -1) fileType = "DOCUMENT";

    var res = await api({
      action: "addTeamMedia",
      data: {
        description: desc,
        fileID: up.fileID,
        uploadedBy: session.fullName,
        fileType: fileType,
        fileName: file.name
      }
    });

    if (res.success) {
      toast("Media uploaded to Google Drive successfully!", "success");
      closeModal("addMediaModal");
      document.getElementById("mediaDesc").value = "";
      document.getElementById("mediaFile").value = "";
      document.getElementById("mediaFilePreview").style.display = "none";
      loadMedia();
      loadDashboardStats();
    } else {
      toast(res.message || "Failed to record media.", "error");
    }
  } catch (e) {
    toast("Upload error: " + e.message, "error");
  }

  btn.disabled = false;
  btn.textContent = "Upload to Drive";
}

// ============================================================
// TEAM MEMBERS & PROFILE SYNCHRONIZATION
// ============================================================
async function loadTeamMembersList() {
  try {
    var res = await api({ action: "getTeamMembers" });
    if (res.success && Array.isArray(res.data)) {
      allMembers = res.data.map(function(m) {
        var name = (m.fullName || m["Full Name"] || m.name || m["Name"] || m["Member Name"] || "").trim();
        var email = (m.email || m["Email Address"] || m["Email"] || "").trim();
        var phone = (m.phone || m["Phone Number"] || m["Phone"] || "").trim();
        var upi = (m.upiHandle || m["UPI Handle"] || m["UPI ID"] || "").trim();
        var id = (m.memberID || m["Member ID"] || m.id || "").trim();
        return {
          memberID: id,
          fullName: name,
          email: email,
          phone: phone,
          upiHandle: upi
        };
      }).filter(function(m) {
        return m.memberID || m.fullName || m.email;
      });

      if (session) {
        var myRecord = allMembers.find(function(m) {
          return (session.memberID && matchMemberID(m.memberID, session.memberID)) ||
                 (session.email && m.email && m.email.toLowerCase() === session.email.toLowerCase()) ||
                 (session.phone && m.phone && m.phone === session.phone);
        });
        if (myRecord) {
          if (myRecord.memberID && (!session.memberID || session.memberID === "1")) {
            session.memberID = myRecord.memberID;
          }
          if (myRecord.fullName && !myRecord.fullName.includes("@") && !/^\d+$/.test(myRecord.fullName)) {
            session.fullName = myRecord.fullName;
          }
          if (myRecord.upiHandle) {
            session.upiHandle = myRecord.upiHandle;
          }
          localStorage.setItem("techvipers_session", JSON.stringify(session));

          var displayName = getMemberDisplayName(session);
          var topNameEl = document.getElementById("topbarName");
          if (topNameEl) topNameEl.textContent = displayName;
          var topAvatarEl = document.getElementById("topbarAvatar");
          if (topAvatarEl) topAvatarEl.textContent = getInitials(displayName);
          var dashNameEl = document.getElementById("dashName");
          if (dashNameEl) dashNameEl.textContent = getMemberFirstName(session);
          var mobNameEl = document.getElementById("mobUserName");
          if (mobNameEl) mobNameEl.textContent = displayName;
          var sbNameEl = document.getElementById("sidebarUserName");
          if (sbNameEl) sbNameEl.textContent = displayName;
          var sbAvatar = document.getElementById("sidebarAvatar");
          if (sbAvatar) sbAvatar.textContent = getInitials(displayName);
          var mobAvatar = document.getElementById("mobUserAvatar");
          if (mobAvatar) mobAvatar.textContent = getInitials(displayName);
          var mobIDEl = document.getElementById("mobUserID");
          if (mobIDEl) mobIDEl.textContent = "ID: " + formatMemberID(session.memberID);
          var sbIDEl = document.getElementById("sidebarMemberID");
          if (sbIDEl) sbIDEl.textContent = "ID: " + formatMemberID(session.memberID);
          var ddNameEl = document.getElementById("dropdownUserName");
          if (ddNameEl) ddNameEl.textContent = displayName;
          var ddIDEl = document.getElementById("dropdownMemberID");
          if (ddIDEl) ddIDEl.textContent = "ID: " + formatMemberID(session.memberID);
          var ddAvatarEl = document.getElementById("dropdownAvatar");
          if (ddAvatarEl) ddAvatarEl.textContent = getInitials(displayName);
        }
      }
    } else {
      allMembers = [];
    }
    populateAssetMembersDropdown();
  } catch(e) {
    console.warn("Error loading members list:", e);
    allMembers = [];
    populateAssetMembersDropdown();
  }
}

function populateAssetMembersDropdown() {
  var addSel = document.getElementById("assetIssuedTo");
  var editSel = document.getElementById("editAssetIssuedTo");
  var defaultOptions = '<option value="">-- Choose Member --</option><option value="General Robotics Lab">General Robotics Lab (Shared)</option>';

  var memberOpts = "";
  if (allMembers && allMembers.length) {
    allMembers.forEach(function(m) {
      var displayName = m.fullName || m.email || ("Member " + formatMemberID(m.memberID));
      var displayDetail = m.email ? ' (' + m.email + ')' : '';
      memberOpts += '<option value="' + displayName + '">👤 ' + displayName + displayDetail + '</option>';
    });
  }

  if (addSel) addSel.innerHTML = defaultOptions + memberOpts;
  if (editSel) editSel.innerHTML = defaultOptions + memberOpts;
}

// ============================================================
// COMPETITION EVENTS
// ============================================================
async function loadEvents(force) {
  var grid = document.getElementById("eventsGrid");

  if (allEvents && allEvents.length > 0) {
    renderEvents(allEvents);
  } else {
    var cached = getCachedData("events");
    if (cached && cached.length > 0) {
      allEvents = cached;
      renderEvents(allEvents);
    } else {
      grid.innerHTML = '<div style="text-align:center;padding:32px;grid-column:1/-1">' + getTechLoaderHtml("Loading tournament schedules and details...") + '</div>';
    }
  }

  if (_activeFetches["events"]) return;
  var now = Date.now();
  if (!force && _cacheTimestamps["events"] && (now - _cacheTimestamps["events"] < 45000)) {
    return;
  }

  _activeFetches["events"] = true;
  try {
    var res = await api({ action: "getEvents" });
    if (res && res.success && Array.isArray(res.data)) {
      allEvents = res.data;
      setCachedData("events", allEvents);
      _cacheTimestamps["events"] = Date.now();
      renderEvents(allEvents);
    }
  } catch (e) {
    console.warn("loadEvents error:", e);
  } finally {
    _activeFetches["events"] = false;
  }
}

function getEventDateCounterHtml(dateVal) {
  if (!dateVal) return "";
  var s = String(dateVal).trim();
  var evDate;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    var parts = s.substring(0, 10).split("-");
    evDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  } else {
    evDate = new Date(s);
  }
  if (isNaN(evDate.getTime())) return "";

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var target = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate());

  var diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return '<span class="badge" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);color:#ef4444;font-family:var(--mono);font-size:11.5px;font-weight:800;letter-spacing:0.04em;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px #ef4444;"></span> HAPPENING TODAY!</span>';
  } else if (diffDays === 1) {
    return '<span class="badge" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);color:#d97706;font-family:var(--mono);font-size:11.5px;font-weight:800;">⏳ Tomorrow</span>';
  } else if (diffDays > 1) {
    return '<span class="badge badge-blue" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;font-family:var(--mono);font-size:11.5px;font-weight:800;">⏱️ In ' + diffDays + ' Days</span>';
  } else if (diffDays === -1) {
    return '<span class="badge badge-gray" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;color:var(--ink3);font-family:var(--mono);font-size:11.5px;font-weight:700;">🏁 Yesterday</span>';
  } else {
    var pastDays = Math.abs(diffDays);
    return '<span class="badge badge-gray" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;color:var(--ink3);font-family:var(--mono);font-size:11.5px;font-weight:700;">🏁 ' + pastDays + ' Days Ago</span>';
  }
}

function renderEvents(list) {
  var grid = document.getElementById("eventsGrid");
  if (!list || !list.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🏆</div><div class="empty-text">No competition events scheduled yet. Click "+ Add Competition" to schedule one.</div></div>';
    return;
  }

  eventRegistry = {};
  list.forEach(function(ev) { eventRegistry[ev["Event ID"]] = ev; });

  grid.innerHTML = list.map(function(ev) {
    var evID = safeStr(ev["Event ID"]);
    var status = safeStr(ev["Participation Status"] || "Upcoming");
    var badgeClass = "badge-gray";
    if (status.indexOf("Open") !== -1) badgeClass = "badge-green";
    else if (status.indexOf("Closed") !== -1) badgeClass = "badge-red";
    else if (status.indexOf("Participated") !== -1) badgeClass = "badge-purple";

    var regUrl = safeStr(ev["Registration URL"]);
    var regBtn = regUrl ? '<a href="' + regUrl + '" target="_blank" class="btn btn-sm btn-primary">Event Portal ↗</a>' : '';
    var counterBadge = getEventDateCounterHtml(ev["Event Date"]);

    return '<div class="event-card">' +
      '<div class="event-card-actions">' +
        '<button class="btn btn-sm btn-secondary" onclick="openEditEventModal(\'' + evID + '\')" title="Edit Competition">✏️</button>' +
        '<button class="btn btn-sm btn-danger" onclick="deleteEventConfirm(\'' + evID + '\')" title="Delete Event">🗑️</button>' +
      '</div>' +
      '<div class="event-name">' + safeStr(ev["Event Name"]) + '</div>' +
      '<div class="event-detail">📅 <strong>Date:</strong> ' + formatDisplayDate(ev["Event Date"]) + '</div>' +
      '<div class="event-detail">📍 <strong>Venue:</strong> ' + safeStr(ev["Venue/Location"] || "TBA") + '</div>' +
      '<div class="event-detail">🏷️ <strong>Status:</strong> <span class="badge ' + badgeClass + '">' + status + '</span></div>' +
      (ev["Notes"] ? '<div class="event-detail" style="font-size:12px;color:var(--ink3);margin-top:6px;">📝 ' + safeStr(ev["Notes"]) + '</div>' : '') +
      '<div class="event-actions" style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:14px;flex-wrap:wrap;">' +
        (regBtn ? regBtn : '<span></span>') +
        counterBadge +
      '</div>' +
      '</div>';
  }).join("");
}

function filterEvents() {
  var q = document.getElementById("eventSearch").value.toLowerCase();
  var st = document.getElementById("eventStatusFilter").value;
  var filtered = allEvents.filter(function(e) {
    var matchQ = safeStr(e["Event Name"]).toLowerCase().indexOf(q) !== -1 ||
                 safeStr(e["Venue/Location"]).toLowerCase().indexOf(q) !== -1;
    var matchSt = !st || safeStr(e["Participation Status"]) === st;
    return matchQ && matchSt;
  });
  renderEvents(filtered);
}

function openAddEventModal() {
  clearForm(["evtName","evtDate","evtVenue","evtRegURL","evtNotes"]);
  var stEl = document.getElementById("evtStatus");
  if (stEl) stEl.value = "Registration Open";
  openModal("eventModal");
}

async function submitEvent() {
  var name = document.getElementById("evtName").value.trim();
  var date = document.getElementById("evtDate").value;
  if (!name || !date) { toast("Event Name and Date are required.", "error"); return; }

  var btn = document.getElementById("eventSubmitBtn");
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Saving...';

  var posterFileID = "";
  var posterFile = document.getElementById("evtPoster").files[0];
  if (posterFile) {
    try {
      var up = await uploadFileToAPI(posterFile, "POSTER", name);
      if (up.success) posterFileID = up.fileID;
    } catch(e) {
      console.warn("Event poster upload note:", e);
    }
  }

  var sendAnnouncement = document.getElementById("evtSendEmail").checked;

  try {
    var res = await api({
      action: "addEvent",
      data: {
        eventName: name,
        eventDate: date,
        venue: document.getElementById("evtVenue").value.trim(),
        registrationURL: document.getElementById("evtRegURL").value.trim(),
        participationStatus: document.getElementById("evtStatus").value,
        posterFileID: posterFileID,
        notes: document.getElementById("evtNotes").value.trim(),
        sendEmailAnnouncement: sendAnnouncement
      }
    });

    if (res.success) {
      toast("Competition event added successfully!", "success");
      closeModal("eventModal");
      loadEvents();
    } else {
      toast(res.message || "Failed to add event.", "error");
    }
  } catch(e) {
    toast("Event error: " + e.message, "error");
  }

  btn.disabled = false;
  btn.textContent = "Save Event";
}

function openEditEventModal(eventID) {
  var ev = eventRegistry[eventID];
  if (!ev) return;
  document.getElementById("editEventID").value = eventID;
  document.getElementById("evtName").value     = safeStr(ev["Event Name"]);
  document.getElementById("evtDate").value     = safeStr(ev["Event Date"]).split("T")[0];
  document.getElementById("evtVenue").value    = safeStr(ev["Venue/Location"]);
  document.getElementById("evtRegURL").value   = safeStr(ev["Registration URL"]);
  document.getElementById("evtStatus").value   = safeStr(ev["Participation Status"]) || "Registration Open";
  document.getElementById("evtNotes").value    = safeStr(ev["Notes"]);
  document.getElementById("eventModalTitle").textContent = "✏️ Edit Competition Event";
  document.getElementById("eventSubmitBtn").textContent = "Update Competition";
  document.getElementById("eventSubmitBtn").onclick = submitUpdateEvent;
  openModal("eventModal");
}

async function submitUpdateEvent() {
  var evID = document.getElementById("editEventID").value;
  var name = document.getElementById("evtName").value.trim();
  var date = document.getElementById("evtDate").value;
  if (!name || !date) { toast("Event Name and Date are required.", "error"); return; }

  var btn = document.getElementById("eventSubmitBtn");
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Updating...';

  var posterFileID = "";
  var posterFile = document.getElementById("evtPoster").files[0];
  if (posterFile) {
    try {
      var up = await uploadFileToAPI(posterFile, "POSTER", name);
      if (up.success) posterFileID = up.fileID;
    } catch(e) {
      console.warn("Event poster replace note:", e);
    }
  }

  try {
    var res = await api({
      action: "updateEvent",
      data: {
        eventID: evID,
        eventName: name,
        eventDate: date,
        venue: document.getElementById("evtVenue").value.trim(),
        registrationURL: document.getElementById("evtRegURL").value.trim(),
        participationStatus: document.getElementById("evtStatus").value,
        posterFileID: posterFileID,
        notes: document.getElementById("evtNotes").value.trim()
      }
    });

    if (res.success) {
      toast(res.message || "Competition updated!", "success");
      closeModal("eventModal");
      document.getElementById("eventModalTitle").textContent = "🏆 Add Competition Event";
      document.getElementById("eventSubmitBtn").textContent = "Save Event";
      document.getElementById("eventSubmitBtn").onclick = submitEvent;
      loadEvents();
    } else {
      toast(res.message || "Update failed.", "error");
    }
  } catch(e) {
    toast("Update error: " + e.message, "error");
  }

  btn.disabled = false;
}

async function deleteEventConfirm(eventID) {
  if (!confirm("Are you sure you want to delete this competition event?")) return;
  try {
    var res = await api({ action: "deleteEvent", data: { eventID: eventID } });
    if (res.success) {
      toast(res.message || "Event deleted.", "success");
      loadEvents();
    } else {
      toast(res.message || "Delete failed.", "error");
    }
  } catch (e) {
    toast("Delete error: " + e.message, "error");
  }
}

async function broadcastEventEmail(eventID) {
  toast("Broadcasting event announcement...", "info");
  try {
    var res = await api({
      action: "broadcastEventEmail",
      data: { eventID: eventID }
    });
    if (res.success) {
      toast(res.message || "Event notice broadcasted to all team members!", "success");
    } else {
      toast(res.message || "Broadcast failed.", "error");
    }
  } catch (e) {
    toast("Broadcast error: " + e.message, "error");
  }
}

// ============================================================
// CLUB ASSETS & TOOLS
// ============================================================
function filterAssets(tab) {
  assetActiveFilter = tab || "all";
  ["all", "issued", "returned"].forEach(function(t) {
    var btn = document.getElementById("tab-asset-" + t);
    if (btn) btn.classList.toggle("active", t === assetActiveFilter);
  });
  renderAssetsList();
}

function renderAssetsList() {
  var tbody = document.getElementById("assetsTable");
  var mobileBox = document.getElementById("assetsCardsMobile");
  if (!tbody || !mobileBox) return;

  var totalCount = allAssets.length;
  var issuedCount = 0;
  var returnedCount = 0;

  allAssets.forEach(function(a) {
    var isReturned = Boolean(a["Return Date"] && String(a["Return Date"]).trim() !== "");
    if (isReturned) returnedCount++;
    else issuedCount++;
  });

  var elCntAll = document.getElementById("assetCountAll");
  var elCntIssued = document.getElementById("assetCountIssued");
  var elCntReturned = document.getElementById("assetCountReturned");
  if (elCntAll) elCntAll.textContent = totalCount;
  if (elCntIssued) elCntIssued.textContent = issuedCount;
  if (elCntReturned) elCntReturned.textContent = returnedCount;

  var filtered = allAssets.filter(function(a) {
    var isReturned = Boolean(a["Return Date"] && String(a["Return Date"]).trim() !== "");
    if (assetActiveFilter === "issued") return !isReturned;
    if (assetActiveFilter === "returned") return isReturned;
    return true;
  });

  if (!filtered.length) {
    var emptyMsg = assetActiveFilter === "issued" ? "No currently issued assets. All equipment is safely returned to the lab rack." :
                   assetActiveFilter === "returned" ? "No returned assets recorded yet." :
                   "No club assets registered yet in Google Sheet.";
    var emptyHtml = '<div class="empty-state"><div class="empty-icon">🔧</div><div class="empty-text">' + emptyMsg + '</div></div>';
    tbody.innerHTML = '<tr class="loading-row"><td colspan="9">' + emptyHtml + '</td></tr>';
    mobileBox.innerHTML = emptyHtml;
    return;
  }

  tbody.innerHTML = filtered.map(function(a) {
    var astID = safeStr(a["Asset ID"]);
    var img = safeStr(a["Item Image"] || a["itemImage"] || a["imageFileID"]);
    var imgHtml = img
      ? '<img src="' + driveThumbnailURL(img) + '" style="width:40px;height:40px;object-fit:cover;border:1px solid var(--line);cursor:pointer;" class="clip-sm" onclick="openLightbox(\'' + driveViewURL(img) + '\',\'' + encodeURIComponent(a["Asset Name"]) + '\')">'
      : '<div style="width:40px;height:40px;background:var(--paper);display:flex;align-items:center;justify-content:center;font-size:18px;border:1px solid var(--line);" class="clip-sm">🔧</div>';

    var isReturned = Boolean(a["Return Date"] && String(a["Return Date"]).trim() !== "");
    var returnBtn = !isReturned
      ? '<button class="btn btn-sm btn-green" onclick="openConfirmReturnModal(\'' + astID + '\')">Return ↵</button>'
      : '—';

    return '<tr>' +
      '<td><span style="font-family:var(--mono);color:var(--cr);font-weight:700;">#' + astID + '</span></td>' +
      '<td>' + imgHtml + '</td>' +
      '<td style="font-weight:700;color:var(--ink);">' + safeStr(a["Asset Name"]) + '</td>' +
      '<td><span class="badge badge-blue">' + safeStr(a["Quantity"]) + '</span></td>' +
      '<td><strong>' + safeStr(a["Issued To"] || "Lab (Shared)") + '</strong></td>' +
      '<td style="font-family:var(--mono);font-size:11px;">' + formatDisplayDate(a["Issue Date"]) + '</td>' +
      '<td style="font-family:var(--mono);font-size:11px;">' + (isReturned ? formatDisplayDate(a["Return Date"]) : '<span style="color:var(--gd);font-weight:700;">Active</span>') + '</td>' +
      '<td style="font-size:12px;color:var(--ink3);">' + safeStr(a["Remarks"] || "—") + '</td>' +
      '<td>' +
        '<div style="display:flex;gap:4px;">' +
          returnBtn +
          '<button class="btn btn-sm btn-secondary" onclick="openEditAssetModal(\'' + astID + '\')" title="Edit Asset">✏️</button>' +
          '<button class="btn btn-sm btn-danger" onclick="deleteAssetConfirm(\'' + astID + '\')" title="Delete Asset">🗑️</button>' +
        '</div>' +
      '</td>' +
      '</tr>';
  }).join("");

  mobileBox.innerHTML = filtered.map(function(a) {
    var astID = safeStr(a["Asset ID"]);
    var img = safeStr(a["Item Image"] || a["itemImage"] || a["imageFileID"]);
    var isReturned = Boolean(a["Return Date"] && String(a["Return Date"]).trim() !== "");
    var statusBadge = isReturned
      ? '<span class="badge badge-green">Returned</span>'
      : '<span class="badge badge-yellow">Active Checkout</span>';

    return '<div class="res-card">' +
      '<div class="res-card-header">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          (img ? '<img src="' + driveThumbnailURL(img) + '" style="width:48px;height:48px;object-fit:cover;border:1px solid var(--line);" class="clip-sm" onclick="openLightbox(\'' + driveViewURL(img) + '\',\'' + encodeURIComponent(a["Asset Name"]) + '\')">' : '<div style="width:48px;height:48px;background:var(--paper);display:flex;align-items:center;justify-content:center;font-size:22px;border:1px solid var(--line);" class="clip-sm">🔧</div>') +
          '<div>' +
            '<div class="res-card-id">ASSET #' + astID + ' • QTY: ' + safeStr(a["Quantity"]) + '</div>' +
            '<div class="res-card-title">' + safeStr(a["Asset Name"]) + '</div>' +
          '</div>' +
        '</div>' +
        statusBadge +
      '</div>' +
      '<div class="res-card-grid">' +
        '<div class="res-info-block"><span class="res-info-label">ISSUED TO</span><span class="res-info-value">' + safeStr(a["Issued To"] || "Lab") + '</span></div>' +
        '<div class="res-info-block"><span class="res-info-label">ISSUE DATE</span><span class="res-info-value">' + formatDisplayDate(a["Issue Date"]) + '</span></div>' +
        '<div class="res-info-block"><span class="res-info-label">RETURN DATE</span><span class="res-info-value">' + (isReturned ? formatDisplayDate(a["Return Date"]) : '<span style="color:var(--gd);font-weight:700;">In Use</span>') + '</span></div>' +
        '<div class="res-info-block"><span class="res-info-label">REMARKS</span><span class="res-info-value">' + safeStr(a["Remarks"] || "—") + '</span></div>' +
      '</div>' +
      '<div class="res-card-footer">' +
        (!isReturned ? '<button class="btn btn-sm btn-green" onclick="openConfirmReturnModal(\'' + astID + '\')">Return ↵</button>' : '<span style="font-size:11px;color:var(--green);font-weight:700;">Returned</span>') +
        '<div style="display:flex;gap:6px;">' +
          '<button class="btn btn-sm btn-secondary" onclick="openEditAssetModal(\'' + astID + '\')">✏️ Edit</button>' +
          '<button class="btn btn-sm btn-danger" onclick="deleteAssetConfirm(\'' + astID + '\')">🗑️</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join("");
}

async function loadAssets(force) {
  var tbody = document.getElementById("assetsTable");
  var mobileBox = document.getElementById("assetsCardsMobile");

  if (allAssets && allAssets.length > 0) {
    renderAssetsList();
  } else {
    var cached = getCachedData("assets");
    if (cached && cached.length > 0) {
      allAssets = cached;
      assetRegistry = {};
      cached.forEach(function(a) { assetRegistry[a["Asset ID"]] = a; });
      renderAssetsList();
      updateDashboardUI();
    } else {
      tbody.innerHTML = '<tr class="loading-row"><td colspan="9">' + getTechLoaderHtml("Inspecting club inventory assets...") + '</td></tr>';
      mobileBox.innerHTML = '<div style="text-align:center;padding:24px;">' + getTechLoaderHtml("Inspecting club inventory assets...") + '</div>';
    }
  }

  if (_activeFetches["assets"]) return;
  var now = Date.now();
  if (!force && _cacheTimestamps["assets"] && (now - _cacheTimestamps["assets"] < 45000)) {
    return;
  }

  _activeFetches["assets"] = true;
  try {
    var res = await api({ action: "getClubAssets" });
    if (res && res.success && Array.isArray(res.data)) {
      allAssets = res.data;
      assetRegistry = {};
      allAssets.forEach(function(a) { assetRegistry[a["Asset ID"]] = a; });
      setCachedData("assets", allAssets);
      _cacheTimestamps["assets"] = Date.now();
      renderAssetsList();
      updateDashboardUI();
    } else if (!allAssets.length) {
      allAssets = [];
      assetRegistry = {};
      var emptyHtml = '<div class="empty-state"><div class="empty-icon">🔧</div><div class="empty-text">No club assets registered yet in Google Sheet.</div></div>';
      tbody.innerHTML = '<tr class="loading-row"><td colspan="9">' + emptyHtml + '</td></tr>';
      mobileBox.innerHTML = emptyHtml;
      var elCntAll = document.getElementById("assetCountAll");
      var elCntIssued = document.getElementById("assetCountIssued");
      var elCntReturned = document.getElementById("assetCountReturned");
      if (elCntAll) elCntAll.textContent = "0";
      if (elCntIssued) elCntIssued.textContent = "0";
      if (elCntReturned) elCntReturned.textContent = "0";
    }
  } catch(e) {
    console.warn("loadAssets error:", e);
  } finally {
    _activeFetches["assets"] = false;
  }
}

function openAddAssetModal() {
  clearForm(["assetName","assetQty","assetRemarks"]);
  document.getElementById("assetQty").value = "1";
  document.getElementById("assetIssueDate").value = new Date().toISOString().split("T")[0];
  document.getElementById("assetReturnDate").value = "";
  var photoInput = document.getElementById("assetPhotoFile");
  if (photoInput) photoInput.value = "";
  var previewBox = document.getElementById("assetPhotoPreviewBox");
  if (previewBox) previewBox.style.display = "none";
  populateAssetMembersDropdown();
  openModal("addAssetModal");
}

function previewAssetPhoto(input) {
  var file = input.files[0];
  var box = document.getElementById("assetPhotoPreviewBox");
  var img = document.getElementById("assetPhotoPreviewImg");
  if (!file) { box.style.display = "none"; return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    img.src = e.target.result;
    box.style.display = "block";
  };
  reader.readAsDataURL(file);
}

function previewEditAssetPhoto(input) {
  var file = input.files[0];
  var box = document.getElementById("editAssetPhotoPreviewBox");
  var img = document.getElementById("editAssetPhotoPreviewImg");
  if (!file) { box.style.display = "none"; return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    img.src = e.target.result;
    box.style.display = "block";
  };
  reader.readAsDataURL(file);
}

async function submitAsset() {
  var name = document.getElementById("assetName").value.trim();
  var qty  = document.getElementById("assetQty").value;
  var to   = document.getElementById("assetIssuedTo").value;
  var date = document.getElementById("assetIssueDate").value;
  if (!name || !qty || !to || !date) {
    toast("Name, Quantity, Issued To, and Issue Date are required.", "error");
    return;
  }

  var btn = document.getElementById("addAssetBtn") || document.getElementById("saveAssetBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Saving Asset...';
  }

  var imageFileID = "";
  var photoFile = document.getElementById("assetPhotoFile").files[0];
  if (photoFile) {
    try {
      var up = await uploadFileToAPI(photoFile, "ASSET", name);
      if (up.success) imageFileID = up.fileID;
    } catch(e) {
      console.warn("Asset photo upload note:", e);
    }
  }

  try {
    var res = await api({
      action: "addClubAsset",
      data: {
        assetName: name,
        quantity: qty,
        issuedTo: to,
        issueDate: date,
        returnDate: document.getElementById("assetReturnDate").value,
        itemImage: imageFileID,
        remarks: document.getElementById("assetRemarks").value.trim()
      }
    });

    if (res.success) {
      toast("Club asset registered successfully!", "success");
      closeModal("addAssetModal");
      document.getElementById("assetName").value = "";
      document.getElementById("assetQty").value = "1";
      document.getElementById("assetIssuedTo").value = "";
      document.getElementById("assetIssueDate").value = "";
      document.getElementById("assetReturnDate").value = "";
      document.getElementById("assetRemarks").value = "";
      var fileInput = document.getElementById("assetPhotoFile");
      if (fileInput) fileInput.value = "";
      var previewBox = document.getElementById("assetPhotoPreviewBox");
      if (previewBox) previewBox.style.display = "none";
      loadAssets();
      loadDashboardStats();
    } else {
      toast(res.message || "Failed to register asset.", "error");
    }
  } catch(e) {
    toast("Asset creation error: " + e.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Add Asset";
    }
  }
}

function openEditAssetModal(assetID) {
  var a = assetRegistry[assetID];
  if (!a) return;
  populateAssetMembersDropdown();

  document.getElementById("editAssetIdInput").value       = assetID;
  document.getElementById("editAssetName").value           = safeStr(a["Asset Name"]);
  document.getElementById("editAssetQty").value            = safeStr(a["Quantity"] || 1);
  document.getElementById("editAssetIssuedTo").value       = safeStr(a["Issued To"]);
  document.getElementById("editAssetIssueDate").value      = safeStr(a["Issue Date"]).split("T")[0];
  document.getElementById("editAssetReturnDate").value     = safeStr(a["Return Date"]).split("T")[0];
  document.getElementById("editAssetRemarks").value        = safeStr(a["Remarks"]);
  document.getElementById("editAssetExistingImage").value  = safeStr(a["Item Image"] || a["itemImage"] || a["imageFileID"]);

  var existingImg = safeStr(a["Item Image"] || a["itemImage"] || a["imageFileID"]);
  var previewBox = document.getElementById("editAssetPhotoPreviewBox");
  var previewImg = document.getElementById("editAssetPhotoPreviewImg");
  if (existingImg) {
    previewImg.src = driveThumbnailURL(existingImg);
    previewBox.style.display = "block";
  } else {
    previewBox.style.display = "none";
  }

  openModal("editAssetModal");
}

async function submitUpdateAsset() {
  var astID = document.getElementById("editAssetIdInput").value;
  var name  = document.getElementById("editAssetName").value.trim();
  var qty   = document.getElementById("editAssetQty").value;
  var to    = document.getElementById("editAssetIssuedTo").value;
  var date  = document.getElementById("editAssetIssueDate").value;
  if (!name || !qty || !to || !date) {
    toast("Asset Name, Quantity, Issued To, and Issue Date are required.", "error");
    return;
  }

  var btn = document.getElementById("updateAssetBtn");
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Updating...';

  var imageFileID = document.getElementById("editAssetExistingImage").value;
  var photoFile = document.getElementById("editAssetPhotoFile").files[0];
  if (photoFile) {
    try {
      var up = await uploadFileToAPI(photoFile, "ASSET", name);
      if (up.success) imageFileID = up.fileID;
    } catch(e) {
      console.warn("Asset photo replace note:", e);
    }
  }

  try {
    var res = await api({
      action: "updateClubAsset",
      data: {
        assetID: astID,
        assetName: name,
        quantity: qty,
        issuedTo: to,
        issueDate: date,
        returnDate: document.getElementById("editAssetReturnDate").value,
        itemImage: imageFileID,
        remarks: document.getElementById("editAssetRemarks").value.trim()
      }
    });

    if (res.success) {
      toast(res.message || "Asset updated successfully!", "success");
      closeModal("editAssetModal");
      loadAssets();
    } else {
      toast(res.message || "Update failed.", "error");
    }
  } catch(e) {
    toast("Update error: " + e.message, "error");
  }

  btn.disabled = false;
  btn.textContent = "Update Asset";
}

async function deleteAssetConfirm(assetID) {
  if (!confirm("Are you sure you want to delete Asset #" + assetID + " from inventory?")) return;
  try {
    var res = await api({ action: "deleteClubAsset", data: { assetID: assetID } });
    if (res.success) {
      toast(res.message || "Asset removed from inventory.", "success");
      loadAssets();
      loadDashboardStats();
    } else {
      toast(res.message || "Delete failed.", "error");
    }
  } catch(e) {
    toast("Delete error: " + e.message, "error");
  }
}

function openConfirmReturnModal(assetID) {
  var ast = assetRegistry[assetID] || allAssets.find(function(a) { return String(a["Asset ID"]) === String(assetID); });
  if (!ast) {
    toast("Asset details not found.", "error");
    return;
  }
  currentReturnAssetId = String(assetID);

  var idEl = document.getElementById("confirmReturnAssetId");
  if (idEl) idEl.textContent = "ASSET #" + assetID;
  var nameEl = document.getElementById("confirmReturnAssetName");
  if (nameEl) nameEl.textContent = safeStr(ast["Asset Name"] || "Club Asset");
  var toEl = document.getElementById("confirmReturnIssuedTo");
  if (toEl) toEl.textContent = safeStr(ast["Issued To"] || "Lab / Member");
  var qtyEl = document.getElementById("confirmReturnQty");
  if (qtyEl) qtyEl.textContent = safeStr(ast["Quantity"] || "1");

  var imgBox = document.getElementById("confirmReturnImgBox");
  if (imgBox) {
    var img = safeStr(ast["Item Image"] || ast["itemImage"] || ast["imageFileID"]);
    imgBox.innerHTML = img
      ? '<img src="' + driveThumbnailURL(img) + '" style="width:100%;height:100%;object-fit:cover;" class="clip-sm">'
      : '<span style="font-size:24px;">🔧</span>';
  }

  var dateInput = document.getElementById("confirmReturnDate");
  if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
  var remarksInput = document.getElementById("confirmReturnRemarks");
  if (remarksInput) remarksInput.value = "";

  var btn = document.getElementById("confirmReturnSubmitBtn");
  if (btn) {
    btn.disabled = false;
    btn.textContent = "Confirm Return ↵";
  }

  openModal("confirmReturnModal");
}

async function submitConfirmReturn() {
  if (!currentReturnAssetId) return;

  var dateInput = document.getElementById("confirmReturnDate");
  var returnDate = (dateInput ? dateInput.value : "") || new Date().toISOString().split("T")[0];
  var remarksInput = document.getElementById("confirmReturnRemarks");
  var remarks = remarksInput ? remarksInput.value.trim() : "";

  var btn = document.getElementById("confirmReturnSubmitBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Confirming Return...';
  }

  try {
    var res = await api({
      action: "returnClubAsset",
      data: {
        assetID: currentReturnAssetId,
        returnDate: returnDate,
        remarks: remarks
      }
    });

    if (res.success) {
      toast(res.message || "Asset returned and inventory updated!", "success");
      closeModal("confirmReturnModal");
      await loadAssets();
      loadDashboardStats();
    } else {
      toast(res.message || "Return failed. Please try again.", "error");
    }
  } catch (e) {
    toast("Return error: " + e.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Confirm Return ↵";
    }
  }
}

// ============================================================
// BACKEND CONFIG & STANDALONE HTML EXPORT
// ============================================================
function saveCustomApiUrl() {
  var url = document.getElementById("apiUrlInput").value.trim();
  if (!url) { toast("Please enter a valid Google Apps Script Web App URL.", "error"); return; }
  API_URL = url;
  localStorage.setItem("techvipers_api_url", url);
  toast("Google Apps Script URL updated!", "success");
  closeModal("setupModal");
  loadTeamMembersList();
  loadDashboardStats();
}

function clearForm(ids) {
  ids.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = "";
  });
}

async function downloadSingleHtml() {
  toast("Packaging standalone HTML with all assets...", "info");
  try {
    var htmlRes = await fetch("/index.html");
    var htmlText = await htmlRes.text();
    var cssRes  = await fetch("/src/style.css");
    var cssText  = await cssRes.text();
    var jsRes   = await fetch("/src/app.js");
    var jsText   = await jsRes.text();

    htmlText = htmlText.replace('<link rel="stylesheet" href="/src/style.css">', '<style>\n' + cssText + '\n</style>');
    htmlText = htmlText.replace('<script type="module" src="/src/app.js"></script>', '<script>\n' + jsText + '\n</script>');

    var blob = new Blob([htmlText], { type: "text/html;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tech_vipers_hub_standalone.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("Downloaded tech_vipers_hub_standalone.html! Open directly in any browser.", "success");
  } catch(e) {
    toast("Download error: " + e.message, "error");
  }
}

// ============================================================
// PDF STATEMENT GENERATOR
// ============================================================

async function downloadStatementPDF() {
  if (!session) {
    toast("Please log in to generate your statement.", "error");
    return;
  }

  var list = allTransactions || [];
  if (!list.length) {
    showLoader("Fetching your transactions for statement...");
    try {
      var res = await api({ action: "getMyTransactions", memberID: session.memberID });
      if (res && res.success && Array.isArray(res.data) && res.data.length) {
        allTransactions = res.data;
        list = allTransactions;
        renderTransactionsList();
      }
    } catch(e) {}
    hideLoader();
  }

  if (!list || !list.length) {
    toast("No transaction records found for your account yet.", "warning");
    return;
  }

  var totalDues = 0;
  var totalPaid = 0;
  var totalPending = 0;
  var paidCount = 0;
  var pendingCount = 0;

  list.forEach(function(t) {
    var amt = safeFloat(t["Share Amount"]);
    totalDues += amt;
    var status = safeStr(t["Payment Status"] || "Pending").toLowerCase();
    if (status === "paid") {
      totalPaid += amt;
      paidCount++;
    } else {
      totalPending += amt;
      pendingCount++;
    }
  });

  var stmtDate = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  var stmtTime = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  });
  var stmtRef = "TV-STM-" + (session.memberID || "MEM") + "-" + Date.now().toString().slice(-6);

  var rowsHtml = list.map(function(t, idx) {
    var status = safeStr(t["Payment Status"] || "Pending").toLowerCase();
    var isPaid = status === "paid";
    var statusBadge = isPaid
      ? '<span style="display:inline-block;padding:3px 8px;border-radius:4px;background:#ecfdf5;color:#059669;font-weight:700;font-size:11px;border:1px solid #a7f3d0;">PAID</span>'
      : '<span style="display:inline-block;padding:3px 8px;border-radius:4px;background:#fef2f2;color:#dc2626;font-weight:700;font-size:11px;border:1px solid #fecaca;">PENDING</span>';

    return '<tr style="border-bottom:1px solid #e2e8f0;' + (idx % 2 === 1 ? 'background:#f8fafc;' : '') + '">' +
      '<td style="padding:10px 8px;font-family:monospace;font-size:11px;color:#64748b;">#' + (idx + 1) + '</td>' +
      '<td style="padding:10px 8px;font-weight:600;color:#0f172a;font-size:12.5px;">' + safeStr(t["Item Name"] || "Robotics Hardware Component") + '</td>' +
      '<td style="padding:10px 8px;color:#475569;font-size:11.5px;">' + safeStr(t.submitterName || "Team Lead") + (t.submitterUPI ? '<br><small style="color:#64748b;font-family:monospace;">' + safeStr(t.submitterUPI) + '</small>' : '') + '</td>' +
      '<td style="padding:10px 8px;text-align:right;font-weight:800;font-family:monospace;font-size:13px;color:#0f172a;">₹ ' + safeFloat(t["Share Amount"]).toFixed(2) + '</td>' +
      '<td style="padding:10px 8px;text-align:center;">' + statusBadge + '</td>' +
      '<td style="padding:10px 8px;font-size:11px;color:#64748b;white-space:nowrap;">' + formatDisplayDate(t["Payment Date"]) + '</td>' +
      '<td style="padding:10px 8px;font-family:monospace;font-size:11px;color:#334155;">' + (safeStr(t.utrNumber) || '—') + '</td>' +
    '</tr>';
  }).join("");

  var printDocHtml = '<!DOCTYPE html>' +
    '<html><head><meta charset="utf-8">' +
    '<title>Transaction Statement - ' + safeStr(session.fullName || "Member") + '</title>' +
    '<style>' +
    '@page { size: A4; margin: 12mm 10mm; }' +
    'body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; background: #ffffff; }' +
    '.toolbar { display: flex; justify-content: space-between; align-items: center; background: #0a0f1d; padding: 12px 18px; border-radius: 8px; margin-bottom: 20px; color: #ffffff; }' +
    '.btn-print { background: linear-gradient(135deg, #0077fe 0%, #00c4cc 100%); color: #ffffff; border: none; padding: 9px 22px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 13px; box-shadow: 0 4px 12px rgba(0,119,254,0.3); }' +
    '.btn-close { background: rgba(255,255,255,0.15); color: #ffffff; border: none; padding: 9px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; }' +
    '.statement-box { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }' +
    '.header-top-bar { height: 5px; background: linear-gradient(90deg, #00c4cc 0%, #0077fe 50%, #7c3aed 100%); }' +
    '.header-section { padding: 22px 28px 18px 28px; background: #0a0f1d; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,119,254,0.25); color: #ffffff; }' +
    '.header-logo { height: 44px; object-fit: contain; }' +
    '.statement-title { font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: #ffffff; text-align: right; }' +
    '.statement-sub { font-size: 11px; font-family: monospace; color: #00c4cc; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 4px; text-align: right; }' +
    '.info-grid { display: flex; justify-content: space-between; gap: 20px; padding: 20px 28px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }' +
    '.summary-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; padding: 18px 28px; border-bottom: 1px solid #e2e8f0; }' +
    '.summary-card { padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center; }' +
    '.table-wrap { padding: 20px 28px; overflow-x: auto; }' +
    'table { width: 100%; border-collapse: collapse; text-align: left; }' +
    'th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #475569; padding: 10px 8px; border-bottom: 2px solid #cbd5e1; font-weight: 700; background: #f1f5f9; }' +
    '.footer-notice { padding: 18px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.6; text-align: center; }' +
    '@media print { .toolbar { display: none !important; } body { padding: 0; } .statement-box { border: none; box-shadow: none; } }' +
    '</style></head><body>' +
    '<div class="toolbar">' +
      '<div style="font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px;">📄 TECH VIPERS Transaction Statement</div>' +
      '<div style="display:flex;gap:10px;">' +
        '<button class="btn-print" onclick="window.print()">🖨️ Save as PDF / Print</button>' +
        '<button class="btn-close" onclick="window.close()">✕ Close</button>' +
      '</div>' +
    '</div>' +
    '<div class="statement-box">' +
      '<div class="header-top-bar"></div>' +
      '<div class="header-section">' +
        '<div>' +
          '<img src="https://drive.google.com/thumbnail?id=1yH9Lm-vHDQYDMRXDm21m0ucr3BkPbOuK" alt="TECH VIPERS" class="header-logo">' +
          '<div style="font-family:monospace;font-size:10px;color:#94a3b8;margin-top:6px;">ROBOTICS OPERATIONS HUB • ACCOUNT LEDGER</div>' +
        '</div>' +
        '<div>' +
          '<div class="statement-title">TRANSACTION STATEMENT</div>' +
          '<div class="statement-sub">REF: ' + stmtRef + '</div>' +
          '<div style="font-size:11px;color:#cbd5e1;text-align:right;margin-top:2px;">Issued: ' + stmtDate + ' ' + stmtTime + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="info-grid">' +
        '<div>' +
          '<div style="font-size:10.5px;font-family:monospace;color:#64748b;text-transform:uppercase;font-weight:700;margin-bottom:4px;">ACCOUNT HOLDER / MEMBER</div>' +
          '<div style="font-size:16px;font-weight:800;color:#0f172a;">' + safeStr(session.fullName || "Team Member") + '</div>' +
          '<div style="font-size:12px;color:#475569;margin-top:2px;">Member ID: <strong>' + formatMemberID(session.memberID) + '</strong></div>' +
          '<div style="font-size:12px;color:#475569;">Email: ' + safeStr(session.email || "—") + '</div>' +
          '<div style="font-size:12px;color:#475569;">Phone: ' + safeStr(session.phone || "—") + '</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="font-size:10.5px;font-family:monospace;color:#64748b;text-transform:uppercase;font-weight:700;margin-bottom:4px;">ACCOUNT SUMMARY</div>' +
          '<div style="font-size:13px;color:#334155;">Member UPI: <strong>' + safeStr(session.upiHandle || "—") + '</strong></div>' +
          '<div style="font-size:12px;color:#64748b;margin-top:4px;">Total Split Records: <strong>' + list.length + '</strong></div>' +
          '<div style="font-size:12px;color:#059669;">Settled Items: <strong>' + paidCount + '</strong></div>' +
          '<div style="font-size:12px;color:#dc2626;">Pending Items: <strong>' + pendingCount + '</strong></div>' +
        '</div>' +
      '</div>' +
      '<div class="summary-cards">' +
        '<div class="summary-card" style="background:#f0f9ff;border-color:#bae6fd;">' +
          '<div style="font-size:10.5px;font-family:monospace;font-weight:700;color:#0284c7;text-transform:uppercase;">TOTAL DUES ALLOCATED</div>' +
          '<div style="font-size:22px;font-weight:800;font-family:monospace;color:#0369a1;margin-top:4px;">₹ ' + totalDues.toFixed(2) + '</div>' +
          '<div style="font-size:11px;color:#64748b;margin-top:2px;">' + list.length + ' Total Expenses</div>' +
        '</div>' +
        '<div class="summary-card" style="background:#ecfdf5;border-color:#a7f3d0;">' +
          '<div style="font-size:10.5px;font-family:monospace;font-weight:700;color:#059669;text-transform:uppercase;">TOTAL AMOUNT PAID</div>' +
          '<div style="font-size:22px;font-weight:800;font-family:monospace;color:#047857;margin-top:4px;">₹ ' + totalPaid.toFixed(2) + '</div>' +
          '<div style="font-size:11px;color:#059669;margin-top:2px;">' + paidCount + ' Cleared Dues</div>' +
        '</div>' +
        '<div class="summary-card" style="background:#fef2f2;border-color:#fecaca;">' +
          '<div style="font-size:10.5px;font-family:monospace;font-weight:700;color:#dc2626;text-transform:uppercase;">OUTSTANDING PENDING</div>' +
          '<div style="font-size:22px;font-weight:800;font-family:monospace;color:#b91c1c;margin-top:4px;">₹ ' + totalPending.toFixed(2) + '</div>' +
          '<div style="font-size:11px;color:#dc2626;margin-top:2px;">' + pendingCount + ' Awaiting Clearance</div>' +
        '</div>' +
      '</div>' +
      '<div class="table-wrap">' +
        '<div style="font-size:12px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">ITEMIZED EXPENSE SPLIT RECORDS</div>' +
        '<table>' +
          '<thead>' +
            '<tr>' +
              '<th style="width:36px;">#</th>' +
              '<th>EXPENSE ITEM / HARDWARE</th>' +
              '<th>PAYEE / PURCHASER</th>' +
              '<th style="text-align:right;">YOUR SHARE</th>' +
              '<th style="text-align:center;">STATUS</th>' +
              '<th>PAYMENT DATE</th>' +
              '<th>UTR REF</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>' +
      '<div class="footer-notice">' +
        '<div style="font-weight:700;color:#0f172a;margin-bottom:3px;">TECH VIPERS Robotics Team Hub • Automated Cloud Ledger</div>' +
        '<div>This statement is computer-generated from Google Sheets and requires no physical signature. For payment verifications, ensure your 12-digit UTR reference is submitted on the portal.</div>' +
      '</div>' +
    '</div>' +
    '</body></html>';

  var printWin = window.open("", "_blank");
  if (printWin) {
    printWin.document.open();
    printWin.document.write(printDocHtml);
    printWin.document.close();
    setTimeout(function() {
      try {
        printWin.focus();
        printWin.print();
      } catch (err) {}
    }, 400);
  } else {
    var iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);
    var doc = iframe.contentWindow.document;
    doc.open();
    doc.write(printDocHtml);
    doc.close();
    setTimeout(function() {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {}
    }, 400);
  }
}

// ── Startup Initialization ──
function initApp() {
  initTheme();

  localStorage.removeItem("tv_mock_members");
  localStorage.removeItem("tv_mock_expenses");
  localStorage.removeItem("tv_mock_media");
  localStorage.removeItem("tv_mock_events");
  localStorage.removeItem("tv_mock_assets");

  allExpensesList = getCachedData("expenses") || [];
  allTransactions = getCachedData("transactions") || [];
  allMedia        = getCachedData("media") || [];
  allEvents       = getCachedData("events") || [];
  allAssets       = getCachedData("assets") || [];
  allMembers      = getCachedData("members") || [];

  if (allExpensesList.length) {
    allExpensesMap = {};
    allExpensesList.forEach(function(e) { allExpensesMap[e["Expense ID"]] = e; });
  }
  if (allTransactions.length) {
    txRegistry = {};
    allTransactions.forEach(function(t) { txRegistry[t["Expense ID"]] = t; });
  }

  var saved = localStorage.getItem("techvipers_session");
  if (saved) {
    try {
      session = JSON.parse(saved);
      if (session && session.fullName && (session.fullName.includes("@") || /^\+?\d{7,15}$/.test(session.fullName))) {
        session.fullName = getMemberDisplayName(session);
        localStorage.setItem("techvipers_session", JSON.stringify(session));
      }
      showApp();
      updateDashboardUI();
    } catch(e) {
      localStorage.removeItem("techvipers_session");
    }
  }

  var qtyEl = document.getElementById("expQty");
  var priceEl = document.getElementById("expPrice");
  if (qtyEl) qtyEl.addEventListener("input", calcExpenseTotal);
  if (priceEl) priceEl.addEventListener("input", calcExpenseTotal);

  document.querySelectorAll(".overlay").forEach(function(o) {
    o.addEventListener("click", function(e) {
      if (e.target === o) o.classList.remove("open");
    });
  });

  document.addEventListener("click", function(e) {
    var nav = document.getElementById("mobileMenuOverlay");
    var btn = document.getElementById("hamburgerBtn");
    if (nav && nav.classList.contains("open") && !nav.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      closeMobileNav();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

// Global window bindings
window.closeLightbox          = closeLightbox;
window.closeModal             = closeModal;
window.openModal              = openModal;
window.switchAuthTab          = switchAuthTab;
window.sendResetOTP           = sendResetOTP;
window.submitPasswordReset    = submitPasswordReset;
window.doLogin                = doLogin;
window.doRegister             = doRegister;
window.togglePwVisibility     = togglePwVisibility;
window.checkRegPwStrength     = checkRegPwStrength;
window.toggleMobileNav        = toggleMobileNav;
window.closeMobileNav         = closeMobileNav;
window.toggleProfileDropdown  = toggleProfileDropdown;
window.closeProfileDropdown   = closeProfileDropdown;
window.handleProfileBadgeClick= toggleProfileDropdown;
window.doLogout               = doLogout;
window.showSection            = showSection;
window.filterExpenses         = filterExpenses;
window.openSplitsModal        = openSplitsModal;
window.filterTransactions     = filterTransactions;
window.openPayModal           = openPayModal;
window.openBatchPayModal      = openBatchPayModal;
window.filterMedia            = filterMedia;
window.setMediaViewLayout     = setMediaViewLayout;
window.initMediaLayout        = initMediaLayout;
window.previewSelectedMedia   = previewSelectedMedia;
window.submitMedia            = submitMedia;
window.openAddEventModal      = openAddEventModal;
window.filterEvents           = filterEvents;
window.filterAssets           = filterAssets;
window.openAddAssetModal      = openAddAssetModal;
window.openEditAssetModal     = openEditAssetModal;
window.deleteAssetConfirm     = deleteAssetConfirm;
window.submitExpense          = submitExpense;
window.remindAllSplits        = sendAllDueRemindersNow;
window.sendAllDueRemindersNow = sendAllDueRemindersNow;
window.sendSingleReminder     = sendSingleReminder;
window.downloadStatementPDF   = downloadStatementPDF;
window.downloadStatement      = downloadStatementPDF;
window.downloadInvoice        = downloadStatementPDF;
window.copyUPI                = copyUPI;
window.copyPayUpi             = copyPayUpi;
window.previewPayProof        = previewPayProof;
window.submitPayment          = submitPayment;
window.submitPaymentProof     = submitPayment;
window.submitEvent            = submitEvent;
window.openEditEventModal     = openEditEventModal;
window.submitUpdateEvent      = submitUpdateEvent;
window.deleteEventConfirm     = deleteEventConfirm;
window.broadcastEventEmail    = broadcastEventEmail;
window.previewAssetPhoto      = previewAssetPhoto;
window.previewEditAssetPhoto  = previewEditAssetPhoto;
window.submitAsset            = submitAsset;
window.submitAddAsset         = submitAsset;
window.submitUpdateAsset      = submitUpdateAsset;
window.openConfirmReturnModal = openConfirmReturnModal;
window.submitConfirmReturn    = submitConfirmReturn;
window.saveCustomApiUrl       = saveCustomApiUrl;
window.downloadSingleHtml     = downloadSingleHtml;
window.openLightbox           = openLightbox;
window.calcExpenseTotal       = calcExpenseTotal;
window.loadDashboardStats     = loadDashboardStats;
window.updateDashboardUI      = updateDashboardUI;


