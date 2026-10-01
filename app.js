import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, query, orderBy, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const grid = document.getElementById("eventsGrid");
const count = document.getElementById("eventCount");
const empty = document.getElementById("emptyMessage");
const modal = document.getElementById("registerModal");
const closeModal = document.getElementById("closeModal");
const form = document.getElementById("registrationForm");
const eventIdInput = document.getElementById("registerEventId");
const modalEventName = document.getElementById("modalEventName");
const toast = document.getElementById("toast");

let events = [];

function esc(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

async function loadEvents() {
  try {
    const q = query(collection(db, "events"), orderBy("date", "asc"));
    const snap = await getDocs(q);
    events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEvents();
  } catch (error) {
    console.error(error);
    count.textContent = "Error";
    empty.textContent = "Could not load events. Check the Firebase setup.";
    empty.classList.remove("hidden");
  }
}

function renderEvents() {
  count.textContent = `${events.length} ${events.length === 1 ? "event" : "events"}`;
  empty.classList.toggle("hidden", events.length !== 0);

  grid.innerHTML = events.map(event => `
    <article class="event-card">
      <div class="event-image">${event.imageUrl
        ? `<img src="${esc(event.imageUrl)}" alt="${esc(event.name)}">`
        : `<span>Campus Event</span>`}</div>
      <div class="event-body">
        <h3>${esc(event.name)}</h3>
        <p class="event-meta">📅 ${esc(formatDate(event.date))}</p>
        <p class="event-meta">⏰ ${esc(event.time)}</p>
        <p class="event-meta">📍 ${esc(event.venue)}</p>
        <p class="event-description">${esc(event.description)}</p>
        <button class="small-button" data-register="${esc(event.id)}">Register</button>
      </div>
    </article>
  `).join("");

  grid.querySelectorAll("[data-register]").forEach(button => {
    button.addEventListener("click", () => openRegistration(button.dataset.register));
  });
}

function openRegistration(id) {
  const event = events.find(e => e.id === id);
  if (!event) return;
  eventIdInput.value = event.id;
  modalEventName.textContent = event.name;
  modal.classList.remove("hidden");
}

function closeRegistration() {
  modal.classList.add("hidden");
  form.reset();
}

closeModal.addEventListener("click", closeRegistration);
modal.addEventListener("click", e => {
  if (e.target === modal) closeRegistration();
});

form.addEventListener("submit", async e => {
  e.preventDefault();

  const event = events.find(x => x.id === eventIdInput.value);
  if (!event) return;

  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  submit.textContent = "Registering...";

  try {
    await addDoc(collection(db, "registrations"), {
      eventId: event.id,
      eventName: event.name,
      studentName: document.getElementById("studentName").value.trim(),
      rollNumber: document.getElementById("rollNumber").value.trim(),
      email: document.getElementById("studentEmail").value.trim(),
      registeredAt: serverTimestamp()
    });

    closeRegistration();
    showToast("Registration successful!");
  } catch (error) {
    console.error(error);
    showToast("Registration failed. Please try again.");
  } finally {
    submit.disabled = false;
    submit.textContent = "Submit Registration";
  }
});

loadEvents();
