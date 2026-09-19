-- gastos_fijos: recurrencias con final — proposal.md "Instalments are a recurrence with an
-- end, not a new entity" (add-recurring-expense-management).
-- repeticiones_totales null = "sin final" (el caso de hoy: alquiler, gimnasio...). No-null es
-- un plan de N pagos (una póliza en diez cuotas, por ejemplo).
-- repeticiones_insertadas cuenta inserciones, no filas vivas: se incrementa en cada inserción
-- del cron, definiciones sin final incluidas, y no se decrementa si una cuota se borra (D5 del
-- design.md) — un borrado es una corrección deliberada del usuario, no una cuota que no pasó.
-- El propio insert que hace insertadas = totales pone activo = false en la misma sentencia;
-- nadie tiene que acordarse de cancelar el plan.
alter table gastos_fijos
  add column repeticiones_totales integer
    check (repeticiones_totales is null or repeticiones_totales > 0),
  add column repeticiones_insertadas integer not null default 0
    check (repeticiones_insertadas >= 0),
  add constraint gastos_fijos_repeticiones_coherentes
    check (repeticiones_totales is null or repeticiones_insertadas <= repeticiones_totales);
