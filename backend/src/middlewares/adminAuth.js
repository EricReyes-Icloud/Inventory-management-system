// src/middlewares/adminAuth.js
// Autenticación de administrador por Firebase ID token.
//
// La validación NO se queda solo en el token: además de verificar la firma
// de Firebase, se busca al usuario en la colección de administradores. Un
// token válido de un usuario que no es administrador no alcanza.
//
// Este middleware vive en middlewares/ porque lo usan dos routers:
//   - routes/admin.contabilidad.routes.js  → POST /api/admin/cerrar-mes
//   - routes/admin.button.routes.js        → POST /admin/cerrar-categoria

const admin = require("firebase-admin");
const adminRepo = require("../repositories/admin.repository");

/**
 * Middleware de autenticación de administrador.
 *
 * Deja en `req.admin` los datos del administrador autenticado:
 * `{ uid, email, nombre }`.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function adminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // Validamos formato correcto
      return res.status(401).json({
        ok: false,
        message: "Token no proporcionado",
      });
    }

    const token = authHeader.split(" ")[1]; // Extraemos el Token con posicion [1]

    // Verificar token Firebase
    const decodedToken = await admin.auth().verifyIdToken(token);

    const email = decodedToken.email; // Extraemos el email del usuario

    if (!email) {
      // Autenticado pero no autorizado correctamente
      return res.status(403).json({
        ok: false,
        message: "Token inválido (sin email)",
      });
    }

    /* Buscar en colección Admin
       No confiamos solo en el Token, tambien buscamos en nuestra DB */
    const adminSnap = await adminRepo.getAdminByEmail(email);

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

module.exports = { adminAuth };
