const SEEN_KEY = "charge-tracker-seen-at";

const state = {
  data: null,
  query: "",
  filter: "all",
  seenAt: localStorage.getItem(SEEN_KEY) || "",
};

const els = {
  pills: document.getElementById("status-pills"),
  search: document.getElementById("search"),
  kpis: document.getElementById("kpis"),
  people: document.getElementById("people"),
  byDay: document.getElementById("by-day"),
  recent: document.getElementById("recent"),
  generated: document.getElementById("generated"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isNew(person) {
  if (!person.completedAt) {
    return false;
  }
  if (!state.seenAt) {
    return true;
  }
  return person.completedAt > state.seenAt;
}

function filteredPeople() {
  const query = state.query.trim().toLowerCase();
  return (state.data.people || []).filter((person) => {
    const nameOk = !query || person.name.toLowerCase().includes(query);
    const statusOk = state.filter === "all" || (state.filter === "completed" && person.completed);
    return nameOk && statusOk;
  });
}

function renderPills() {
  const total = state.data.people.length;
  const options = [
    { id: "all", label: `All · ${total}` },
    { id: "completed", label: `Completed · ${total}` },
  ];
  els.pills.innerHTML = "";
  options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "pill";
    button.type = "button";
    button.textContent = option.label;
    button.setAttribute("aria-pressed", String(option.id === state.filter));
    button.addEventListener("click", () => {
      state.filter = option.id;
      render();
    });
    els.pills.appendChild(button);
  });
}

function renderKpis(rows) {
  const latest = state.data.kpis.latestLabel || "—";
  const cards = [
    {
      label: "Completed",
      value: String(rows.filter((row) => row.completed).length),
      note: "Unique respondents in the form export",
    },
    {
      label: "Latest response",
      value: latest || "—",
      note: "Most recent completion time",
    },
    {
      label: "Data refresh",
      value: (state.data.meta.generatedAt || "").slice(0, 10) || "—",
      note: "When this page was last rebuilt",
    },
  ];

  els.kpis.innerHTML = cards
    .map(
      (card) => `
        <article class="kpi">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
          <em>${escapeHtml(card.note)}</em>
        </article>
      `,
    )
    .join("");
}

function renderPeople(rows) {
  if (!rows.length) {
    els.people.innerHTML = `<p class="empty">${escapeHtml(
      state.data.meta.note || "No respondents yet.",
    )}</p>`;
    return;
  }

  els.people.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Respondent</th>
          <th>Status</th>
          <th>Completed</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((person) => {
            const fresh = isNew(person)
              ? `<span class="badge new">New</span>`
              : "";
            return `
              <tr>
                <td class="name">${escapeHtml(person.name)}${fresh}</td>
                <td>
                  <span class="badge done">${person.completed ? "Completed" : "Not completed"}</span>
                </td>
                <td class="when">${escapeHtml(person.completedLabel || "—")}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function renderByDay() {
  const buckets = state.data.byDay || [];
  if (!buckets.length) {
    els.byDay.innerHTML = `<p class="empty">No completion dates yet.</p>`;
    return;
  }
  const max = Math.max(...buckets.map((item) => item.count), 1);
  els.byDay.innerHTML = buckets
    .map((item) => {
      const width = Math.max(6, (item.count / max) * 100);
      return `
        <div class="bar-row">
          <span>${escapeHtml(item.day)}</span>
          <div class="track"><div class="fill" style="width:${width}%"></div></div>
          <span>${item.count}</span>
        </div>
      `;
    })
    .join("");
}

function renderRecent(rows) {
  const top = rows.slice(0, 8);
  if (!top.length) {
    els.recent.innerHTML = `<p class="empty">No responses yet.</p>`;
    return;
  }
  els.recent.innerHTML = top
    .map((person) => {
      const fresh = isNew(person) ? `<span class="badge new">New</span>` : "";
      return `
        <div class="recent-row">
          <strong>${escapeHtml(person.name)}${fresh}</strong>
          <span>${escapeHtml(person.completedLabel || "Completed")}</span>
        </div>
      `;
    })
    .join("");
}

function markSeen() {
  const latest = state.data.kpis.latestAt;
  if (latest) {
    localStorage.setItem(SEEN_KEY, latest);
  }
}

function render() {
  const rows = filteredPeople();
  renderPills();
  renderKpis(rows);
  renderPeople(rows);
  renderByDay();
  renderRecent(state.data.people || []);
}

els.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

window.addEventListener("pagehide", markSeen);

async function init() {
  const response = await fetch("data/charges.json");
  state.data = await response.json();
  els.generated.textContent = `Updated ${state.data.meta.generatedAt}. ${state.data.meta.privacy}`;
  render();
}

init().catch((error) => {
  document.body.insertAdjacentHTML(
    "beforeend",
    `<p class="wrap" style="color:#e4b15c">Could not load data/charges.json. ${escapeHtml(error.message)}</p>`,
  );
});
