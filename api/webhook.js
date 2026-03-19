// LINE Webhook Proxy → Google Apps Script
// Vercel Serverless Function

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzO0_L588PKrlOaQ9wKI4nI8-tsuTvyI1ijw-FAy-BScpTs5-edIrDOPkXge-Kn9I44uA/exec';

export default async function handler(req, res) {
  // GET = health check
  if (req.method === 'GET') {
    return res.status(200).send('LINE Bot Proxy is running');
  }

  // POST = LINE Webhook
  if (req.method === 'POST') {
    try {
      const body = JSON.stringify(req.body);

      // Forward ไป GAS (follow redirects อัตโนมัติ)
      fetch(GAS_URL, {
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
