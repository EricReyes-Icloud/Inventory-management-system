// src/lib/authMiddleware.js
const admin = require('firebase-admin');

// middleware para verificar token Firebase ID Token en Authorization: "Bearer <token>"
async function verifyFirebaseToken(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });

    const idToken = auth.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded; // contiene uid, email, etc.
    next();
  } catch (err) {
    console.error('Token verification error', err);
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { verifyFirebaseToken };
