-- 006_seed_recursos_demo.sql
-- Seed inicial de recursos demo/base OPS-IA V2 / SGP-LITE

begin;

with seed_recursos (
  codigo_recurso,
  codigo_eka,
  codigo_fabricante,
  tipo_recurso_nombre,
  descripcion,
  unidad_codigo,
  precio_unitario_ref,
  moneda_codigo,
  proveedor_nombre,
  marca_nombre,
  modelo,
  tiempo_entrega_ref,
  estado,
  fecha_actualizacion,
  observaciones,
  metadata
) as (
  values
    (
      'REC-2026-0001',
      'EKA-MAT-001',
      'IND-N2XOH-316',
      'Materiales',
      'Cable N2XOH 3x16 mm2',
      'm',
      19.8000,
      'PEN',
      'Suministros Lima',
      'Indeco',
      'N2XOH-316',
      '3 días',
      'Activo',
      date '2026-05-14',
      'Uso en circuitos de potencia.',
      '{"documentos_pendientes_migracion": true, "ficha_tecnica": "Ficha_Cable_N2XOH.pdf", "imagen": "img_cable_n2xoh.jpg", "archivos": ["Certificado_calidad.pdf"]}'::jsonb
    ),
    (
      'REC-2026-0002',
      'EKA-EQP-014',
      'SCH-TAB-24P',
      'Equipos',
      'Tablero eléctrico adosado 24 polos',
      'und',
      1280.0000,
      'PEN',
      'ElectroSur',
      'Schneider',
      'Prisma 24P',
      '7 días',
      'Activo',
      date '2026-05-14',
      'Incluye riel DIN y borneras.',
      '{"documentos_pendientes_migracion": true, "ficha_tecnica": "Ficha_Tablero_24P.pdf", "imagen": "img_tablero_24p.jpg", "archivos": ["Plano_tablero.dwg"]}'::jsonb
    ),
    (
      'REC-2026-0003',
      'EKA-HER-003',
      'FLK-17BMAX',
      'Herramientas',
      'Multímetro digital',
      'und',
      185.0000,
      'USD',
      'Proveedor Industrial',
      'Fluke',
      '17B Max',
      '5 días',
      'Por revisar',
      date '2026-05-13',
      'Validar calibración anual.',
      '{"documentos_pendientes_migracion": true, "ficha_tecnica": "Ficha_Fluke_17B.pdf", "imagen": "img_fluke_17b.jpg", "archivos": ["Manual_uso_fluke.pdf"]}'::jsonb
    ),
    (
      'REC-2026-0004',
      'EKA-CON-022',
      '3M-TA-18',
      'Consumibles',
      'Cinta aislante 3M',
      'und',
      8.7000,
      'PEN',
      'Suministros Lima',
      '3M',
      'Temflex 1700',
      '2 días',
      'Activo',
      date '2026-05-12',
      '',
      '{"documentos_pendientes_migracion": true, "ficha_tecnica": "Ficha_Cinta_3M.pdf", "imagen": "img_cinta_3m.jpg", "archivos": []}'::jsonb
    ),
    (
      'REC-2026-0005',
      'EKA-SRV-008',
      'SRV-MANT-ELEC',
      'Sub contratos',
      'Servicio de mantenimiento eléctrico',
      'glb',
      4200.0000,
      'PEN',
      'Servicios Técnicos',
      'Sin marca',
      'N/A',
      '10 días',
      'Activo',
      date '2026-05-14',
      'Incluye inspección y reporte.',
      '{"documentos_pendientes_migracion": true, "ficha_tecnica": "Alcance_mantenimiento.docx", "imagen": null, "archivos": ["SLA_servicio.pdf"]}'::jsonb
    ),
    ('REC-2026-0006', 'EKA-MAN-006', 'FAB-0006', 'Mano de obra directa', 'Mano de obra directa demo 6', 'und', 62.2000, 'USD', 'Suministros Lima', 'Schneider', 'M-006', '7 días', 'Activo', date '2026-05-01', 'Demo catálogo local.', '{"documentos_pendientes_migracion": true, "ficha_tecnica": "Ficha_6.pdf", "imagen": "img_6.jpg", "archivos": ["adjunto_6.pdf"]}'::jsonb),
    ('REC-2026-0007', 'EKA-MAN-007', 'FAB-0007', 'Mano de obra indirecta', 'Mano de obra indirecta demo 7', 'm', 68.4000, 'PEN', 'ElectroSur', 'Indeco', 'M-007', '8 días', 'Inactivo', date '2026-05-02', '', '{"documentos_pendientes_migracion": false}'::jsonb),
    ('REC-2026-0008', 'EKA-EPP-008', 'FAB-0008', 'EPPs', 'EPPs demo 8', 'm2', 74.6000, 'PEN', 'Proveedor Industrial', '3M', 'M-008', '9 días', 'Por revisar', date '2026-05-03', 'Demo catálogo local.', '{"documentos_pendientes_migracion": false}'::jsonb),
    ('REC-2026-0009', 'EKA-EXA-009', 'FAB-0009', 'Examen médico', 'Examen médico demo 9', 'm3', 80.8000, 'PEN', 'Servicios Técnicos', 'Fluke', 'M-009', '10 días', 'Activo', date '2026-05-04', '', '{"documentos_pendientes_migracion": true, "ficha_tecnica": "Ficha_9.pdf", "imagen": "img_9.jpg", "archivos": ["adjunto_9.pdf"]}'::jsonb),
    ('REC-2026-0010', 'EKA-CAP-010', 'FAB-0010', 'Capacitaciones', 'Capacitaciones demo 10', 'kg', 87.0000, 'PEN', 'Ferretería Central', 'Siemens', 'M-010', '11 días', 'Inactivo', date '2026-05-05', 'Demo catálogo local.', '{"documentos_pendientes_migracion": false}'::jsonb),
    ('REC-2026-0011', 'EKA-CUR-011', 'FAB-0011', 'Cursos de inducción', 'Cursos de inducción demo 11', 'glb', 93.2000, 'USD', 'Suministros Lima', 'ABB', 'M-011', '12 días', 'Por revisar', date '2026-05-06', '', '{"documentos_pendientes_migracion": false}'::jsonb),
    ('REC-2026-0012', 'EKA-CUR-012', 'FAB-0012', 'Cursos EKA', 'Cursos EKA demo 12', 'día', 99.4000, 'PEN', 'ElectroSur', 'Genérico', 'M-012', '1 días', 'Activo', date '2026-05-07', 'Demo catálogo local.', '{"documentos_pendientes_migracion": true, "ficha_tecnica": "Ficha_12.pdf", "imagen": "img_12.jpg", "archivos": ["adjunto_12.pdf"]}'::jsonb),
    ('REC-2026-0013', 'EKA-LAV-013', 'FAB-0013', 'Lavado de uniforme', 'Lavado de uniforme demo 13', 'mes', 105.6000, 'PEN', 'Proveedor Industrial', 'Sin marca', 'M-013', '2 días', 'Inactivo', date '2026-05-08', '', '{"documentos_pendientes_migracion": false}'::jsonb),
    ('REC-2026-0014', 'EKA-ALI-014', 'FAB-0014', 'Alimentación', 'Alimentación demo 14', 'h', 111.8000, 'PEN', 'Servicios Técnicos', 'Schneider', 'M-014', '3 días', 'Por revisar', date '2026-05-09', 'Demo catálogo local.', '{"documentos_pendientes_migracion": false}'::jsonb),
    ('REC-2026-0015', 'EKA-REG-015', 'FAB-0015', 'Reglamento de ingreso', 'Reglamento de ingreso demo 15', 'juego', 118.0000, 'PEN', 'Ferretería Central', 'Indeco', 'M-015', '4 días', 'Activo', date '2026-05-10', '', '{"documentos_pendientes_migracion": true, "ficha_tecnica": "Ficha_15.pdf", "imagen": "img_15.jpg", "archivos": ["adjunto_15.pdf"]}'::jsonb),
    ('REC-2026-0016', 'EKA-ANT-016', 'FAB-0016', 'Antecedentes policiales', 'Antecedentes policiales demo 16', 'lote', 124.2000, 'USD', 'Suministros Lima', '3M', 'M-016', '5 días', 'Inactivo', date '2026-05-11', 'Demo catálogo local.', '{"documentos_pendientes_migracion": false}'::jsonb),
    ('REC-2026-0017', 'EKA-MAT-017', 'FAB-0017', 'Materiales', 'Materiales demo 17', 'und', 130.4000, 'PEN', 'ElectroSur', 'Fluke', 'M-017', '6 días', 'Por revisar', date '2026-05-12', '', '{"documentos_pendientes_migracion": false}'::jsonb),
    ('REC-2026-0018', 'EKA-CON-018', 'FAB-0018', 'Consumibles', 'Consumibles demo 18', 'm', 136.6000, 'PEN', 'Proveedor Industrial', 'Siemens', 'M-018', '7 días', 'Activo', date '2026-05-13', 'Demo catálogo local.', '{"documentos_pendientes_migracion": true, "ficha_tecnica": "Ficha_18.pdf", "imagen": "img_18.jpg", "archivos": ["adjunto_18.pdf"]}'::jsonb),
    ('REC-2026-0019', 'EKA-HER-019', 'FAB-0019', 'Herramientas', 'Herramientas demo 19', 'm2', 142.8000, 'PEN', 'Servicios Técnicos', 'ABB', 'M-019', '8 días', 'Inactivo', date '2026-05-14', '', '{"documentos_pendientes_migracion": false}'::jsonb),
    ('REC-2026-0020', 'EKA-EQU-020', 'FAB-0020', 'Equipos', 'Equipos demo 20', 'm3', 149.0000, 'PEN', 'Ferretería Central', 'Genérico', 'M-020', '9 días', 'Por revisar', date '2026-05-15', 'Demo catálogo local.', '{"documentos_pendientes_migracion": false}'::jsonb),
    ('REC-2026-0021', 'EKA-VEH-021', 'FAB-0021', 'Vehículos', 'Vehículos demo 21', 'kg', 155.2000, 'USD', 'Suministros Lima', 'Sin marca', 'M-021', '10 días', 'Activo', date '2026-05-16', '', '{"documentos_pendientes_migracion": true, "ficha_tecnica": "Ficha_21.pdf", "imagen": "img_21.jpg", "archivos": ["adjunto_21.pdf"]}'::jsonb),
    ('REC-2026-0022', 'EKA-TRA-022', 'FAB-0022', 'Transporte', 'Transporte demo 22', 'glb', 161.4000, 'PEN', 'ElectroSur', 'Schneider', 'M-022', '11 días', 'Inactivo', date '2026-05-17', 'Demo catálogo local.', '{"documentos_pendientes_migracion": false}'::jsonb),
    ('REC-2026-0023', 'EKA-SUB-023', 'FAB-0023', 'Sub contratos', 'Sub contratos demo 23', 'día', 167.6000, 'PEN', 'Proveedor Industrial', 'Indeco', 'M-023', '12 días', 'Por revisar', date '2026-05-18', '', '{"documentos_pendientes_migracion": false}'::jsonb),
    ('REC-2026-0024', 'EKA-GAS-024', 'FAB-0024', 'Gastos generales', 'Gastos generales demo 24', 'mes', 173.8000, 'PEN', 'Servicios Técnicos', '3M', 'M-024', '1 días', 'Activo', date '2026-05-19', 'Demo catálogo local.', '{"documentos_pendientes_migracion": true, "ficha_tecnica": "Ficha_24.pdf", "imagen": "img_24.jpg", "archivos": ["adjunto_24.pdf"]}'::jsonb),
    ('REC-2026-0025', 'EKA-MAN-025', 'FAB-0025', 'Mano de obra directa', 'Mano de obra directa demo 25', 'h', 180.0000, 'PEN', 'Ferretería Central', 'Fluke', 'M-025', '2 días', 'Inactivo', date '2026-05-20', '', '{"documentos_pendientes_migracion": false}'::jsonb),
    ('REC-2026-0026', 'EKA-MAN-026', 'FAB-0026', 'Mano de obra indirecta', 'Mano de obra indirecta demo 26', 'juego', 186.2000, 'USD', 'Suministros Lima', 'Siemens', 'M-026', '3 días', 'Por revisar', date '2026-05-21', 'Demo catálogo local.', '{"documentos_pendientes_migracion": false}'::jsonb),
    ('REC-2026-0027', 'EKA-EPP-027', 'FAB-0027', 'EPPs', 'EPPs demo 27', 'lote', 192.4000, 'PEN', 'ElectroSur', 'ABB', 'M-027', '4 días', 'Activo', date '2026-05-22', '', '{"documentos_pendientes_migracion": true, "ficha_tecnica": "Ficha_27.pdf", "imagen": "img_27.jpg", "archivos": ["adjunto_27.pdf"]}'::jsonb),
    ('REC-2026-0028', 'EKA-EXA-028', 'FAB-0028', 'Examen médico', 'Examen médico demo 28', 'und', 198.6000, 'PEN', 'Proveedor Industrial', 'Genérico', 'M-028', '5 días', 'Inactivo', date '2026-05-23', 'Demo catálogo local.', '{"documentos_pendientes_migracion": false}'::jsonb),
    ('REC-2026-0029', 'EKA-CAP-029', 'FAB-0029', 'Capacitaciones', 'Capacitaciones demo 29', 'm', 204.8000, 'PEN', 'Servicios Técnicos', 'Sin marca', 'M-029', '6 días', 'Por revisar', date '2026-05-24', '', '{"documentos_pendientes_migracion": false}'::jsonb),
    ('REC-2026-0030', 'EKA-CUR-030', 'FAB-0030', 'Cursos de inducción', 'Cursos de inducción demo 30', 'm2', 211.0000, 'PEN', 'Ferretería Central', 'Schneider', 'M-030', '7 días', 'Activo', date '2026-05-25', 'Demo catálogo local.', '{"documentos_pendientes_migracion": true, "ficha_tecnica": "Ficha_30.pdf", "imagen": "img_30.jpg", "archivos": ["adjunto_30.pdf"]}'::jsonb)
)
insert into public.recursos (
  codigo_recurso,
  codigo_eka,
  codigo_fabricante,
  tipo_recurso_id,
  tipo_recurso_nombre,
  descripcion,
  unidad_id,
  unidad_codigo,
  precio_unitario_ref,
  moneda_codigo,
  proveedor_id,
  proveedor_nombre,
  marca_id,
  marca_nombre,
  modelo,
  tiempo_entrega_ref,
  estado,
  fecha_actualizacion,
  observaciones,
  metadata
)
select
  s.codigo_recurso,
  s.codigo_eka,
  s.codigo_fabricante,
  tr.id as tipo_recurso_id,
  s.tipo_recurso_nombre,
  s.descripcion,
  um.id as unidad_id,
  s.unidad_codigo,
  s.precio_unitario_ref,
  s.moneda_codigo,
  p.id as proveedor_id,
  s.proveedor_nombre,
  m.id as marca_id,
  s.marca_nombre,
  s.modelo,
  s.tiempo_entrega_ref,
  s.estado,
  s.fecha_actualizacion,
  s.observaciones,
  s.metadata
from seed_recursos s
left join public.catalog_tipos_recurso tr
  on tr.nombre = s.tipo_recurso_nombre
left join public.catalog_unidades_medida um
  on um.codigo = s.unidad_codigo
left join public.proveedores p
  on p.nombre = s.proveedor_nombre
left join public.marcas m
  on m.nombre = s.marca_nombre
on conflict (codigo_recurso) do update set
  codigo_eka = excluded.codigo_eka,
  codigo_fabricante = excluded.codigo_fabricante,
  tipo_recurso_id = excluded.tipo_recurso_id,
  tipo_recurso_nombre = excluded.tipo_recurso_nombre,
  descripcion = excluded.descripcion,
  unidad_id = excluded.unidad_id,
  unidad_codigo = excluded.unidad_codigo,
  precio_unitario_ref = excluded.precio_unitario_ref,
  moneda_codigo = excluded.moneda_codigo,
  proveedor_id = excluded.proveedor_id,
  proveedor_nombre = excluded.proveedor_nombre,
  marca_id = excluded.marca_id,
  marca_nombre = excluded.marca_nombre,
  modelo = excluded.modelo,
  tiempo_entrega_ref = excluded.tiempo_entrega_ref,
  estado = excluded.estado,
  fecha_actualizacion = excluded.fecha_actualizacion,
  observaciones = excluded.observaciones,
  metadata = excluded.metadata,
  updated_at = now();

commit;

-- =========================================================
-- Validación por tipo de recurso
-- =========================================================
select
  tipo_recurso_nombre,
  count(*) as total
from public.recursos
group by tipo_recurso_nombre
order by tipo_recurso_nombre;

-- =========================================================
-- Validación opcional de referencias no resueltas
-- Debe devolver 0 en todas las columnas si los seeds previos están completos.
-- =========================================================
select
  count(*) filter (where tipo_recurso_id is null) as recursos_sin_tipo_recurso_id,
  count(*) filter (where unidad_id is null) as recursos_sin_unidad_id,
  count(*) filter (where proveedor_id is null) as recursos_sin_proveedor_id,
  count(*) filter (where marca_id is null) as recursos_sin_marca_id
from public.recursos;
