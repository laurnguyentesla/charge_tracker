const FORMS = [
  { key: "all", label: "Home", href: "overview.html", countKey: "all" },
  { key: "guild", label: "Grow with Guild", href: "guild.html", countKey: "guild" },
  { key: "spotlight", label: "Spotlight", href: "index.html", countKey: "spotlight" },
  { key: "pathways", label: "Pathways to Success", href: "pathways.html", countKey: "pathways" },
];

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load ${path}`);
  }
  return response.json();
}

function formatUpdated(iso) {
  if (!iso) {
    return "";
  }
  const date = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getDate();
  let hour = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${month} ${day}, ${hour}:${minute} ${suffix}`;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function renderSidebar(page, counts) {
  const aside = document.querySelector(".sidebar");
  if (!aside) {
    return;
  }
  aside.innerHTML = `
    <div class="brand">
      <span class="brand-mark">F</span>
      <div>
        <strong>Forms</strong>
        <small>Newsletter boards</small>
      </div>
    </div>
    <p class="sidebar-kicker">Boards</p>
    <nav class="site-nav" aria-label="Forms">
      ${FORMS.map((item) => {
        const current = item.key === page ? ' aria-current="page"' : "";
        const count = counts[item.countKey] ?? "";
        return `<a href="${item.href}"${current}><span>${item.label}</span><span class="nav-count" data-count="${item.countKey}">${count}</span></a>`;
      }).join("")}
    </nav>
    <p class="sidebar-updated" id="nav-updated">Last updated</p>
  `;
}

function taggedPeople(payload, form, href) {
  return (payload.people || []).map((person) => ({ ...person, form, href }));
}

function thisMonthCount(people, key = monthKey()) {
  return people.filter((person) => (person.completedAt || "").slice(0, 7) === key).length;
}

async function loadBoards() {
  const [spotlight, guild, pathways] = await Promise.all([
    loadJson("data/charges.json"),
    loadJson("data/guild.json"),
    loadJson("data/pathways.json"),
  ]);
  return { spotlight, guild, pathways };
}

async function fillNav() {
  const page = document.body.dataset.page || "spotlight";
  renderSidebar(page, { all: "", guild: "", spotlight: "", pathways: "" });
  try {
    const boards = await loadBoards();
    const counts = {
      spotlight: boards.spotlight.people?.length || 0,
      guild: boards.guild.people?.length || 0,
      pathways: boards.pathways.people?.length || 0,
    };
    counts.all = counts.spotlight + counts.guild + counts.pathways;
    renderSidebar(page, counts);
    window.__boards = boards;
    window.__counts = counts;
    document.dispatchEvent(new CustomEvent("boards:ready", { detail: { boards, counts } }));

    const latest = [
      boards.spotlight.meta?.generatedAt,
      boards.guild.meta?.generatedAt,
      boards.pathways.meta?.generatedAt,
    ]
      .filter(Boolean)
      .sort()
      .at(-1);
    const label = formatUpdated(latest);
    const updated = document.getElementById("nav-updated");
    if (updated && label) {
      updated.textContent = `Updated ${label}`;
    }
  } catch (error) {
    const updated = document.getElementById("nav-updated");
    if (updated) {
      updated.textContent = "Last updated unavailable";
    }
  }
}

fillNav();
