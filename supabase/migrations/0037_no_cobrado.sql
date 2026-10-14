-- Un cargo de un fijo cuyo día ya pasó se muestra cobrado aunque siga pendiente (Q4). Desde la
-- hoja del fijo la persona puede decir que no se cobró todavía: la marca lo deja pendiente en
-- pantalla hasta que se marque cobrado, lo complete el bot o lo edite la web (las tres lo
-- confirman, y un cargo confirmado se muestra cobrado con o sin la marca). Aditiva.

alter table transacciones
  add column if not exists no_cobrado boolean not null default false;

comment on column transacciones.no_cobrado is
  'Cargo de un fijo marcado como no cobrado después de su día: la pantalla lo muestra pendiente mientras estado = pendiente. Lo escribe setCharged (web); un cargo confirmado lo ignora.';
