# Google Drive como almacén documental

Objetivo: Supabase guarda datos, relaciones, URLs e IDs. Google Drive guarda archivos reales: imágenes, PDFs, fichas técnicas, sustentos, anexos y documentos generados.

## Carpeta raíz

Drive raíz configurado:

```txt
1tuD18oZzxUTP2iZnrYd9duRd03W4a4ZF
```

URL:

```txt
https://drive.google.com/drive/u/0/folders/1tuD18oZzxUTP2iZnrYd9duRd03W4a4ZF
```

## Variables necesarias

Para que la app suba archivos reales a Drive, configura en `.env.local` y tambien en Vercel > Project Settings > Environment Variables:

```env
GOOGLE_DRIVE_ROOT_FOLDER_ID=1tuD18oZzxUTP2iZnrYd9duRd03W4a4ZF
GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=tu-service-account@tu-proyecto.iam.gserviceaccount.com
GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Para cuentas personales de Google Drive, el service account puede fallar con falta de cuota. En ese caso configura OAuth para que los archivos se creen usando la cuota de tu cuenta de Drive:

```env
GOOGLE_DRIVE_OAUTH_CLIENT_ID=...
GOOGLE_DRIVE_OAUTH_CLIENT_SECRET=...
GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN=...
```

Si estas variables OAuth existen, la app las usa primero. Si no existen, usa el service account.

Importante:

- Comparte la carpeta raiz de Drive con el correo del service account como Editor.
- No pegues estas credenciales en codigo ni en GitHub.
- Si el private key viene en varias lineas, dejalo con `\n` dentro del valor.
- Despues de cambiar variables en Vercel, redeploy.

## Estructura de carpetas

```txt
OFICINA_IA_ROOT/
  01_RECURSOS/
    REC-2026-0031/
      01_FICHAS_TECNICAS/
      02_IMAGENES/
      03_ARCHIVOS/
      04_COTIZACION/

  02_COTIZACIONES/
    COT-EKA-2026-143/
      00_CONTROL/
      01_DOCUMENTOS_CLIENTE/
      02_PROPUESTA/
        01_Alcance técnico/
        02_Alcance económico/
        03_Cronograma/
        04_Organigrama/
        05_Plan de trabajo/
        06_Experiencia CV Sustentos/
        07_Anexos/
      03_REQUERIMIENTOS/
      04_COTIZACIONES_PROVEEDORES/
      05_ANALISIS_Y_COSTOS/
      06_REVISION_GERENCIA/
      07_ENVIO_CLIENTE/
      99_ARCHIVO/
```

## Qué se guarda en Supabase

Supabase no guarda binarios. Solo metadata:

```json
{
  "resource_files": {
    "datasheet": [
      {
        "drive_file_id": "...",
        "drive_folder_id": "...",
        "drive_url": "https://drive.google.com/file/d/.../view",
        "file_name": "ficha.pdf",
        "file_type": "datasheet",
        "mime_type": "application/pdf",
        "size": 12345,
        "uploaded_at": "2026-07-02T..."
      }
    ]
  }
}
```

## Estado actual implementado

Implementado:

- Recursos suben archivos nuevos a Google Drive mediante `/api/drive/upload`.
- Al crear una cotización, la app crea/reutiliza automáticamente su estructura Drive mediante `/api/drive/quotation-folders`.
- Supabase guarda `metadata.google_drive.root_folder_id`, `root_folder_url` y los IDs/URLs de carpetas principales.
- Supabase guarda metadata de Drive dentro de `recursos.metadata.resource_files`.
- `100_clean_start_schema.sql`, `120_resource_files_and_filters.sql` y `026_resource_files_storage_policies.sql` ya no crean buckets de Supabase Storage.
- El endpoint `/api/drive/upload` puede crear carpetas para `resource`, `quotation`, `requirement` y `technical_proposal`.
- `170_proposal_document_audit.sql` prepara tablas para historico de observaciones y archivo/restauracion documental.

Pendiente recomendado:

- Conectar la UI de archivos de cotización al endpoint Drive.
- Conectar la UI de archivos de requerimiento al endpoint Drive.
- Crear tabla documental opcional `drive_file_links` si queremos auditar todos los archivos en una tabla única, además del metadata JSON.

## Regla de operación

No usar Supabase Storage para archivos nuevos.

Supabase:

- datos de recursos;
- cotizaciones;
- requerimientos;
- IDs de Drive;
- URLs de Drive;
- folder IDs;
- metadata documental.

Google Drive:

- PDF;
- imágenes;
- Excel;
- Word;
- planos;
- fichas técnicas;
- sustentos;
- anexos.
