(function () {
  const dismissalKey = "votejoeCampaignSuspensionDismissed";

  function closeOverlay() {
    const overlay = document.getElementById("campaign-suspension-overlay");
    if (!overlay) return;

    overlay.hidden = true;
    document.documentElement.classList.remove("campaign-suspension-open");

    try {
      sessionStorage.setItem(dismissalKey, "1");
    } catch {
      // Ignore storage failures in private or locked-down browser contexts.
    }
  }

  function initOverlay() {
    const overlay = document.getElementById("campaign-suspension-overlay");
    if (!overlay) return;

    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(dismissalKey) === "1";
    } catch {
      dismissed = false;
    }

    if (dismissed) {
      overlay.hidden = true;
    } else {
      overlay.hidden = false;
      document.documentElement.classList.add("campaign-suspension-open");
      const closeButton = overlay.querySelector(".campaign-suspension-close");
      if (closeButton) closeButton.focus({ preventScroll: true });
    }

    overlay.querySelectorAll(".campaign-suspension-close, .campaign-suspension-secondary").forEach((button) => {
      button.addEventListener("click", closeOverlay);
    });

    const emailForm = overlay.querySelector(".campaign-email-form");
    if (emailForm) {
      emailForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const emailInput = emailForm.querySelector('input[type="email"]');
        const status = emailForm.querySelector(".campaign-email-status");
        const email = (emailInput && emailInput.value ? emailInput.value : "").trim();
        if (!email) return;

        const subject = encodeURIComponent("Stay involved with Joe Schiarizzi");
        const body = encodeURIComponent(`Please add ${email} to campaign updates.`);
        if (status) status.textContent = "Opening your email app to finish signup.";
        window.location.href = `mailto:team@votejoe.org?subject=${subject}&body=${body}`;
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeOverlay();
    });
  }

  function init() {
    initOverlay();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
