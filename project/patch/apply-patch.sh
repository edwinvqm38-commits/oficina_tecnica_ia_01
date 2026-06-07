#!/usr/bin/env bash
# ============================================================
# apply-patch.sh — Aplica el polish visual al codebase Next.js
# Generado por Claude Design · OFICINA TECNICA
#
# USO:
#   1. Clona o actualiza tu repo local:
#        git clone https://github.com/edwinvqm38-commits/ia-gerencial-oficina-virtual
#        cd ia-gerencial-oficina-virtual
#
#   2. Coloca esta carpeta "patch/" en la raíz del repo.
#
#   3. Ejecuta:
#        chmod +x patch/apply-patch.sh
#        ./patch/apply-patch.sh
#
#   4. El script crea la rama, copia los archivos, commitea y pushea.
#      Luego abre GitHub para que crees el PR manualmente.
# ============================================================

set -e

BRANCH="claude-visual-polish"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo ""
echo "=== OFICINA TECNICA — Visual Polish Patch ==="
echo "Repo raíz : $REPO_ROOT"
echo "Rama      : $BRANCH"
echo ""

# ── 1. Verificar que estamos en el repo correcto ────────────
cd "$REPO_ROOT"

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "ERROR: No es un repositorio git. Ejecuta desde la raíz del repo."
  exit 1
fi

# ── 2. Asegurarse de estar en main actualizado ──────────────
CURRENT=$(git branch --show-current)
echo "→ Rama actual: $CURRENT"

if [ "$CURRENT" != "main" ]; then
  echo "→ Cambiando a main..."
  git checkout main
fi

echo "→ Actualizando main desde origin..."
git pull origin main --quiet

# ── 3. Crear rama nueva ──────────────────────────────────────
if git show-ref --quiet refs/heads/"$BRANCH"; then
  echo "⚠  La rama '$BRANCH' ya existe. Eliminándola para recrear limpio..."
  git branch -D "$BRANCH"
fi

echo "→ Creando rama: $BRANCH"
git checkout -b "$BRANCH"

# ── 4. Copiar archivos modificados ───────────────────────────
echo ""
echo "→ Aplicando archivos modificados..."

FILES=(
  "app/globals.css"
  "components/ai-office/AISidebar.tsx"
  "components/ai-office/AITopbar.tsx"
  "components/ai-office/AIPageHeader.tsx"
  "components/ai-office/AIContextPanel.tsx"
  "components/ai-office/AIAgentCard.tsx"
  "components/ai-office/AIApprovalQueue.tsx"
  "components/ai-office/AIProjectPortfolio.tsx"
  "components/ai-office/AISkillRegistry.tsx"
  "components/ai-office/AIAgentResponsePanel.tsx"
  "components/ai-office/AIActivityPanel.tsx"
)

for FILE in "${FILES[@]}"; do
  SRC="$SCRIPT_DIR/$FILE"
  DEST="$REPO_ROOT/$FILE"
  if [ -f "$SRC" ]; then
    mkdir -p "$(dirname "$DEST")"
    cp "$SRC" "$DEST"
    echo "   ✓ $FILE"
  else
    echo "   ✗ FALTA: $SRC"
  fi
done

# ── 5. Verificar cambios ────────────────────────────────────
echo ""
echo "→ Archivos modificados:"
git diff --name-only

# ── 6. Lint opcional ────────────────────────────────────────
echo ""
read -p "¿Ejecutar 'npm run lint' antes del commit? [y/N] " RUN_LINT
if [[ "$RUN_LINT" =~ ^[Yy]$ ]]; then
  echo "→ Ejecutando lint..."
  npm run lint
fi

# ── 7. Stage + commit ───────────────────────────────────────
echo ""
echo "→ Staging archivos..."
git add app/globals.css components/ai-office/

echo "→ Commiteando..."
git commit -m "style: polish executive platform UI

- AISidebar: replace Unicode icons with inline SVG (16x16 stroke-based)
- AITopbar: reduce height 54px→48px, clean chips, SVG folder icon
- AIPageHeader: reduce title text-lg→text-[15px], remove card wrapper
- AIContextPanel: align sticky top to 48px, compact CtxCard/Metric primitives
- AIAgentCard: remove decorative orange circle, avatar 48→32px, tighter padding
- AIApprovalQueue: semantic left border by risk, flat metadata rows
- AIProjectPortfolio: semantic progress bar colour by status, clean kanban columns
- AISkillRegistry: eliminate violet CompactBlock, unify to slate InfoBlock
- AIAgentResponsePanel: purple→slate (interpretations), sky→blue (questions)
- AIActivityPanel: oversized heading reduced, simplified dot colours
- globals.css: add CSS design tokens and semantic progress classes

No backend, no new routes, no new libraries, no Supabase, no LLM.
Visual-only changes."

# ── 8. Push ────────────────────────────────────────────────
echo ""
echo "→ Pusheando rama al origin..."
git push -u origin "$BRANCH"

# ── 9. Instrucciones PR ────────────────────────────────────
echo ""
echo "============================================"
echo "✅  Rama pusheada: $BRANCH"
echo ""
echo "SIGUIENTE PASO — Crear el Pull Request:"
echo ""
echo "  Título : style: polish executive platform UI"
echo "  Base   : main"
echo "  Head   : $BRANCH"
echo ""
echo "  URL directa:"
echo "  https://github.com/edwinvqm38-commits/ia-gerencial-oficina-virtual/compare/main...$BRANCH"
echo ""
echo "  ⚠ NO hagas merge hasta revisar el build."
echo "============================================"
echo ""
