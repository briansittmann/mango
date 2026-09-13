-- Extensiones necesarias. Supabase las trae activas por defecto en proyectos nuevos;
-- esto es defensivo e idempotente por si se corre en un proyecto limpio.
create extension if not exists pgcrypto;
