function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function monthLabel(date = new Date()) {
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function sparkline(values, color = "#5eead4") {
  if (!values.length) {
    return "";
  }
  const max = Math.max(...values, 1);
  const width = 140;
  const height = 36;
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - 4 - (value / max) * (height - 8);
      return `${x},${y}`;
    })
    .join(" ");
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="2" points="${points}"></polyline></svg>`;
}

function monthlySeries(people) {
  const buckets = {};
  people.forEach((person) => {
    const key = (person.completedAt || "").slice(0, 7);
    if (!key) {
      return;
    }
    buckets[key] = (buckets[key] || 0) + 1;
  });
  const keys = Object.keys(buckets).sort();
  return keys.map((key) => ({ key, count: buckets[key] }));
}

function renderHome(boards, counts) {
  const current = monthKey();
  const forms = [
    { key: "guild", label: "Grow with Guild", href: "guild.html", color: "#5eead4", data: boards.guild },
    { key: "spotlight", label: "Spotlight", href: "index.html", color: "#60a5fa", data: boards.spotlight },
    { key: "pathways", label: "Pathways to Success", href: "pathways.html", color: "#f0abfc", data: boards.pathways },
  ].map((form) => {
    const people = taggedPeople(form.data, form.label, form.href);
    return {
      ...form,
      people,
      total: people.length,
      month: thisMonthCount(people, current),
      latest: people[0] || null,
    };
  });

  const allPeople = forms
    .flatMap((form) => form.people)
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
  const monthTotal = forms.reduce((sum, form) => sum + form.month, 0);
  const allSeries = monthlySeries(allPeople);
  const monthName = monthLabel();

  document.getElementById("home-kicker").textContent = "Home";
  const clock = document.getElementById("nav-clock");
  if (clock) {
    clock.textContent = monthName;
  }
  document.getElementById("home-lede").textContent =
    `Newsletter form performance · ${monthName} · ${counts.all} total responses`;

  const kpis = document.getElementById("home-kpis");
  kpis.innerHTML = `
    <article class="kpi">
      <span>Total responses</span>
      <strong>${counts.all}</strong>
      <em>${forms.length} active forms</em>
      ${sparkline(allSeries.map((item) => item.count))}
    </article>
    <article class="kpi">
      <span>This month</span>
      <strong>${monthTotal}</strong>
      <em>${monthName}</em>
      ${sparkline(forms.map((form) => form.month), "#60a5fa")}
    </article>
    <article class="kpi">
      <span>Latest form</span>
      <strong>${escapeHtml(allPeople[0]?.form || "—")}</strong>
      <em>${escapeHtml(allPeople[0]?.completedLabel || "No responses yet")}</em>
    </article>
    <article class="kpi">
      <span>Quiet boards</span>
      <strong>${forms.filter((form) => form.month === 0).length}</strong>
      <em class="${forms.some((form) => form.month === 0) ? "warn" : ""}">No ${monthName.split(" ")[0]} responses</em>
    </article>
  `;

  const maxMonth = Math.max(...allSeries.map((item) => item.count), 1);
  document.getElementById("home-trend").innerHTML = allSeries.length
    ? allSeries
        .map(
          (item) => `
            <div class="bar-row">
              <span>${escapeHtml(item.key)}</span>
              <div class="track"><div class="fill" style="width:${Math.max(8, (item.count / maxMonth) * 100)}%"></div></div>
              <span>${item.count}</span>
            </div>
          `,
        )
        .join("")
    : `<p class="empty">No completions yet.</p>`;

  const total = counts.all || 1;
  let cursor = 0;
  const stops = forms.map((form) => {
    const share = (form.total / total) * 100;
    const start = cursor;
    cursor += share;
    return `${form.color} ${start}% ${cursor}%`;
  });
  document.getElementById("home-donut").innerHTML = `
    <div class="donut-wrap">
      <div class="donut" style="background: conic-gradient(${stops.join(", ")})">
        <div class="donut-hole">
          <div>
            <strong>${counts.all}</strong>
            <span>responses</span>
          </div>
        </div>
      </div>
      <div class="legend">
        ${forms
          .map(
            (form) => `
              <div>
                <span><i class="swatch" style="background:${form.color}"></i>${escapeHtml(form.label)}</span>
                <strong>${form.total} · ${Math.round((form.total / total) * 100)}%</strong>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;

  document.getElementById("home-table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Form</th>
          <th>Responses</th>
          <th>This month</th>
          <th>Latest</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${forms
          .map((form) => {
            const status = form.month > 0
              ? `<span class="badge ahead">On track</span>`
              : `<span class="badge watch">Watch</span>`;
            return `
              <tr>
                <td class="name"><a class="form-link" href="${form.href}">${escapeHtml(form.label)}</a></td>
                <td>${form.total}</td>
                <td>${form.month}</td>
                <td class="when">${escapeHtml(form.latest?.completedLabel || "—")}</td>
                <td>${status}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;

  document.getElementById("home-recent").innerHTML = allPeople.slice(0, 8)
    .map(
      (person) => `
        <div class="recent-row">
          <div>
            <strong>${escapeHtml(person.name)}</strong>
            <div class="caption" style="margin:2px 0 0">${escapeHtml(person.form)}</div>
          </div>
          <span>${escapeHtml(person.completedLabel || "")}</span>
        </div>
      `,
    )
    .join("");
}

document.addEventListener("boards:ready", (event) => {
  renderHome(event.detail.boards, event.detail.counts);
});

if (window.__boards && window.__counts) {
  renderHome(window.__boards, window.__counts);
}
