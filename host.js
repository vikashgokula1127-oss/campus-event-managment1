import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginPanel = document.getElementById("loginPanel");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const logoutButton = document.getElementById("logoutButton");
const loginStatus = document.getElementById("loginStatus");
const eventForm = document.getElementById("eventForm");
const hostEvents = document.getElementById("hostEvents");
const registrationsBody = document.getElementById("registrationsBody");
const registrationEmpty = document.getElementById("registrationEmpty");
const eventFilter = document.getElementById("eventFilter");
const toast = document.getElementById("toast");

let events = [];
let registrations = [];

function esc(value) {
  return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value + "T00:00:00");
  return d.toLocaleDateString("en-IN", {day:"2-digit", month:"short", year:"numeric"});
}

function formatTimestamp(ts) {
  if (!ts?.toDate) return "";
  return ts.toDate().toLocaleString("en-IN");
}

loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  loginStatus.textContent = "Signing in...";
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById("loginEmail").value.trim(),
      document.getElementById("loginPassword").value
    );
    loginStatus.textContent = "";
  } catch (error) {
    console.error(error);
    loginStatus.textContent = error.code + " - " + error.message;
  }
});

logoutButton.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async user => {
  if (user) {
    loginPanel.classList.add("hidden");
    dashboard.classList.remove("hidden");
    logoutButton.classList.remove("hidden");
    await loadDashboard();
  } else {
    loginPanel.classList.remove("hidden");
    dashboard.classList.add("hidden");
    logoutButton.classList.add("hidden");
  }
});

async function loadDashboard() {
  try {
    const eventSnap = await getDocs(query(collection(db, "events"), orderBy("date", "asc")));
    events = eventSnap.docs.map(d => ({id:d.id, ...d.data()}));

    const regSnap = await getDocs(query(collection(db, "registrations"), orderBy("registeredAt", "desc")));
    registrations = regSnap.docs.map(d => ({id:d.id, ...d.data()}));

    document.getElementById("totalEvents").textContent = events.length;
    document.getElementById("totalRegistrations").textContent = registrations.length;

    renderEvents();
    renderFilter();
    renderRegistrations();
  } catch (error) {
    console.error(error);
    showToast("Could not load dashboard data.");
  }
}

function renderEvents() {
  hostEvents.innerHTML = events.map(event => `
    <div class="host-event-row">
      <div>
        <h3>${esc(event.name)}</h3>
        <p>📅 ${esc(formatDate(event.date))} • ⏰ ${esc(event.time)} • 📍 ${esc(event.venue)}</p>
      </div>
      <div class="card-actions">
        <button class="small-button edit" data-edit="${esc(event.id)}">Edit</button>
        <button class="small-button delete" data-delete="${esc(event.id)}">Delete</button>
      </div>
    </div>
  `).join("") || `<p class="empty">No events created.</p>`;

  hostEvents.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => startEdit(btn.dataset.edit));
  });
  hostEvents.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", () => deleteEvent(btn.dataset.delete));
  });
}

function renderFilter() {
  eventFilter.innerHTML = `<option value="all">All Events</option>` +
    events.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join("");
}

function renderRegistrations() {
  const selected = eventFilter.value;
  const rows = registrations.filter(r => selected === "all" || r.eventId === selected);

  registrationsBody.innerHTML = rows.map(r => `
    <tr>
      <td>${esc(r.studentName)}</td>
      <td>${esc(r.rollNumber)}</td>
      <td>${esc(r.email)}</td>
      <td>${esc(r.eventName)}</td>
      <td>${esc(formatTimestamp(r.registeredAt))}</td>
    </tr>
  `).join("");

  registrationEmpty.classList.toggle("hidden", rows.length !== 0);
}

eventFilter.addEventListener("change", renderRegistrations);

eventForm.addEventListener("submit", async e => {
  e.preventDefault();

  const id = document.getElementById("editingId").value;
  const data = {
    name: document.getElementById("eventName").value.trim(),
    date: document.getElementById("eventDate").value,
    time: document.getElementById("eventTime").value,
    venue: document.getElementById("eventVenue").value.trim(),
    description: document.getElementById("eventDescription").value.trim(),
    imageUrl: document.getElementById("eventImageUrl").value.trim()
  };

  const button = document.getElementById("saveEventButton");
  button.disabled = true;

  try {
    if (id) {
      await updateDoc(doc(db, "events", id), data);
      showToast("Event updated.");
    } else {
      await addDoc(collection(db, "events"), {
        ...data,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
      });
      showToast("Event created.");
    }

    resetEventForm();
    await loadDashboard();
  } catch (error) {
    console.error(error);
    showToast("Could not save event.");
  } finally {
    button.disabled = false;
  }
});

function startEdit(id) {
  const event = events.find(e => e.id === id);
  if (!event) return;

  document.getElementById("editingId").value = id;
  document.getElementById("eventName").value = event.name || "";
  document.getElementById("eventDate").value = event.date || "";
  document.getElementById("eventTime").value = event.time || "";
  document.getElementById("eventVenue").value = event.venue || "";
  document.getElementById("eventDescription").value = event.description || "";
  document.getElementById("eventImageUrl").value = event.imageUrl || "";
  document.getElementById("formTitle").textContent = "Edit Event";
  document.getElementById("saveEventButton").textContent = "Update Event";
  document.getElementById("cancelEdit").classList.remove("hidden");
  window.scrollTo({top: 300, behavior:"smooth"});
}

document.getElementById("cancelEdit").addEventListener("click", resetEventForm);

function resetEventForm() {
  eventForm.reset();
  document.getElementById("editingId").value = "";
  document.getElementById("formTitle").textContent = "Create Event";
  document.getElementById("saveEventButton").textContent = "Create Event";
  document.getElementById("cancelEdit").classList.add("hidden");
}

async function deleteEvent(id) {
  const event = events.find(e => e.id === id);
  if (!event || !confirm(`Delete "${event.name}"?`)) return;

  try {
    await deleteDoc(doc(db, "events", id));
    showToast("Event deleted.");
    await loadDashboard();
  } catch (error) {
    console.error(error);
    showToast("Could not delete event.");
  }
}
