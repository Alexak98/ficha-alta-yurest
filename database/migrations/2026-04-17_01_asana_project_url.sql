-- Añade la URL completa del proyecto Asana, para poder abrirlo directamente desde el gestor.
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS asana_project_url TEXT;
