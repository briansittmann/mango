-- Meta de ahorro mensual por usuario (add-savings-progress, proposal.md §A).
alter table usuarios
  add column meta_ahorro_mensual numeric(12,2)
    check (meta_ahorro_mensual is null or meta_ahorro_mensual > 0);

comment on column usuarios.meta_ahorro_mensual is
  'Meta de ahorro por ciclo. Null = el usuario nunca la fijó, y la tarjeta de ahorro se muestra sin barra ni caption. Vive en usuarios, no en presupuestos: no tiene categoria_id, tiene polaridad opuesta a un presupuesto (es un piso, no un techo) y no debe restar del margen libre igual que presupuestos no lo hace (proposal.md §A).';
