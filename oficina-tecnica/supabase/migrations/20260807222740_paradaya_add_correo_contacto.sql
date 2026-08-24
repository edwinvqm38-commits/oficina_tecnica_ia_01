alter table public.paradaya_tecnicos
    add column if not exists correo_contacto text;

comment on column public.paradaya_tecnicos.correo_contacto is
    'Opcional; para que la empresa pueda responderle al tecnico por correo aunque haya ingresado con su numero de telefono.';;
