// ============================================
// EaDo Paws — Backend Server
// Express + SQLite + Nodemailer
// ============================================

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const nodemailer = require('nodemailer');
const db       = require('./database');

const app  = express();
const PORT = process.env.PORT || 3001;

// Max free meet-&-greets accepted per day. Raise this once you have more walkers.
const MAX_BOOKINGS_PER_DAY = 4;

// === MIDDLEWARE ===
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
}));

// === EMAIL TRANSPORTER ===
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password (not your real password)
  },
});

// ============================================
// POST /api/contact
// Handles the booking/contact form submission
// ============================================
app.post('/api/contact', async (req, res) => {
  const {
    'first-name': firstName,
    'last-name':  lastName,
    email,
    phone,
    'dog-name':   dogName,
    'dog-breed':  dogBreed,
    service,
    'preferred-date': preferredDate,
    'preferred-time': preferredTime,
    message,
  } = req.body;

  // --- Basic validation ---
  if (!firstName || !lastName || !email) {
    return res.status(400).json({
      success: false,
      error: 'First name, last name, and email are required.',
    });
  }

  if (preferredDate && preferredDate < new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({
      success: false,
      error: 'Preferred date must be today or later.',
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid email address.',
    });
  }

  // --- Make sure the requested day is actually bookable ---
  if (preferredDate) {
    const [blocked, dayCounts] = await Promise.all([
      db.getBlockedDatesInRange(preferredDate, preferredDate),
      db.getBookingCountsByDateRange(preferredDate, preferredDate),
    ]);
    if (blocked.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'That date is not available. Please pick a different day.',
      });
    }
    const existingCount = dayCounts[0]?.count || 0;
    if (existingCount >= MAX_BOOKINGS_PER_DAY) {
      return res.status(400).json({
        success: false,
        error: 'That date is fully booked. Please pick a different day.',
      });
    }
  }

  try {
    // --- 1. Save to database ---
    const submissionId = await db.saveSubmission({
      firstName, lastName, email, phone,
      dogName, dogBreed, service, preferredDate, preferredTime, message,
    });

    // --- 2. Send notification email to you ---
    await sendOwnerNotification({
      submissionId, firstName, lastName, email,
      phone, dogName, dogBreed, service, preferredDate, preferredTime, message,
    });

    // --- 3. Send confirmation email to the customer ---
    await sendCustomerConfirmation({ firstName, email, dogName, service });

    // --- 4. Text alert (best-effort — never fails the booking) ---
    sendTextAlert({ firstName, lastName, dogName, preferredDate }).catch((err) => {
      console.error('Text alert failed (booking still succeeded):', err.message);
    });

    return res.status(200).json({
      success: true,
      message: `Thanks ${firstName}! We'll be in touch within a few hours. 🐾`,
      submissionId,
    });

  } catch (err) {
    console.error('Submission error:', err);
    return res.status(500).json({
      success: false,
      error: 'Something went wrong. Please try again or call us directly.',
    });
  }
});

// ============================================
// GET /api/submissions
// View all submissions (protect this in production!)
// ============================================
app.get('/api/submissions', async (req, res) => {
  try {
    const submissions = await db.getAllSubmissions();
    res.json({ success: true, count: submissions.length, submissions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// GET /api/availability?start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns { "2026-08-10": "available" | "full" | "blocked", ... }
// for every day in the range (used to render the booking calendar)
// ============================================
app.get('/api/availability', async (req, res) => {
  const { start, end } = req.query;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!start || !end || !dateRegex.test(start) || !dateRegex.test(end)) {
    return res.status(400).json({ success: false, error: 'start and end must be YYYY-MM-DD.' });
  }

  try {
    const [blocked, dayCounts] = await Promise.all([
      db.getBlockedDatesInRange(start, end),
      db.getBookingCountsByDateRange(start, end),
    ]);
    const blockedSet = new Set(blocked.map((b) => b.date));
    const countByDate = Object.fromEntries(dayCounts.map((d) => [d.preferred_date, d.count]));

    const availability = {};
    const cursor = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    while (cursor <= endDate) {
      const dateStr = cursor.toISOString().slice(0, 10);
      if (blockedSet.has(dateStr)) {
        availability[dateStr] = 'blocked';
      } else if ((countByDate[dateStr] || 0) >= MAX_BOOKINGS_PER_DAY) {
        availability[dateStr] = 'full';
      } else {
        availability[dateStr] = 'available';
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    res.json({ success: true, availability });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// Blocked dates admin — days you're taking zero bookings (vacation, etc.)
// NOTE: not authenticated, same as /api/submissions. Protect before going live.
// ============================================
app.get('/api/blocked-dates', async (req, res) => {
  try {
    const blocked = await db.getBlockedDatesInRange('0000-01-01', '9999-12-31');
    res.json({ success: true, blocked });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/blocked-dates', async (req, res) => {
  const { date, reason } = req.body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    return res.status(400).json({ success: false, error: 'date must be YYYY-MM-DD.' });
  }
  try {
    await db.addBlockedDate(date, reason);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/blocked-dates/:date', async (req, res) => {
  try {
    await db.removeBlockedDate(req.params.date);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// GET /api/health
// Quick health check
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'EaDo Paws API', timestamp: new Date().toISOString() });
});

// ============================================
// EMAIL HELPERS
// ============================================

async function sendOwnerNotification(data) {
  const { submissionId, firstName, lastName, email, phone, dogName, dogBreed, service, preferredDate, preferredTime, message } = data;

  const html = `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FAF5EE; border-radius: 16px; overflow: hidden;">
      <div style="background: #3D2B1F; padding: 32px; text-align: center;">
        <h1 style="color: #FAF5EE; font-size: 1.6rem; margin: 0;">🐾 New Booking Request</h1>
        <p style="color: rgba(250,245,238,0.7); margin: 8px 0 0;">EaDo Paws — Submission #${submissionId}</p>
      </div>
      <div style="padding: 32px;">
        <table style="width:100%; border-collapse: collapse; font-size: 0.95rem;">
          <tr><td style="padding: 10px 0; border-bottom: 1px solid #DDD0C0; color: #8C7B72; width: 140px;">Name</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #DDD0C0; color: #3D2B1F; font-weight: 600;">${firstName} ${lastName}</td></tr>
          <tr><td style="padding: 10px 0; border-bottom: 1px solid #DDD0C0; color: #8C7B72;">Email</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #DDD0C0; color: #3D2B1F;"><a href="mailto:${email}" style="color:#C4591A;">${email}</a></td></tr>
          <tr><td style="padding: 10px 0; border-bottom: 1px solid #DDD0C0; color: #8C7B72;">Phone</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #DDD0C0; color: #3D2B1F;">${phone || 'Not provided'}</td></tr>
          <tr><td style="padding: 10px 0; border-bottom: 1px solid #DDD0C0; color: #8C7B72;">Dog's Name</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #DDD0C0; color: #3D2B1F;">${dogName || 'Not provided'}</td></tr>
          <tr><td style="padding: 10px 0; border-bottom: 1px solid #DDD0C0; color: #8C7B72;">Breed</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #DDD0C0; color: #3D2B1F;">${dogBreed || 'Not provided'}</td></tr>
          <tr><td style="padding: 10px 0; border-bottom: 1px solid #DDD0C0; color: #8C7B72;">Service</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #DDD0C0; color: #3D2B1F;">${service || 'Not specified'}</td></tr>
          <tr><td style="padding: 10px 0; border-bottom: 1px solid #DDD0C0; color: #8C7B72;">Preferred Date</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #DDD0C0; color: #3D2B1F; font-weight: 600;">${preferredDate || 'Not specified'}${preferredTime ? ` — ${preferredTime}` : ''}</td></tr>
          <tr><td style="padding: 10px 0; color: #8C7B72; vertical-align: top;">Message</td>
              <td style="padding: 10px 0; color: #3D2B1F;">${message || 'No message provided'}</td></tr>
        </table>
        <div style="margin-top: 28px; text-align: center;">
          <a href="mailto:${email}" style="display:inline-block; background:#C4591A; color:#fff; padding:12px 28px; border-radius:999px; text-decoration:none; font-weight:600;">
            Reply to ${firstName} →
          </a>
        </div>
      </div>
      <div style="background:#DDD0C0; padding:16px; text-align:center; font-size:0.8rem; color:#8C7B72;">
        Submitted ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"EaDo Paws Website" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    subject: `🐾 New Booking Request — ${firstName} ${lastName} (${dogName || 'no dog name'})`,
    html,
  });
}

async function sendCustomerConfirmation({ firstName, email, dogName, service }) {
  const dogLine = dogName ? ` and ${dogName}` : '';
  const serviceLine = service ? `<p style="color:#3D2B1F;">You expressed interest in: <strong>${service}</strong></p>` : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FAF5EE; border-radius: 16px; overflow: hidden;">
      <div style="background: #C4591A; padding: 40px; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 8px;">🐾</div>
        <h1 style="color: #fff; margin: 0; font-size: 1.6rem;">We got your message!</h1>
      </div>
      <div style="padding: 36px;">
        <p style="color: #3D2B1F; font-size: 1.05rem;">Hey ${firstName}!</p>
        <p style="color: #5a4940; line-height: 1.7;">
          Thanks for reaching out to EaDo Paws! We've received your request${dogLine} and we'll be in touch <strong>within a few hours</strong> to set up your free meet &amp; greet.
        </p>
        ${serviceLine}
        <p style="color: #5a4940; line-height: 1.7;">
          In the meantime, if you have any urgent questions, feel free to email us at <a href="mailto:pets@eadopaws.com" style="color:#C4591A;">pets@eadopaws.com</a>.
        </p>
        <p style="color: #5a4940; margin-top: 28px;">Talk soon,<br/><strong>The EaDo Paws Team 🐾</strong></p>
      </div>
      <div style="background: #DDD0C0; padding: 16px; text-align: center; font-size: 0.8rem; color: #8C7B72;">
        EaDo Paws · East Downtown Houston, TX · <a href="mailto:pets@eadopaws.com" style="color:#8C7B72;">pets@eadopaws.com</a>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"EaDo Paws" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `🐾 We got your request, ${firstName}! Talk soon.`,
    html,
  });
}

async function sendTextAlert({ firstName, lastName, dogName, preferredDate }) {
  if (!process.env.SMS_GATEWAY) return; // disabled — no gateway address configured

  // Carrier gateways render plain text only and often truncate around 140-160
  // chars, so keep this short — no HTML, no subject clutter.
  const dateLine = preferredDate ? ` for ${preferredDate}` : '';
  const text = `EADO Paws: New booking from ${firstName} ${lastName}${dogName ? ` (${dogName})` : ''}${dateLine}. Check email for details.`;

  await transporter.sendMail({
    from: `"EADO Paws" <${process.env.EMAIL_USER}>`,
    to: process.env.SMS_GATEWAY,
    subject: '',
    text,
  });
}

// === START SERVER ===
app.listen(PORT, () => {
  console.log(`\n🐾 EaDo Paws backend running at http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   Submissions:  http://localhost:${PORT}/api/submissions\n`);
});
