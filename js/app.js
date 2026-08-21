function now() {
  return new Date();
}

function monthKey(date = now()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date = now()) {
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function seenKey() {
  return `charge-tracker-seen-at-${monthKey()}`;
}

const state = {
  data: null,
  query: "",
  filter: "all",
  monthKey: monthKey(),
  seenAt: "",
};

const els = {
  period: document.getElementById("period"),
  lede: document.getElementById("lede"),
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

function inCurrentMonth(person) {
  return Boolean(person.completedAt) && person.completedAt.slice(0, 7) === state.monthKey;
}

function monthPeople() {
  return (state.data.people || []).filter(inCurrentMonth);
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
  return monthPeople().filter((person) => {
    const nameOk = !query || person.name.toLowerCase().includes(query);
    const statusOk = state.filter === "all" || (state.filter === "completed" && person.completed);
    return nameOk && statusOk;
  });
}

function latestInMonth(rows) {
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
  if (els.lede) {
    els.lede.textContent = `Newsletter questionnaire respondents for ${label}. The board resets on the first of each month. Emails and written answers are stripped before this page is published.`;
  }
  document.querySelectorAll(".month-name").forEach((node) => {
    node.textContent = label;
  });
}

function renderPills(rows) {
  const total = rows.length;
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
  const latest = latestInMonth(rows);
  const cards = [
    {
      label: "Completed",
      value: String(rows.filter((row) => row.completed).length),
      note: `Unique respondents in ${monthLabel()}`,
    },
    {
      label: "Latest response",
      value: latest?.completedLabel || "—",
      note: "Most recent completion this month",
    },
    {
      label: "Month",
      value: monthLabel(),
      note: "Resets automatically on the 1st",
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
    els.people.innerHTML = `<p class="empty">No completions in ${escapeHtml(monthLabel())} yet.</p>`;
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

function renderByDay(rows) {
  const buckets = byDay(rows);
  if (!buckets.length) {
    els.byDay.innerHTML = `<p class="empty">No completion dates in ${escapeHtml(monthLabel())} yet.</p>`;
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
    els.recent.innerHTML = `<p class="empty">No responses in ${escapeHtml(monthLabel())} yet.</p>`;
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
  const latest = latestInMonth(monthPeople());
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
  const monthRows = monthPeople();
  const rows = filteredPeople();
  renderPeriod();
  renderPills(monthRows);
  renderKpis(rows);
  renderPeople(rows);
  renderByDay(monthRows);
  renderRecent(monthRows);
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
  const response = await fetch("data/charges.json");
  state.data = await response.json();
  state.seenAt = localStorage.getItem(seenKey()) || "";
  els.generated.textContent = `Showing ${monthLabel()} only. ${state.data.meta.privacy}`;
  render();
  scheduleMonthRefresh();
}

init().catch((error) => {
  document.body.insertAdjacentHTML(
    "beforeend",
    `<p class="wrap" style="color:#e4b15c">Could not load data/charges.json. ${escapeHtml(error.message)}</p>`,
  );
});
