// repositories/admin.repository.js
// Capa de acceso a datos para operaciones administrativas
// Admin, Invertir, Cierres_contables, AdminActions

const db = require("../lib/firestore");

// ═══════════════════════════════════════════
// ADMIN (Firebase Auth)
// ═══════════════════════════════════════════

/**
 * Obtiene un admin por email con filtros de estado y rol.
 * @param {string} email
 * @returns {Promise<FirebaseFirestore.QuerySnapshot>}
 */
async function getAdminByEmail(email) {
  return db
    .collection("Admin")
    .where("Email", "==", email)
    .where("Activo", "==", true)
    .where("Rol", "==", "admin")
    .limit(1)
    .get();
}

/**
 * Obtiene todos los admins con un rol específico.
 * @param {string} rol
 * @returns {Promise<FirebaseFirestore.QuerySnapshot>}
 */
async function getAdminByRol(rol) {
  return db.collection("Admin").where("Rol", "==", rol).get();
}

// ═══════════════════════════════════════════
// INVERTIR
// ═══════════════════════════════════════════

/**
 * Obtiene un documento de inversión por categoría.
 * @param {string} categoria
 * @returns {Promise<FirebaseFirestore.DocumentSnapshot | null>}
 */
async function getInversion(categoria) {
  const ref = db.collection("Invertir").doc(categoria);
  const snap = await ref.get();
  return snap.exists ? snap : null;
}

// ═══════════════════════════════════════════
// CIERRES CONTABLES
// ═══════════════════════════════════════════

/**
 * Obtiene el documento de cierres contables para un mes.
 * @param {string} mesAnio — ej: "Enero 2026"
 * @returns {Promise<FirebaseFirestore.DocumentSnapshot | null>}
 */
async function getCierresContables(mesAnio) {
  const ref = db.collection("Cierres_contables").doc(mesAnio);
  const snap = await ref.get();
  return snap.exists ? snap : null;
}

/**
 * Establece datos de cierre contable para una categoría en un mes.
 * @param {string} mesAnio
 * @param {string} categoria
 * @param {object} data
 * @returns {Promise<FirebaseFirestore.WriteResult>}
 */
async function setCierreContable(mesAnio, categoria, data) {
  const ref = db.collection("Cierres_contables").doc(mesAnio);
  return ref.set({ [categoria]: data }, { merge: true });
}

// ═══════════════════════════════════════════
// ADMIN ACTIONS
// ═══════════════════════════════════════════

/**
 * Registra una acción administrativa para una categoría en un mes.
 * @param {string} mesAnio
 * @param {string} categoria
 * @param {object} data
 * @returns {Promise<FirebaseFirestore.WriteResult>}
 */
async function setAdminAction(mesAnio, categoria, data) {
  const ref = db.collection("AdminActions").doc(mesAnio);
  return ref.set({ [categoria]: data }, { merge: true });
}

// ═══════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════

module.exports = {
  // Admin
  getAdminByEmail,
  getAdminByRol,

  // Invertir
  getInversion,

  // Cierres contables
  getCierresContables,
  setCierreContable,

  // Admin actions
  setAdminAction,
};