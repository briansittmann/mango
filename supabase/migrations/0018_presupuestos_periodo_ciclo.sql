-- presupuestos por ciclo — fix-free-margin-envelope-budgets (design.md D3, D6).
-- periodo deja de ser 'mensual' y pasa a ser el primer día del ciclo de facturación, así
-- cada ciclo guarda su propio presupuesto por categoría. monto admite null como marca
-- explícita de "sin presupuesto en este ciclo".
--
-- Sin paso de datos: no hay base real. Una base que corrió el 0012 viejo ('mensual') falla
-- el cast en vez de adivinar un ciclo.
-- El unique (usuario_id, categoria_id, periodo) del 0006 se mantiene: alter column type
-- reconstruye su índice. El check (monto > 0) del 0006 pasa con null y sigue rechazando 0 y
-- negativos, así que no se reescribe.
alter table presupuestos
  alter column periodo drop default,
  alter column periodo type date using periodo::date,
  alter column monto drop not null;

comment on column presupuestos.monto is
  'Techo de la categoría en el ciclo de periodo. Null = marca explícita de "sin presupuesto en este ciclo": el usuario lo borró, y la fila hace que el ciclo no quede vacío para que la copia no lo traiga de vuelta (ver periodo).';

comment on column presupuestos.periodo is
  'Primer día (fecha local) del ciclo de facturación, calculado con rango_ciclo_usuario; una fila por categoría por ciclo. Cuando un ciclo pasa a ser el actual y no tiene filas (marcas incluidas), se copian todas las filas del ciclo anterior más reciente que tenga alguna, marcas incluidas. Nunca se escribe un ciclo posterior al actual. Editar o crear escribe solo el ciclo actual; borrar un presupuesto escribe una marca (monto null); borrar la categoría borra sus filas de todos los ciclos.';

comment on column usuarios.meta_ahorro_mensual is
  'Meta de ahorro por ciclo. Null = el usuario nunca la fijó, y la tarjeta de ahorro se muestra sin barra ni caption. Vive en usuarios, no en presupuestos: no tiene categoria_id y tiene polaridad opuesta a un presupuesto (es un piso, no un techo) (proposal.md §A).';
