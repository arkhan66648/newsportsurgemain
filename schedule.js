/* Sportsurge shared schedule engine
 * One file drives every sport schedule page. Each page supplies:
 *   window.SCHEDULE_CONFIG = { keyword, leagues?, category?, all? }
 */
(function () {
  "use strict";

  var API_BASES = [
    "https://api.reedstreams.link",
    "https://reedstreams.to",
    "https://reedstreams.st"
  ];

  // The watch page is a separate site. Change this single value when a
  // dedicated watch domain is ready.
  var WATCH_BASE = "https://arkhanfreelancing.github.io/newmywatch1/";

  var CACHE_KEY = "ms_matches_cache_v1";
  var CACHE_TTL = 60 * 1000;
  var FINISHED_HIDE_MS = 3 * 60 * 60 * 1000;
  var DEFAULT_DURATION_MS = 150 * 60 * 1000;

  var config = window.SCHEDULE_CONFIG || {};

  var matchesBody = document.getElementById("matches-body");
  var matchesTable = document.getElementById("matches-table");
  var loadingDiv = document.getElementById("loading");
  var liveCountEl = document.getElementById("live-count");
  var allBtn = document.getElementById("all-btn");
  var liveBtn = document.getElementById("live-btn");
  var upcomingBtn = document.getElementById("upcoming-btn");

  if (!matchesBody || !matchesTable) return;

  if (loadingDiv) loadingDiv.style.display = "block";
  matchesTable.style.display = "none";

  var currentFilter = "all";

  var CATEGORY_NAMES = {
    "american-football": "American Football",
    "basketball": "Basketball",
    "football": "Football",
    "baseball": "Baseball",
    "hockey": "Hockey",
    "motor-sports": "Motor Sports",
    "fight": "Fight",
    "tennis": "Tennis",
    "rugby": "Rugby",
    "golf": "Golf",
    "afl": "AFL",
    "cricket": "Cricket",
    "billiards": "Billiards",
    "darts": "Darts",
    "volleyball": "Volleyball",
    "badminton": "Badminton",
    "handball": "Handball",
    "sailing": "Sailing",
    "horse-racing": "Horse Racing",
    "other": "Other"
  };

  function fetchJson(path) {
    var lastError = null;

    function tryNext(index) {
      if (index >= API_BASES.length) {
        return Promise.reject(lastError || new Error("All match APIs failed"));
      }

      var base = API_BASES[index];

      return fetch(base + path, {
        headers: { Accept: "application/json" },
        cache: "no-store"
      })
        .then(function (res) {
          if (!res.ok) throw new Error(base + " returned " + res.status);
          return res.json();
        })
        .catch(function (err) {
          lastError = err;
          return tryNext(index + 1);
        });
    }

    return tryNext(0);
  }

  function readCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;

      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.data)) return null;
      if (Date.now() - parsed.at > CACHE_TTL) return null;

      return parsed.data;
    } catch (err) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data }));
    } catch (err) {
      // Private mode / storage disabled: ignore.
    }
  }

  function getMatches() {
    var cached = readCache();
    if (cached) return Promise.resolve(cached);

    return fetchJson("/api/matches/all").then(function (data) {
      if (!Array.isArray(data)) throw new Error("Invalid matches response");
      writeCache(data);
      return data;
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatTime(ms) {
    return new Date(ms).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  }

  function categoryName(category) {
    return CATEGORY_NAMES[category] || category || "-";
  }

  function getLeagueName(match) {
    return (
      match.league_name ||
      (match.league && match.league.name) ||
      match.league_id ||
      ""
    );
  }

  function getStatus(match, now) {
    var start = Number(match.date) || 0;
    var end = Number(match.ends_at) || start + DEFAULT_DURATION_MS;

    if (now >= end) return "finished";
    if (now >= start) return "live";
    return "upcoming";
  }

  function matchesConfig(match) {
    if (config.all) return true;

    var title = String(match.title || "").toLowerCase();
    var league = getLeagueName(match).toLowerCase();
    var leagueId = String(match.league_id || "").toLowerCase();
    var keyword = String(config.keyword || "").toLowerCase();
    var category = String(match.category || "").toLowerCase();

    var keywordHit =
      keyword &&
      (title.indexOf(keyword) !== -1 ||
        league.indexOf(keyword) !== -1 ||
        leagueId.indexOf(keyword) !== -1);

    if (keywordHit) return true;

    if (Array.isArray(config.leagues) && config.leagues.length) {
      return config.leagues.some(function (token) {
        var t = String(token).toLowerCase();
        return league.indexOf(t) !== -1 || leagueId.indexOf(t) !== -1;
      });
    }

    if (config.category) {
      return category === String(config.category).toLowerCase();
    }

    // No filter configured: show nothing rather than every sport.
    return false;
  }

  function buildWatchUrl(id) {
    return WATCH_BASE + "?id=" + encodeURIComponent(id);
  }

  function statusBadge(status) {
    if (status === "finished") return '<span class="badge finished"></span>';
    if (status === "live") return '<span class="badge live"></span>';
    return "";
  }

  function render(rows, filter) {
    matchesBody.innerHTML = "";

    var filtered = rows.filter(function (row) {
      return filter === "all" || row.status === filter;
    });

    if (!filtered.length) {
      matchesBody.innerHTML =
        '<tr><td colspan="5">⚠ No matches available.</td></tr>';
    } else {
      var fragment = document.createDocumentFragment();

      filtered.forEach(function (row) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" +
          escapeHtml(row.time) +
          "</td>" +
          "<td>" +
          escapeHtml(row.sport) +
          "</td>" +
          "<td>" +
          escapeHtml(row.tournament) +
          "</td>" +
          "<td>" +
          escapeHtml(row.match) +
          " " +
          statusBadge(row.status) +
          "</td>" +
          '<td><a class="watch-btn" target="_blank" rel="noopener" href="' +
          escapeHtml(row.url) +
          '">Watch</a></td>';

        fragment.appendChild(tr);
      });

      matchesBody.appendChild(fragment);
    }

    matchesTable.style.display = "table";
  }

  function setActive(button) {
    document.querySelectorAll(".filter-btn").forEach(function (btn) {
      btn.classList.remove("active");
    });
    if (button) button.classList.add("active");
  }

  function bindFilters(rows) {
    if (allBtn) {
      allBtn.addEventListener("click", function () {
        currentFilter = "all";
        setActive(allBtn);
        render(rows, currentFilter);
      });
    }

    if (liveBtn) {
      liveBtn.addEventListener("click", function () {
        currentFilter = "live";
        setActive(liveBtn);
        render(rows, currentFilter);
      });
    }

    if (upcomingBtn) {
      upcomingBtn.addEventListener("click", function () {
        currentFilter = "upcoming";
        setActive(upcomingBtn);
        render(rows, currentFilter);
      });
    }
  }

  function showError(message) {
    if (loadingDiv) {
      loadingDiv.style.display = "block";
      loadingDiv.innerHTML =
        '<p style="color:#ff6b6b;">⚠ ' + escapeHtml(message) + "</p>";
    }
    matchesTable.style.display = "none";
  }

  getMatches()
    .then(function (matches) {
      var now = Date.now();
      var rows = [];
      var seen = new Set();
      var liveCount = 0;

      matches.forEach(function (match) {
        if (!match || !match.id) return;
        if (!matchesConfig(match)) return;

        var start = Number(match.date) || 0;
        var end = Number(match.ends_at) || start + DEFAULT_DURATION_MS;

        // Keep recently finished events visible for three hours.
        if (now - end >= FINISHED_HIDE_MS) return;

        if (seen.has(match.id)) return;
        seen.add(match.id);

        var status = getStatus(match, now);
        if (status === "live") liveCount += 1;

        rows.push({
          id: match.id,
          time: formatTime(start),
          sport: categoryName(match.category),
          tournament: getLeagueName(match) || "-",
          match: match.title || "-",
          status: status,
          url: buildWatchUrl(match.id),
          start: start
        });
      });

      var statusOrder = { live: 0, upcoming: 1, finished: 2 };

      rows.sort(function (a, b) {
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        if (a.status === "finished") return b.start - a.start;
        return a.start - b.start;
      });

      if (liveCountEl) liveCountEl.textContent = String(liveCount);

      bindFilters(rows);
      render(rows, currentFilter);

      if (loadingDiv) loadingDiv.style.display = "none";
    })
    .catch(function (err) {
      console.error(err);
      showError("Unable to load matches. Please try again in a minute.");
    });
})();
