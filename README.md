# Sistemática Comercial — MVP

Web App mínima para controlar **adherencia a la Sistemática Comercial** (conductas por etapa) y **dificultades reportadas** por los ejecutivos.

## Estructura
```
frontend/
  index.html
  styles.css
  app.js
backend/
  Code.gs
data-templates/
  *.csv   (plantillas de pestañas de Google Sheets)
```

## Requisitos
- Google Workspace (o Gmail) con Google Sheets y Apps Script.
- Hosting estático (GitHub Pages, Netlify, Vercel o similar).

---

## 1) Backend en Google Sheets (Apps Script)

1. Crea un **Google Spreadsheet** nuevo y nómbralo, por ejemplo: `Sistemática Comercial - Datos`.
2. Crea las siguientes **pestañas** (sheet tabs) y copia **exactamente** estos **headers** (fila 1):

- `Users`: `email,name,role_id,manager_email,active`
- `Roles`: `role_id,role_name`
- `Stages`: `stage_id,stage_name,stage_order,description`
- `Agenda`: `role_id,period,day_or_week,description`
- `Macro`: `stage_id,activity_title,activity_description`
- `Checklist_Def`: `item_id,stage_id,role_id,checklist_text,frequency,sla_minutes,tool_ref`
- `Toolkit`: `tool_id,role_id,label,type,url`
- `Static_Intro`: `locale,html_content`
- `Submissions_Checklist`: `timestamp,user_email,role_id,stage_id,item_id,value,notes,client_org`
- `Difficulties`: `timestamp,user_email,role_id,stage_id,topic,description,severity,status,tags`

> Tip: Puedes importar las plantillas CSV de `data-templates/` para acelerar.

3. Abre **Extensiones → Apps Script** y pega el contenido de `backend/Code.gs`.
4. Guarda y ve a **Desplegar → Implementar como aplicación web**:
   - Ejecutar la app como: **Tú**
   - Quién tiene acceso: **Cualquiera con el enlace** (puedes restringir luego por dominio)
5. Copia la **URL /exec** que entrega el despliegue.

> **CORS**: en `Code.gs`, ajusta `ALLOWED_ORIGINS` si quieres restringir a tu dominio (p.ej. GitHub Pages).

---

## 2) Frontend

1. En `frontend/app.js`, reemplaza `GAS_BASE` con la **URL /exec** del paso anterior.
2. Sube el contenido de `frontend/` a tu hosting estático:
   - **GitHub Pages**: crea un repo, sube `frontend/` a la rama principal y activa Pages.
   - **Netlify/Vercel**: arrastra la carpeta `frontend/` o conecta el repo.

> Si usas GitHub Pages en un subpath, no necesitas cambios adicionales (no hay rutas relativas complejas).

---

## 3) Flujo de prueba rápido

1. En el Sheet, agrega al menos:
   - 1 fila en `Roles` (p.ej. `1, Ejecutivo Comercial`)
   - 2–4 filas en `Stages` (con `stage_order` incremental)
   - 2–5 filas en `Checklist_Def` para ese `role_id` y distintas `stage_id`
   - 1 fila en `Static_Intro` (columna `html_content` con un HTML sencillo)
2. Abre la Web App:
   - Escribe tu **email** y elige tu **rol**.
   - Revisa **Introducción**, **Agenda**, **Macro**.
   - En **Checklist**, marca **Sí/No** y **Guardar Checklist**.
   - En **Dificultades**, reporta un caso.
   - En **Historial**, verifica tus registros.
3. Comprueba que `Submissions_Checklist` y `Difficulties` se llenen en el Sheet.

---

## 4) Roadmap (siguiente iteración)

- Autenticación **Google Identity** (SSO) → asegurar `email`.
- Panel **Jefatura** (agregados por etapa/rol/periodo, export CSV).
- Ponderadores por `frequency`/`sla_minutes` para un **% de adherencia** por etapa.
- Gráficos de adherencia e insights de dificultades (tags, severidad, tiempo de resolución).
- Multi-tenant (agregar `tenant_id`) y versionado de sistemática por cliente.

---

## Soporte
Si te aparece `Unknown action` o errores 4xx/5xx:
- Verifica que las **pestañas** y **headers** existan con **exactamente** los nombres indicados.
- Revisa que pegaste **todo** `Code.gs` y que el despliegue es **Aplicación web**.
- Comprueba que `GAS_BASE` apunte a la **URL /exec** (no al editor).
