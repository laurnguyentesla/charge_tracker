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

function setCount(key, value) {
  document.querySelectorAll(`[data-count="${key}"]`).forEach((node) => {
    node.textContent = String(value);
  });
}

async function fillNav() {
  try {
    const [spotlight, guild] = await Promise.all([
      loadJson("data/charges.json"),
      loadJson("data/guild.json"),
    ]);
    const spotlightCount = spotlight.people?.length || 0;
    const guildCount = guild.people?.length || 0;
    setCount("spotlight", spotlightCount);
    setCount("guild", guildCount);
    setCount("all", spotlightCount + guildCount);

    const latest = [spotlight.meta?.generatedAt, guild.meta?.generatedAt]
      .filter(Boolean)
      .sort()
      .at(-1);
    const label = formatUpdated(latest);
    const updated = document.getElementById("nav-updated");
    if (updated && label) {
      updated.textContent = `Last updated ${label}`;
    }

    const overviewLatest = document.getElementById("overview-updated");
    if (overviewLatest && label) {
      overviewLatest.textContent = `Last updated ${label}`;
    }
    const overviewAll = document.getElementById("overview-all");
    if (overviewAll) {
      overviewAll.textContent = String(spotlightCount + guildCount);
    }
    const overviewSpotlight = document.getElementById("overview-spotlight");
    if (overviewSpotlight) {
      overviewSpotlight.textContent = String(spotlightCount);
    }
    const overviewGuild = document.getElementById("overview-guild");
    if (overviewGuild) {
      overviewGuild.textContent = String(guildCount);
    }
  } catch (error) {
    const updated = document.getElementById("nav-updated");
    if (updated) {
      updated.textContent = "Last updated unavailable";
    }
  }
}

fillNav();
