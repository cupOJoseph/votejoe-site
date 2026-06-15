(function () {
  const form = document.querySelector("[data-email-form]");
  if (!form) return;

  const input = form.querySelector('input[type="email"]');
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector("[data-form-status]");

  function setStatus(message, state) {
    if (!status) return;
    status.textContent = message;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = input.value.trim();
    if (!email) return;

    button.disabled = true;
    setStatus("Saving...", "");

    try {
      const response = await fetch("/api/email-signups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Signup failed.");

      input.value = "";
      setStatus("You're on the list. Thank you.", "success");
    } catch (error) {
      setStatus(error.message || "Could not save this email right now.", "error");
    } finally {
      button.disabled = false;
    }
  });
})();
