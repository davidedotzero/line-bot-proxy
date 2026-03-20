// LINE Webhook Proxy → Google Apps Script
// Vercel Serverless Function

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyOvWoGx6Q8YBghzDGAcDE_KZkNynpJ73OA09NZNI1bnLLYOry3YWMKbBq4_561YnVAQg/exec';

module.exports = async function handler(req, res) {
  // GET = health check
  if (req.method === 'GET') {
    return res.status(200).send('LINE Bot Proxy is running');
  }

  // POST = LINE Webhook
  if (req.method === 'POST') {
    try {
      const body = JSON.stringify(req.body);

      // Forward ไป GAS (follow redirects อัตโนมัติ)
      await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        redirect: 'follow',
      }).catch(err => console.log('GAS error:', err));

      // ตอบ LINE 200 ทันที
      return res.status(200).json({ status: 'ok' });
    } catch (err) {
      return res.status(200).json({ status: 'ok', error: err.message });
    }
  }

  return res.status(405).send('Method not allowed');
}
