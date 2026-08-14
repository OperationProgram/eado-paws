<?php
// ============================================
// EaDo Paws — Mailer (PHPMailer over SMTP)
// ============================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/PHPMailer/Exception.php';
require_once __DIR__ . '/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;

function make_mailer() {
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = EMAIL_USER;
    $mail->Password   = EMAIL_PASS;
    $mail->SMTPSecure = SMTP_PORT == 465 ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = SMTP_PORT;
    $mail->isHTML(true);
    return $mail;
}

function send_owner_notification($data) {
    $mail = make_mailer();
    $mail->setFrom(EMAIL_USER, 'EADO Paws Website');
    foreach (explode(',', EMAIL_TO) as $addr) {
        $mail->addAddress(trim($addr));
    }
    $mail->Subject = "🐾 New Booking Request — {$data['firstName']} {$data['lastName']} (" . ($data['dogName'] ?: 'no dog name') . ")";

    $rows = [
        ['Name', htmlspecialchars($data['firstName'] . ' ' . $data['lastName'])],
        ['Email', '<a href="mailto:' . htmlspecialchars($data['email']) . '" style="color:#1f4b38;">' . htmlspecialchars($data['email']) . '</a>'],
        ['Phone', htmlspecialchars($data['phone'] ?: 'Not provided')],
        ["Dog's Name", htmlspecialchars($data['dogName'] ?: 'Not provided')],
        ['Breed', htmlspecialchars($data['dogBreed'] ?: 'Not provided')],
        ['Service', htmlspecialchars($data['service'] ?: 'Not specified')],
        ['Preferred Date', htmlspecialchars(($data['preferredDate'] ?: 'Not specified') . ($data['preferredTime'] ? ' — ' . $data['preferredTime'] : ''))],
        ['Message', htmlspecialchars($data['message'] ?: 'No message provided')],
    ];
    $rowsHtml = '';
    foreach ($rows as $r) {
        $rowsHtml .= '<tr><td style="padding:10px 0;border-bottom:1px solid #EAF0EC;color:#5C6B63;width:140px;">' . $r[0] . '</td>'
                   . '<td style="padding:10px 0;border-bottom:1px solid #EAF0EC;color:#1c2b21;">' . $r[1] . '</td></tr>';
    }

    $mail->Body = '
    <div style="font-family:\'DM Sans\',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f7f4ec;border-radius:16px;overflow:hidden;">
      <div style="background:#1f4b38;padding:32px;text-align:center;">
        <h1 style="color:#fff;font-size:1.6rem;margin:0;">🐾 New Booking Request</h1>
        <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;">EADO Paws — Submission #' . htmlspecialchars($data['submissionId']) . '</p>
      </div>
      <div style="padding:32px;">
        <table style="width:100%;border-collapse:collapse;font-size:0.95rem;">' . $rowsHtml . '</table>
        <div style="margin-top:28px;text-align:center;">
          <a href="mailto:' . htmlspecialchars($data['email']) . '" style="display:inline-block;background:#1f4b38;color:#fff;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;">
            Reply to ' . htmlspecialchars($data['firstName']) . ' →
          </a>
        </div>
      </div>
      <div style="background:#EAF0EC;padding:16px;text-align:center;font-size:0.8rem;color:#5C6B63;">
        Submitted ' . (new DateTime('now', new DateTimeZone('America/Chicago')))->format('n/j/Y, g:i A') . ' CT
      </div>
    </div>';

    $mail->send();
}

function send_customer_confirmation($firstName, $email, $dogName, $service) {
    $mail = make_mailer();
    $mail->setFrom(EMAIL_USER, 'EADO Paws');
    $mail->addAddress($email);
    $mail->Subject = "🐾 We got your request, {$firstName}! Talk soon.";

    $dogLine = $dogName ? ' and ' . htmlspecialchars($dogName) : '';
    $serviceLine = $service
        ? '<p style="color:#1c2b21;">You expressed interest in: <strong>' . htmlspecialchars($service) . '</strong></p>'
        : '';

    $mail->Body = '
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f7f4ec;border-radius:16px;overflow:hidden;">
      <div style="background:#1f4b38;padding:40px;text-align:center;">
        <div style="font-size:3rem;margin-bottom:8px;">🐾</div>
        <h1 style="color:#fff;margin:0;font-size:1.6rem;">We got your message!</h1>
      </div>
      <div style="padding:36px;">
        <p style="color:#1c2b21;font-size:1.05rem;">Hey ' . htmlspecialchars($firstName) . '!</p>
        <p style="color:#4a5a4f;line-height:1.7;">
          Thanks for reaching out to EADO Paws! We\'ve received your request' . $dogLine . ' and we\'ll be in touch <strong>within a few hours</strong> to set up your free meet &amp; greet.
        </p>
        ' . $serviceLine . '
        <p style="color:#4a5a4f;line-height:1.7;">
          In the meantime, if you have any urgent questions, feel free to call or text us at <a href="tel:+18322169276" style="color:#1f4b38;">(832) 216-9276</a>.
        </p>
        <p style="color:#4a5a4f;margin-top:28px;">Talk soon,<br/><strong>The EADO Paws Team 🐾</strong></p>
      </div>
      <div style="background:#EAF0EC;padding:16px;text-align:center;font-size:0.8rem;color:#5C6B63;">
        EADO Paws · East Downtown Houston, TX · <a href="mailto:pets@eadopaws.com" style="color:#5C6B63;">pets@eadopaws.com</a>
      </div>
    </div>';

    $mail->send();
}

function send_text_alert($firstName, $lastName, $dogName, $preferredDate) {
    if (!SMS_GATEWAY) return;
    try {
        $mail = make_mailer();
        $mail->isHTML(false);
        $mail->setFrom(EMAIL_USER, 'EADO Paws');
        $mail->addAddress(SMS_GATEWAY);
        $mail->Subject = '';
        $dateLine = $preferredDate ? " for {$preferredDate}" : '';
        $dogPart = $dogName ? " ({$dogName})" : '';
        $mail->Body = "EADO Paws: New booking from {$firstName} {$lastName}{$dogPart}{$dateLine}. Check email for details.";
        $mail->send();
    } catch (Exception $e) {
        error_log('Text alert failed (booking still succeeded): ' . $e->getMessage());
    }
}
