# ROADMAP — OFICINA TECNICA (IA Gerencial multiagente)

> Prototipo HTML/React en `IA Gerencial.html`. Arquitectura por archivos:
> `ig-data.js` (datos mock), `ig-store.js` (persistencia localStorage + pub/sub),
> `ig-ai.js` (motor IA: personas, skills, KB, llamadas a window.claude),
> `ig-icons.jsx`, `ig-shell.jsx` (Sidebar/Topbar/ContextPanel/AppShell),
> `ig-views.jsx` (Dashboard, Oficina, Aprobaciones, Proyectos, Skills),
> `ig-chat.jsx` (chat privado 1:1), `ig-bandeja.jsx` (solicitud multiagente),
> `ig-kb.jsx` (conocimiento/Obsidian, timeline, reporte), `ig-extras.jsx`
> (formularios proyecto/skill, buscador, notificaciones, export/import),
> `ig-app.jsx` (router + tweaks + settings). Carga en ese orden en el HTML.

## Estado de fases

- [x] **Base** — 11 vistas, diseño, persistencia local, IA real en chat/bandeja/reporte, KB con validación GG, timeline, buscador, notificaciones, export/import.
- [~] **Fase 1 — Mesa de trabajo (chat general)**: sala común; agentes "levantan la mano" según relevancia; respuesta por turnos; @mención directa; debate agente-a-agente; botón pasar a privado. → `ig-roundtable.jsx`
- [ ] **Fase 2 — Registro dinámico de agentes**: mover agentes de `ig-data.js` al store. Crear agente desde la app (nombre, rol, color/iniciales, modelo, skills, jefe directo, sub-agentes, prompt/tono). Editar/eliminar. → `ig-agents.js` + `ig-agent-builder.jsx`
- [ ] **Fase 3 — Organigrama editable**: árbol multinivel (GG→agente→sub-agente). Arrastrar para cambiar jefe, añadir/quitar nodos, editar rol al clic, asignar agente↔proyecto. → reescribir OrgChart en `ig-org.jsx`
- [ ] **Fase 4 — Bóveda Obsidian + Agente Archivista**: vista de bóveda con árbol de carpetas (`/Agentes/<agente>/skills`, `/Proyectos/<id>/solicitudes`, `/Bitacora`, `/Conocimiento`, `/MOC.md`). Agente Archivista visible + automatización que enruta cada evento a su nota .md. Export de bóveda como ZIP de .md. Skill del archivista que mejora. → `ig-vault.jsx` + `ig-archivist.js`
- [ ] **Fase 5 — Modelos locales (Ollama)**: selector desplegable de modelos "descargados" (simulado), recomendación automática por tipo de análisis, indicador requerido vs disponible, sugerencias para descargar, modelo por defecto por agente. → `ig-models.js` + UI en topbar/agent-builder. Modelos base a poblar: Llama 3.x, Qwen 2.5, Mistral, Phi-3, Gemma2 (libres).
- [ ] **Fase 6 — PDF + archivos vinculados**: extracción de texto de PDF (pdf.js), archivos atados a su conversación (sin cruce). Doc: en app local real usar Google Drive + agente organizador. → ampliar `ig-chat.jsx`/`ig-roundtable.jsx`

## Guía de conexión REAL (app local en tu PC) — pendiente de documentar a detalle
- **Obsidian**: plugin *Local REST API* (expone https://127.0.0.1:27124). El archivista hace PUT/POST de notas .md a la bóveda real.
- **Ollama**: instalar Ollama, `OLLAMA_ORIGINS=*` para CORS, fetch a `http://localhost:11434/api/chat`. Reemplazar `callClaude` por `callOllama(model, messages)`.
- **Drive**: Google Drive API + carpeta por proyecto; agente organizador nombra y vincula.

## Cómo retomar
Decir: "continúa con la Fase N". El asistente NO puede notificar reset de tokens; el usuario reinicia la conversación cuando quiera.
