const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const db = require("../lib/firestore");

const { 
  cerrarMesContable,
} = require("../services/cierreMensual.service");

/**
 * 🔐 Validacion admin 
**/

async function adminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        ok: false,
        message: "Token no proporcionado",
      });
    }

    const token = authHeader.split(" ")[1];

    // 🔐 Verificar token Firebase
    const decodedToken = await admin.auth().verifyIdToken(token);

    const email = decodedToken.email;

    if (!email) {
      return res.status(403).json({
        ok: false,
        message: "Token inválido (sin email)",
      });
    }

    // 🔎 Buscar en colección Admin
    const adminSnap = await db
      .collection("Admin")
      .where("Email", "==", email)
      .where("Activo", "==", true)
      .where("Rol", "==", "admin")
      .limit(1)
      .get();

    if (adminSnap.empty) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos de administrador",
      });
    }

    // Guardamos datos del admin en request
    req.admin = {
      uid: decodedToken.uid,
      email,
      nombre: adminSnap.docs[0].data().Nombre,
    };

    next();

  } catch (error) {
    console.error("❌ Error validando admin:", error.message);

    return res.status(401).json({
      ok: false,
      message: "No autorizado",
    });
  }
}


/**
 * 🔒 POST /admin/contabilidad/cerrar-mes
 * Body:
 * {
 *   "mesAnio": "Febrero de 2026"
 * }
 */
router.post(
  "/cerrar-mes",
  adminAuth,
  async (req, res) => {
    try {
      const { mesAnio } = req.body;

      if (!mesAnio) {
        return res.status(400).json({
          ok: false,
          message: "mesAnio es obligatorio",
        });
      }

      const resultado = await cerrarMesContable(mesAnio);

      return res.status(200).json({
        ok: true,
        message: `Mes ${mesAnio} cerrado correctamente`,
        data: resultado,
      });

    } catch (error) {
      console.error("❌ Error cierre mensual:", error.message);

      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
  }
);

module.exports = router;
