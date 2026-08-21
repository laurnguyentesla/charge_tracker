function now() {
  return new Date();
}

function monthKey(date = now()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date = now()) {
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function labelForKey(key) {
  const [year, month] = key.split("-").map(Number);
  return monthLabel(new Date(year, month - 1, 1));
}

const PAGE = document.body.dataset.page || "spotlight";
const SOURCE = document.body.dataset.source || "data/charges.json";
const IS_GUILD = PAGE === "guild";

function formName() {
  if (PAGE === "guild") {
    return "Grow with Guild";
  }
  if (PAGE === "pathways") {
    return "Pathways to Success";
  }
  return "Employee Spotlight";
}

function seenKey() {
  return `${PAGE}-seen-at-${monthKey()}`;
}

const state = {
  data: null,
  query: "",
  tab: "all",
  monthKey: monthKey(),
  seenAt: "",
};

const els = {
  period: document.getElementById("period"),
  lede: document.getElementById("lede"),
  tabs: document.getElementById("view-tabs"),
  search: document.getElementById("search"),
  kpis: document.getElementById("kpis"),
  peopleHeading: document.getElementById("people-heading"),
  peopleCaption: document.getElementById("people-caption"),
  people: document.getElementById("people"),
  byDayCaption: document.getElementById("by-day-caption"),
  byDay: document.getElementById("by-day"),
  recentCaption: document.getElementById("recent-caption"),
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

function inCurrentMonth(person) {
  return Boolean(person.completedAt) && person.completedAt.slice(0, 7) === state.monthKey;
}

function allPeople() {
  return state.data.people || [];
}

function monthPeople() {
  return allPeople().filter(inCurrentMonth);
}

function activePeople() {
  return state.tab === "current" ? monthPeople() : allPeople();
}

function isNew(person) {
  if (!person.completedAt || !inCurrentMonth(person)) {
    return false;
  }
  if (!state.seenAt) {
    return true;
  }
  return person.completedAt > state.seenAt;
}

function filteredPeople() {
  const query = state.query.trim().toLowerCase();
  return activePeople().filter((person) => !query || person.name.toLowerCase().includes(query));
}

function latestIn(rows) {
  return rows.reduce((best, person) => {
    if (!person.completedAt) {
      return best;
    }
    if (!best || person.completedAt > best.completedAt) {
      return person;
    }
    return best;
  }, null);
}

function byDay(rows) {
  const counts = {};
  rows.forEach((person) => {
    const day = (person.completedAt || "").slice(0, 10);
    if (!day) {
      return;
    }
    counts[day] = (counts[day] || 0) + 1;
  });
  return Object.keys(counts)
    .sort()
    .map((day) => ({ day, count: counts[day] }));
}

function renderPeriod() {
  const label = monthLabel();
  if (els.period) {
    els.period.textContent = label;
  }
}

function renderTabs() {
  const options = [
    { id: "all", label: `All · ${allPeople().length}` },
    { id: "current", label: `Current month · ${monthPeople().length}` },
  ];
  els.tabs.innerHTML = "";
  options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "pill";
    button.type = "button";
    button.id = `tab-${option.id}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(option.id === state.tab));
    button.textContent = option.label;
    button.addEventListener("click", () => {
      state.tab = option.id;
      render();
    });
    els.tabs.appendChild(button);
  });
}

function renderCopy() {
  const current = monthLabel();
  if (state.tab === "current") {
    els.lede.textContent = `${formName()} respondents for ${current}. This tab resets on the first of each month.`;
    els.peopleHeading.textContent = "Current month";
    els.peopleCaption.textContent = `Name and completion status for ${current}. Newest submissions first.`;
    els.byDayCaption.textContent = `Count of unique respondents by day in ${current}.`;
    els.recentCaption.textContent = `Most recent people to complete the form in ${current}.`;
    els.generated.textContent = `Showing ${current}. ${state.data.meta.privacy}`;
    return;
  }
  els.lede.textContent = `Every current and previous respondent from the form export. Use Current month to see only ${current}.`;
  els.peopleHeading.textContent = "All respondents";
  els.peopleCaption.textContent = "Current and previous completions, newest first.";
  els.byDayCaption.textContent = "Completions by day across every month.";
  els.recentCaption.textContent = "Most recent people to complete the form.";
  els.generated.textContent = `All respondents. ${state.data.meta.privacy}`;
}

function renderKpis(rows) {
  const latest = latestIn(rows);
  const current = monthLabel();
  const cards =
    state.tab === "current"
      ? [
          {
            label: "Completed",
            value: String(rows.filter((row) => row.completed).length),
            note: `Unique respondents in ${current}`,
          },
          {
            label: "Latest response",
            value: latest?.completedLabel || "—",
            note: "Most recent completion this month",
          },
          {
            label: "Month",
            value: current,
            note: "Resets automatically on the 1st",
          },
        ]
      : [
          {
            label: "All respondents",
            value: String(rows.length),
            note: "Current and previous months",
          },
          {
            label: "Latest response",
            value: latest?.completedLabel || "—",
            note: "Most recent completion overall",
          },
          {
            label: "This month",
            value: String(monthPeople().length),
            note: current,
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
  const empty =
    state.tab === "current"
      ? `No completions in ${monthLabel()} yet.`
      : "No respondents in the form export yet.";
  if (!rows.length) {
    els.people.innerHTML = `<p class="empty">${escapeHtml(empty)}</p>`;
    return;
  }

  const showMonth = state.tab === "all";
  const showGuild = IS_GUILD;
  els.people.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Respondent</th>
          <th>Status</th>
          ${showGuild ? "<th>Program</th><th>Guild status</th>" : ""}
          ${showMonth ? "<th>Month</th>" : ""}
          <th>Completed</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((person) => {
            const fresh = isNew(person) ? `<span class="badge new">New</span>` : "";
            const month = person.completedAt ? labelForKey(person.completedAt.slice(0, 7)) : "—";
            return `
              <tr>
                <td class="name">${escapeHtml(person.name)}${fresh}</td>
                <td>
                  <span class="badge done">${person.completed ? "Completed" : "Not completed"}</span>
                </td>
                ${
                  showGuild
                    ? `<td>${escapeHtml(person.program || "—")}</td><td class="when">${escapeHtml(person.status || "Submitted")}</td>`
                    : ""
                }
                ${showMonth ? `<td class="when">${escapeHtml(month)}</td>` : ""}
                <td class="when">${escapeHtml(person.completedLabel || "—")}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function renderByDay(rows) {
  const buckets = byDay(rows);
  if (!buckets.length) {
    const empty =
      state.tab === "current"
        ? `No completion dates in ${monthLabel()} yet.`
        : "No completion dates yet.";
    els.byDay.innerHTML = `<p class="empty">${escapeHtml(empty)}</p>`;
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
    const empty =
      state.tab === "current"
        ? `No responses in ${monthLabel()} yet.`
        : "No responses yet.";
    els.recent.innerHTML = `<p class="empty">${escapeHtml(empty)}</p>`;
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
  const latest = latestIn(monthPeople());
  if (latest?.completedAt) {
    localStorage.setItem(seenKey(), latest.completedAt);
  }
}

function render() {
  const current = monthKey();
  if (current !== state.monthKey) {
    state.monthKey = current;
    state.seenAt = localStorage.getItem(seenKey()) || "";
  }
  const rows = filteredPeople();
  const tabRows = activePeople();
  renderPeriod();
  renderTabs();
  renderCopy();
  renderKpis(tabRows);
  renderPeople(rows);
  renderByDay(tabRows);
  renderRecent(tabRows);
}

function msUntilNextMonth() {
  const date = now();
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 1);
  return Math.max(1000, next.getTime() - date.getTime());
}

function scheduleMonthRefresh() {
  window.setTimeout(() => {
    state.monthKey = monthKey();
    state.seenAt = localStorage.getItem(seenKey()) || "";
    render();
    scheduleMonthRefresh();
  }, Math.min(msUntilNextMonth(), 6 * 60 * 60 * 1000));
}

els.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    render();
  }
});

window.addEventListener("pagehide", markSeen);

async function init() {
  const response = await fetch(SOURCE);
  state.data = await response.json();
  state.seenAt = localStorage.getItem(seenKey()) || "";
  render();
  scheduleMonthRefresh();
}

init().catch((error) => {
  document.body.insertAdjacentHTML(
    "beforeend",
    `<p class="wrap" style="color:#e4b15c">Could not load ${escapeHtml(SOURCE)}. ${escapeHtml(error.message)}</p>`,
  );
});
