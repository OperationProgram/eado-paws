// EADO Paws V2 — Main JavaScript

// === CHANGE THIS to your deployed backend URL before going live (currently local-dev only) ===
const API_URL = 'http://localhost:3001';

document.addEventListener('DOMContentLoaded', () => {

  // === TREAT & GREET PROMO (from flyer QR code: ?promo=treat-greet) ===
  const promo = new URLSearchParams(window.location.search).get('promo');
  if (promo === 'treat-greet') {
    const serviceSelect = document.getElementById('service');
    if (serviceSelect) serviceSelect.value = 'treat-greet-promo';
  }

  // === BOOKING CALENDAR (contact page only) ===
  initBookingCalendar();

  // === HONEST BOOKING-MONTH LINE ===
  const bookingMonthEl = document.getElementById('booking-month');
  if (bookingMonthEl) {
    bookingMonthEl.textContent = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  // === FOOTER YEAR ===
  document.querySelectorAll('.js-footer-year').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  // === ACTIVE NAV LINK ===
  const currentPage = (window.location.pathname.split('/').pop() || 'index.html');
  document.querySelectorAll('.nav__links a, .nav__mobile-menu a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // === MOBILE MENU ===
  const hamburger = document.querySelector('.nav__hamburger');
  const mobileMenu = document.querySelector('.nav__mobile-menu');
  const mobileClose = document.querySelector('.nav__mobile-close');

  hamburger?.addEventListener('click', () => {
    mobileMenu.classList.add('open');
    document.body.style.overflow = 'hidden';
  });

  const closeMobile = () => {
    mobileMenu?.classList.remove('open');
    document.body.style.overflow = '';
  };

  mobileClose?.addEventListener('click', closeMobile);
  mobileMenu?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMobile));

  // === SCROLL REVEAL ===
  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  reveals.forEach(el => observer.observe(el));

  // === CONTACT FORM — REAL BACKEND ===
  const form = document.getElementById('contact-form');
  const submitBtn = form?.querySelector('button[type="submit"]');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;
    try {
      const response = await fetch(`${API_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (result.success) {
        submitBtn.textContent = '✓ Message Sent!';
        showFormMessage(form, result.message, 'success');
        form.reset();
        setTimeout(() => {
          submitBtn.textContent = 'Send Message 🐾';
          submitBtn.disabled = false;
        }, 4000);
      } else {
        submitBtn.textContent = 'Send Message 🐾';
        submitBtn.disabled = false;
        showFormMessage(form, result.error, 'error');
      }
    } catch (err) {
      submitBtn.textContent = 'Send Message 🐾';
      submitBtn.disabled = false;
      showFormMessage(form, 'Could not connect to the server. Please email us at pets@eadopaws.com and we\'ll get right back to you!', 'error');
      console.error('Form error:', err);
    }
  });

  // === STAGGERED CARD ANIMATIONS ===
  const cards = document.querySelectorAll('.feature-card, .service-card, .pricing-card');
  const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, i * 80);
        cardObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  cards.forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    cardObserver.observe(card);
  });

});

// === HELPER: Show inline form message ===
function showFormMessage(form, message, type) {
  const existing = form.querySelector('.form-message');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'form-message';
  el.textContent = message;
  el.style.background = type === 'success' ? 'rgba(31,75,56,0.12)' : 'rgba(196,89,26,0.12)';
  el.style.color = type === 'success' ? '#1f4b38' : '#a84714';
  el.style.border = `1px solid ${type === 'success' ? 'rgba(31,75,56,0.3)' : 'rgba(196,89,26,0.3)'}`;
  form.insertBefore(el, form.firstChild);
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(() => el.remove(), 6000);
}

// === BOOKING CALENDAR — shows real available / full / blocked days ===
function initBookingCalendar() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;

  const monthLabel = document.getElementById('cal-month-label');
  const selectedLabel = document.getElementById('cal-selected-label');
  const hiddenInput = document.getElementById('preferred-date');
  const prevBtn = document.getElementById('cal-prev');
  const nextBtn = document.getElementById('cal-next');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toDateStr = (d) => d.toISOString().slice(0, 10);

  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth(); // 0-indexed
  let selectedDate = null;
  let availability = {}; // dateStr -> 'available' | 'full' | 'blocked'

  async function fetchAvailability(start, end) {
    try {
      const res = await fetch(`${API_URL}/api/availability?start=${start}&end=${end}`);
      const data = await res.json();
      return data.success ? data.availability : {};
    } catch (err) {
      // Backend not running — fail open so the calendar still works, just without live availability.
      return {};
    }
  }

  async function render() {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);
    monthLabel.textContent = firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    prevBtn.disabled = viewYear === today.getFullYear() && viewMonth === today.getMonth();

    availability = await fetchAvailability(toDateStr(firstOfMonth), toDateStr(lastOfMonth));

    grid.innerHTML = '';
    for (let i = 0; i < firstOfMonth.getDay(); i++) {
      grid.appendChild(document.createElement('span'));
    }

    for (let day = 1; day <= lastOfMonth.getDate(); day++) {
      const cellDate = new Date(viewYear, viewMonth, day);
      const dateStr = toDateStr(cellDate);
      const isPast = cellDate < today;
      const status = availability[dateStr] || 'available';
      const isBookable = !isPast && status === 'available';

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.textContent = String(day);
      cell.className = 'booking-calendar__day';
      if (isPast || status !== 'available') cell.classList.add('booking-calendar__day--disabled');
      if (dateStr === selectedDate) cell.classList.add('booking-calendar__day--selected');
      cell.disabled = !isBookable;

      if (isBookable) {
        cell.addEventListener('click', () => {
          selectedDate = dateStr;
          hiddenInput.value = dateStr;
          selectedLabel.textContent = `Selected: ${cellDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
          render();
        });
      }
      grid.appendChild(cell);
    }
  }

  prevBtn.addEventListener('click', () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    render();
  });
  nextBtn.addEventListener('click', () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    render();
  });

  render();
}
