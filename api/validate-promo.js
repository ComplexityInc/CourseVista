const { validate } = require('../lib/promo');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { code } = req.body || {};
  const result = await validate(code);
  res.status(200).json(result);
};
