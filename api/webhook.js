// LINE Webhook Proxy → Google Apps Script
// Vercel Serverless Function

var crypto = require('crypto');

// Secrets จาก Vercel Environment Variables
var GAS_URL = process.env.GAS_URL;
var LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

function verifySignature(body, signature) {
  var hash = crypto
    .createHmac('SHA256', LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

module.exports = async function handler(req, res) {
  // GET = health check
  if (req.method === 'GET') {
    return res.status(200).send('OK');
  }

  // POST = LINE Webhook
  if (req.method === 'POST') {
    try {
      var body = JSON.stringify(req.body);
      var signature = req.headers['x-line-signature'];

      // ตรวจสอบว่ามาจาก LINE จริง (HMAC-SHA256)
      if (!signature || !verifySignature(body, signature)) {
        return res.status(403).json({ status: 'forbidden' });
      }

      // Forward ไป GAS (follow redirects อัตโนมัติ)
      await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        redirect: 'follow',
      }).catch(function () {});

      // ตอบ LINE 200 ทันที
      return res.status(200).json({ status: 'ok' });
    } catch (err) {
      return res.status(200).json({ status: 'ok' });
    }
  }

  return res.status(405).send('Method not allowed');
}
