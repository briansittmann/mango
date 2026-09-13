-- Función del ciclo de facturación — ARCHITECTURE.md §6.
-- El mes del usuario no es date_trunc('month', fecha): es un rango que arranca el día
-- dia_inicio_ciclo, calculado en el timezone del usuario. De esta función cuelgan
-- presupuestos, margen libre, carga de fijos, selector de mes y gráficos (§6) — se calcula
-- una vez y todo consulta el mismo rango.
create or replace function rango_ciclo(
  p_dia_inicio integer,
  p_timezone text,
  p_fecha_ref timestamptz default now()
)
returns table(inicio timestamptz, fin timestamptz)
language sql
stable
as $$
  with local as (
    select (p_fecha_ref at time zone p_timezone) as ts_local
  ),
  ancla as (
    select
      case
        when extract(day from ts_local)::integer >= p_dia_inicio
          then date_trunc('month', ts_local) + make_interval(days => p_dia_inicio - 1)
        else date_trunc('month', ts_local) - interval '1 month' + make_interval(days => p_dia_inicio - 1)
      end as inicio_local
    from local
  )
  select
    (inicio_local at time zone p_timezone) as inicio,
    ((inicio_local + interval '1 month') at time zone p_timezone) as fin
  from ancla;
$$;

comment on function rango_ciclo(integer, text, timestamptz) is
  'Rango [inicio, fin) del ciclo que contiene p_fecha_ref, como instantes UTC (timestamptz), calculado sobre el calendario local del timezone dado. Ej: dia_inicio=26, timezone=Europe/Dublin, cualquier fecha entre el 26/8 y el 25/9 local cae en [2026-08-26 00:00 Europe/Dublin, 2026-09-26 00:00 Europe/Dublin).';

-- Atajo: resuelve dia_inicio_ciclo y timezone desde usuarios.
create or replace function rango_ciclo_usuario(
  p_usuario_id uuid,
  p_fecha_ref timestamptz default now()
)
returns table(inicio timestamptz, fin timestamptz)
language sql
stable
as $$
  select r.inicio, r.fin
  from usuarios u
  cross join lateral rango_ciclo(u.dia_inicio_ciclo, u.timezone, p_fecha_ref) r
  where u.id = p_usuario_id;
$$;

comment on function rango_ciclo_usuario(uuid, timestamptz) is
  'rango_ciclo() resolviendo dia_inicio_ciclo y timezone del usuario. Uso típico: select * from transacciones, rango_ciclo_usuario($usuario_id) c where fecha >= c.inicio and fecha < c.fin and borrado_en is null.';
