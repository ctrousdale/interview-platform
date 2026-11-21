# Interview Practice

A local interview practice workspace built with React, Vite, Tailwind CSS and shadcn/ui components, an ASP.NET Core API, and PostgreSQL. The interface uses the [Carbonfox](https://github.com/EdenEast/nightfox.nvim) palette.

## Run with Docker Compose

```sh
docker compose up --build
```

Open <https://localhost:8443>. HTTP on <http://localhost:8080> redirects to HTTPS.

The home page links to algorithm practice, software design pattern practice, learnings, and the AI interviews work-in-progress page. The practice sections draw from the question library; existing behavioral, technical, and system-design questions remain available in the full catalog. Each problem has a shareable URL at `/problems/<id>`; select the practice.studio logo to return home. Drafts are retained while navigating within the open page but are not persisted across reloads.

On first startup, the frontend generates a self-signed certificate for `localhost` and `127.0.0.1` and stores it in the `frontend_tls` Docker volume. Browsers will warn that the certificate is not trusted; for local development, you can accept the warning or export the public certificate and add it to your browser or system trust store:

```sh
docker compose cp frontend:/etc/nginx/local-tls/localhost.crt ./localhost.crt
```

The certificate is for local development only. For a deployed site, configure a certificate issued for the actual hostname by a trusted certificate authority and update the HTTPS ports and redirect accordingly.

Practice sessions are stored in the `postgres_data` Docker volume and persist across container restarts. Stop the services with `docker compose down`; add `-v` only if you also want to delete the stored sessions and local TLS certificate.

## Answer editor

The practice workspace shows the question description and recent answers alongside the editor on wider screens. The answer editor supports plain text and Python. In Python mode, enable the formatter to format an answer, or enable language-server support for diagnostics and completion. Both tools are optional and send the current answer to the `python-tools` container; submitted code is analyzed, not executed. Answers are saved only when you select **Save answer**.

On wider screens, drag the separator or focus it and use the left and right arrow keys to resize the description and answer panels. The shared single-user preference is stored as a percentage in PostgreSQL and restored across visits and browser widths.

The Python tooling service runs separately from the API, without database credentials. The Compose setup is intended for local use and does not provide authentication or multi-user isolation; do not expose it to untrusted networks.

The database credentials in `compose.yaml` are intended for local development only. Replace them and configure appropriate network and security settings before deploying anywhere else.
