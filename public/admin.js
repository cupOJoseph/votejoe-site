(function () {
  const status = document.querySelector("[data-status]");
  const body = document.querySelector("[data-signups]");
  const empty = document.querySelector("[data-empty]");
  const exportButton = document.querySelector("[data-export]");
  const signups = new Map();

  function sortSignups() {
    return [...signups.values()].sort((a, b) =>
      (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0) ||
      a.email.localeCompare(b.email));
  }

  function render() {
    const rows = sortSignups();
    const fragment = document.createDocumentFragment();
    for (const record of rows) {
      const row = document.createElement("tr");
      const email = document.createElement("td");
      const date = document.createElement("td");
      email.textContent = record.email;
      date.textContent = record.createdAt ? new Date(record.createdAt).toLocaleString() : "Unknown";
      row.append(email, date);
      fragment.append(row);
    }
    body.replaceChildren(fragment);
    empty.hidden = rows.length > 0;
    exportButton.disabled = rows.length === 0;
    status.textContent = `${rows.length} unique email${rows.length === 1 ? "" : "s"}`;
  }

  function csvCell(value) {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  exportButton.addEventListener("click", () => {
    const rows = [["email", "created_at"], ...sortSignups().map(({ email, createdAt }) => [email, createdAt || ""])];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `votejoe-email-signups-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });

  async function load() {
    try {
      let cursor = null;
      do {
        const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
        const response = await fetch(`/admin/api/signups${query}`, { credentials: "same-origin", cache: "no-store" });
        const page = await response.json();
        if (!response.ok) throw new Error(page.error || "Could not load signups.");
        for (const record of page.items) {
          const previous = signups.get(record.email);
          if (!previous || (Date.parse(record.createdAt || "") || 0) > (Date.parse(previous.createdAt || "") || 0)) {
            signups.set(record.email, record);
          }
        }
        cursor = page.nextCursor;
        status.textContent = `Loading… ${signups.size} unique email${signups.size === 1 ? "" : "s"} found`;
      } while (cursor);
      render();
    } catch (error) {
      status.textContent = error.message || "Could not load signups. Reload to try again.";
    }
  }

  load();
})();
