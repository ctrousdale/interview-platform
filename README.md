# Interview Practice

A local interview practice workspace built with React, Vite, Tailwind CSS and shadcn/ui components, an ASP.NET Core API, and PostgreSQL. The interface uses the [Carbonfox](https://github.com/EdenEast/nightfox.nvim) palette.

## Run with Docker Compose

```sh
docker compose up --build
```

Open <http://localhost:8080>. Practice sessions are stored in the `postgres_data` Docker volume and persist across container restarts. Stop the services with `docker compose down`; add `-v` only if you also want to delete the stored sessions.

The database credentials in `compose.yaml` are intended for local development only. Replace them and configure appropriate network and security settings before deploying anywhere else.
