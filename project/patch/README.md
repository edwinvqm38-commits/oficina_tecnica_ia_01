# Visual Polish Patch — IA Gerencial / Oficina Técnica

Generado por Claude Design. Contiene solo cambios visuales conservadores al codebase Next.js.

## Archivos incluidos

```
patch/
├── apply-patch.sh              ← script automático (bash)
├── README.md                   ← este archivo
├── app/
│   └── globals.css
└── components/
    └── ai-office/
        ├── AISidebar.tsx
        ├── AITopbar.tsx
        ├── AIPageHeader.tsx
        ├── AIContextPanel.tsx
        ├── AIAgentCard.tsx
        ├── AIApprovalQueue.tsx
        ├── AIProjectPortfolio.tsx
        ├── AISkillRegistry.tsx
        ├── AIAgentResponsePanel.tsx
        └── AIActivityPanel.tsx
```

## Aplicación automática (recomendada)

```bash
# Desde la raíz de tu repo clonado:
chmod +x patch/apply-patch.sh
./patch/apply-patch.sh
```

El script:
1. Verifica que estás en el repo correcto
2. Actualiza `main` desde origin
3. Crea la rama `claude-visual-polish`
4. Copia todos los archivos modificados
5. Pregunta si correr `npm run lint`
6. Commitea con mensaje descriptivo
7. Pushea la rama
8. Muestra la URL para crear el PR manualmente

## Aplicación manual (alternativa)

```bash
git checkout main
git pull origin main
git checkout -b claude-visual-polish

# Copia los archivos de patch/ a tu repo:
cp patch/app/globals.css app/globals.css
cp patch/components/ai-office/*.tsx components/ai-office/

npm run lint
npm run build

git add app/globals.css components/ai-office/
git commit -m "style: polish executive platform UI"
git push -u origin claude-visual-polish
```

Luego crea el PR en:
https://github.com/edwinvqm38-commits/ia-gerencial-oficina-virtual/compare/main...claude-visual-polish

## Resumen de cambios

| Archivo | Cambio |
|---|---|
| `globals.css` | Tokens CSS, clases semánticas `.progress-*`, scrollbar fino |
| `AISidebar.tsx` | Íconos Unicode → 12 SVGs inline consistentes, sidebar compacto |
| `AITopbar.tsx` | 54px → 48px, chips sobrios, ícono SVG |
| `AIPageHeader.tsx` | `text-lg` → `text-[15px]`, sin card wrapper |
| `AIContextPanel.tsx` | `top-[48px]`, CtxCard/Metric compactos |
| `AIAgentCard.tsx` | Sin círculo naranja decorativo, avatar 48→32px |
| `AIApprovalQueue.tsx` | Borde izquierdo semántico por riesgo, metadata plana |
| `AIProjectPortfolio.tsx` | Barra de progreso semántica por estado |
| `AISkillRegistry.tsx` | `violet` → `slate`, InfoBlock unificado |
| `AIAgentResponsePanel.tsx` | `purple` → `slate`, `sky` → `blue` |
| `AIActivityPanel.tsx` | Heading reducido, dots simplificados |

## Restricciones respetadas

- ✅ Sin backend, sin Supabase, sin LLM real
- ✅ Sin librerías nuevas
- ✅ Sin rutas nuevas
- ✅ Sin cambios de arquitectura
- ✅ Sin merge a main
- ✅ Solo archivos reales TSX/CSS del proyecto
