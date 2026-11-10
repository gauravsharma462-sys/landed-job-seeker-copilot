// Fill with Landed — Content Script
// Bridges the Landed Web App with LinkedIn Recommended Jobs & Company ATS Portals (Workday, Greenhouse, Lever, Indeed)

// Forward window.postMessage from Landed Web App directly to extension service worker
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || !event.data.source || event.data.source !== 'LANDED_WEB_APP') {
    return;
  }
  chrome.runtime.sendMessage(event.data, (response) => {
    window.postMessage({
      source: 'LANDED_EXTENSION_BRIDGE',
      requestId: event.data.requestId,
      response
    }, '*');
  });
});

// Handle commands inside LinkedIn or Company ATS pages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'EXTRACT_LINKEDIN_RECOMMENDED') {
    // Read-only extraction of LinkedIn job cards (Never clicks Apply, Save, or Follow)
    const cards = Array.from(document.querySelectorAll('.job-card-container, .jobs-job-board-list__item'));
    const extracted = cards.slice(0, 10).map((card, i) => ({
      title: card.querySelector('.job-card-list__title, a.job-card-container__link')?.innerText?.trim() || `Recommended Role #${i + 1}`,
      company: card.querySelector('.job-card-container__primary-description, .artdeco-entity-lockup__subtitle')?.innerText?.trim() || 'Enterprise Employer',
      location: card.querySelector('.job-card-container__metadata-item')?.innerText?.trim() || 'Hybrid / Remote',
      url: card.querySelector('a')?.href || window.location.href
    }));
    sendResponse({ jobs: extracted });
  }

  if (msg.type === 'EXECUTE_DESKTOP_APPLY_AUTOFILL') {
    const { profile, job } = msg;
    const filledFields = [];

    const setInputValue = (selectorList, value, label) => {
      if (!value) return;
      for (const sel of selectorList) {
        const el = document.querySelector(sel);
        if (el) {
          el.focus();
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          filledFields.push(label);
          break;
        }
      }
    };

    setInputValue(['input[name*="firstName" i]', 'input[id*="first_name" i]', 'input[autocomplete="given-name"]'], profile.firstName, 'First Name');
    setInputValue(['input[name*="lastName" i]', 'input[id*="last_name" i]', 'input[autocomplete="family-name"]'], profile.lastName, 'Last Name');
    setInputValue(['input[name*="name" i]', 'input[autocomplete="name"]'], profile.fullName, 'Full Name');
    setInputValue(['input[type="email"]', 'input[name*="email" i]'], profile.email, 'Email');
    setInputValue(['input[type="tel"]', 'input[name*="phone" i]'], profile.phone, 'Phone');
    setInputValue(['input[name*="linkedin" i]', 'input[id*="linkedin" i]'], profile.linkedin, 'LinkedIn URL');
    setInputValue(['textarea[name*="cover" i]', 'textarea[id*="cover" i]'], job.coverLetter, 'Tailored Cover Letter');

    // Guardrail: Never click submit/apply buttons automatically
    sendResponse({
      filledFields,
      pausedAt: 'Final Review & Human-Only Standing Questions'
    });
  }
});
