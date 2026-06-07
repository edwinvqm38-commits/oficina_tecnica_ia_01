# Visual Polish Patch v2 — IA Gerencial / Oficina Técnica

Patch completo. Reemplaza **patch v1** completamente.
Aplica sobre **`claude-visual-polish`** (si ya tienes esa rama) o sobre **`main` limpio**.

## Archivos incluidos (14 archivos reales TSX/CSS)

```
patch2/
├── README.md
├── app/
│   └── globals.css                    ← tokens CSS completos
└── components/ai-office/
    ├── AIAppShell.tsx                 ← FIX CRÍTICO: layout h-screen flex
    ├── AISidebar.tsx                  ← sin lg:fixed, flex column, SVG icons
    ├── AITopbar.tsx                   ← 48px fijo, clean chips
    ├── AIPageHeader.tsx               ← sin card wrapper, texto compacto
    ├── AIContextPanel.tsx             ← limpio, sin ruido visual
    ├── AIAgentCard.tsx                ← sin círculo naranja, avatar 32px
    ├── AIApprovalQueue.tsx            ← borde izquierdo semántico, metadata plana
    ├── AIProjectPortfolio.tsx         ← barra de progreso semántica por estado
    ├── AISkillRegistry.tsx            ← sin violet, InfoBlock slate unificado
    ├── AIAgentResponsePanel.tsx       ← sin purple/sky, paleta reducida
    ├── AIActivityPanel.tsx            ← heading compacto, dots sobrios
    ├── AIApprovalsPage.tsx            ← sin violet/sky tiles
    ├── AIGerencialInboxPage.tsx       ← sin violet flow boxes
    ├── AIProjectsPage.tsx             ← tiles limpios, sin text-xl
    ├── AISkillsRegistryPage.tsx       ← tiles limpios
    └── AIVirtualOfficePage.tsx        ← mode tabs + collaboration panel limpios
```

---

## Aplicación manual (recomendada — sin commit automático)

```bash
# Opción A: sobre rama claude-visual-polish existente
git checkout claude-visual-polish

# Opción B: desde main limpio
git checkout main
git pull origin main
git checkout -b claude-visual-polish-v2

# Copiar archivos del patch al repo
cp patch2/app/globals.css                              app/globals.css
cp patch2/components/ai-office/*.tsx                   components/ai-office/

# Verificar cambios
git diff --name-only

# Lint + build (en tu entorno)
npm run lint
npm run build

# Si todo OK: commit y push manual
git add app/globals.css components/ai-office/
git commit -m "style: polish executive platform UI v2 — complete layout + page overhaul"
git push -u origin claude-visual-polish-v2
```

---

## Cambio crítico: `AIAppShell.tsx`

Este es el **cambio más importante**. El layout anterior usaba:
```tsx
// ❌ Antes — causa scroll global y sidebar "flotando"
<div className="min-h-screen">
  <AISidebar />
  <div className="lg:pl-60">       ← sidebar offset con padding
    <AITopbar />
    <div className="grid ...">
```

El nuevo layout usa la estructura del prototipo:
```tsx
// ✅ Ahora — h-screen + overflow-hidden + flex
<div className="flex h-screen flex-col overflow-hidden">
  <AITopbar />                     ← 48px fijo
  <div className="flex flex-1 overflow-hidden">
    <div className="lg:w-[240px]">
      <AISidebar />                ← columna flex, no position:fixed
    </div>
    <main className="flex-1 overflow-y-auto">
    <div className="xl:w-[272px]">
      <AIContextPanel />
```

Sin este cambio, el resto de mejoras visuales no surten efecto completo.

---

## Paleta unificada aplicada

| Rol | Color |
|---|---|
| Activo / decisión | Azul `#1a50d6` |
| Positivo / aprobado | Verde `#047857` |
| Advertencia / observado | Amber `#b45309` |
| Riesgo alto | Naranja `#c2410c` |
| Crítico / rechazado | Rojo `#b91c1c` |
| Neutro / futuro | Slate `#64748b` |
| **Eliminados** | ~~violet, sky, purple~~ |

---

## Restricciones respetadas

- ✅ Sin backend, Supabase, LLM real, Obsidian
- ✅ Sin librerías nuevas
- ✅ Sin rutas nuevas (`/`, `/oficina`, `/bandeja`, `/aprobaciones`, `/proyectos`, `/skills`)
- ✅ Sin commit/push automático
- ✅ Solo archivos reales TSX/CSS
- ✅ Compatible con `npm run lint` y `npm run build`
