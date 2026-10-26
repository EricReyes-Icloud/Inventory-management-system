// repositories/admin.repository.js
// Capa de acceso a datos para operaciones administrativas
// Admin, Invertir, Cierres_contables, AdminActions

const db = require("../lib/firestore");

// ═══════════════════════════════════════════
// ADMIN (Firebase Auth)
// ═══════════════════════════════════════════

function normalizarTelefono(telefono) {
  if (!telefono) return "";
  let t = String(telefono).replace(/whatsapp:/i, "").trim();
  t = t.replace(/[\s\-\(\)]/g, "");
  if (t.startsWith("00")) t = "+" + t.slice(2);
  if (!t.startsWith("+")) {
    if (t.startsWith("57") && t.length === 12) t = "+" + t;
    else if (t.length === 10) t = "+57" + t;
    else t = "+" + t;
  }
  return t;
}

/**
 * Obtiene un admin por email con filtros de estado y rol.
 * @param {string} email
 * @returns {Promise<FirebaseFirestore.QuerySnapshot>}
 */
async function getAdminByEmail(email) {
  return db
    .collection("Usuarios")
    .doc("Usuarios")
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
  return db
    .collection("Usuarios")
    .doc("Usuarios")
    .collection("Admin")
    .where("Rol", "==", rol)
    .get();
}

/**
 * Busca un admin por teléfono en Admin, Admin_2, Admin_3
 */
async function getAdminByTelefono(telefono) {
  const clean = normalizarTelefono(telefono);
  if (!clean) return { empty: true, docs: [], clean };

  const collections = ["Admin", "Admin_2", "Admin_3"];
  for (const col of collections) {
    try {
      const snap = await db
        .collection("Usuarios")
        .doc("Usuarios")
        .collection(col)
        .where("Telefono", "==", clean)
        .limit(1)
        .get();
      if (!snap.empty) return snap;
    } catch (err) {
      console.error(`Error buscando admin por telefono en ${col}:`, err.message);
    }
  }
  // Intento con variantes sin + por si hay datos diferentes
  try {
    const sinMas = clean.replace("+", "");
    if (sinMas && sinMas !== clean) {
      for (const col of collections) {
        try {
          const snap = await db
            .collection("Usuarios")
            .doc("Usuarios")
            .collection(col)
            .where("Telefono", "==", sinMas)
            .limit(1)
            .get();
          if (!snap.empty) return snap;
        } catch (err) {
          console.error(`Error buscando admin por telefono sin + en ${col}:`, err.message);
        }
      }
    }
  } catch (_) {}

  // Intento con formato Firestore: +57 <espacio> número (como se guarda en BD)
  // clean viene como +573138861417, necesitamos +57 3138861417
  try {
    if (clean.startsWith("+57") && clean.length === 13) {
      const formatoFirestore = "+57 " + clean.slice(3);
      for (const col of collections) {
        try {
          const snap = await db
            .collection("Usuarios")
            .doc("Usuarios")
            .collection(col)
            .where("Telefono", "==", formatoFirestore)
            .limit(1)
            .get();
          if (!snap.empty) return snap;
        } catch (err) {
          console.error(`Error buscando admin por telefono formato Firestore en ${col}:`, err.message);
        }
      }
    }
  } catch (_) {}
  return { empty: true, docs: [], clean };
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
  getAdminByTelefono,
  normalizarTelefono,

  // Invertir
  getInversion,

  // Cierres contables
  getCierresContables,
  setCierreContable,

  // Admin actions
  setAdminAction,
};