#!/bin/bash
# scripts/test-cierre.sh
# Ejecuta el cierre mensual completo: genera token + llama al endpoint
# Uso: bash scripts/test-cierre.sh <mesAnio>
# Ej:  bash scripts/test-cierre.sh "Junio 2026"

set -e

MES="${1:-Junio 2026}"
EMAIL="ereyes102504k@icloud.com"

echo "🔑 Generando token para $EMAIL..."
TOKEN=$(node scripts/get-token.js "$EMAIL" 2>/dev/null | grep -m1 '^eyJ')

if [ -z "$TOKEN" ]; then
  echo "❌ No se pudo generar el token"
  exit 1
fi

echo "✅ Token generado correctamente"
echo ""
echo "📤 Ejecutando cierre mensual para: $MES"
echo "──────────────────────────────────────────"
curl -s -X POST http://localhost:4000/api/admin/cerrar-mes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(printf '{"mesAnio": "%s"}' "$MES")" | python3 -m json.tool 2>/dev/null || curl -s -X POST http://localhost:4000/api/admin/cerrar-mes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(printf '{"mesAnio": "%s"}' "$MES")"
