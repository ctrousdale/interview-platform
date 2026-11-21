# Interview Practice

A local interview practice workspace built with React, Vite, Tailwind CSS and shadcn/ui components, an ASP.NET Core API, and PostgreSQL. The interface uses the [Carbonfox](https://github.com/EdenEast/nightfox.nvim) palette.

## Run with Docker Compose

```sh
docker compose up --build
```

Open <https://localhost:8443>. HTTP on <http://localhost:8080> redirects to HTTPS.

The home page links to algorithm practice, software design pattern practice, learnings, and the AI interviews work-in-progress page. The practice sections draw from the question library; existing behavioral, technical, and system-design questions remain available in the full catalog. Each problem has a shareable URL at `/problems/<id>`; select the practice.studio logo to return home. Drafts are retained while navigating within the open page but are not persisted across reloads.

The library includes original practice prompts inspired by candidate-reported Google SWE interview themes, with an emphasis on coding and follow-ups plus senior-level system design and behavioral practice. They are not official Google questions or a guarantee of what will be asked. Google lists SWE III as a mid-level role; senior interviews may place more emphasis on system design. Sources consulted: [InterviewLegend's Google coding guide](https://interviewlegend.com/guides/companies/google/coding/coding-overview), [Aced's Google SWE interview guide](https://www.aced.io/guides/google-software-engineer-interview), and [Google Careers' SWE III listing](https://www.google.com/about/careers/applications/jobs/results/129036644849197766-software-engineer-iii/).

On first startup, the frontend generates a self-signed certificate for `localhost` and `127.0.0.1` and stores it in the `frontend_tls` Docker volume. Browsers will warn that the certificate is not trusted; for local development, you can accept the warning or export the public certificate and add it to your browser or system trust store:

```sh
docker compose cp frontend:/etc/nginx/local-tls/localhost.crt ./localhost.crt
```

The certificate is for local development only. For a deployed site, configure a certificate issued for the actual hostname by a trusted certificate authority and update the HTTPS ports and redirect accordingly.

Practice sessions are stored in the `postgres_data` Docker volume and persist across container restarts. Stop the services with `docker compose down`; add `-v` only if you also want to delete the stored sessions and local TLS certificate.

## Answer editor

The practice workspace shows the question description and history alongside the editor on wider screens. Coding problems provide Python starter code and a callable contract. **Run** checks a small subset of cases without saving; **Submit** checks the full suite and saves the code and failed test IDs. A problem is complete only after a full submission passes. Drafts remain in memory when navigating and are lost on reload. Behavioral, technical, and system-design prompts retain their plain-text answer workflow.

In the answer editor, Tab indents and Shift-Tab outdents using four spaces. Press Ctrl-M (or Escape, then Tab) to let Tab move focus out of the editor.
Each problem opens on its Description tab. Select Solution to compare a naive or baseline approach with the intended approach and other alternatives where applicable. Each header names the approach and shows its time and space complexity; select it to expand or hide the explanation and Python example. For behavioral and system-design prompts, examples illustrate an approach rather than a personal answer or a production distributed system.


In Python mode, enable the formatter to format an answer, or enable language-server support for diagnostics and completion. Both tools are optional and send the current answer to the `python-tools` container.

On wider screens, drag the separator or focus it and use the left and right arrow keys to resize the description and answer panels. The shared single-user preference is stored as a percentage in PostgreSQL and restored across visits and browser widths.

The Python tooling service runs separately from the API, without database credentials. Coding submissions execute arbitrary Python under operating-system restrictions; this is a local practice tool, not an adversarial grading system. Submitted code can interfere with its own tests, so results must not be used as trusted assessment. The Compose setup is intended for local use and does not provide authentication or multi-user isolation; do not expose it to untrusted networks.

Execution requires Linux Landlock and seccomp support; it fails closed if the sandbox cannot be established. Each test runs in a fresh process with no network, subprocess creation, or writable filesystem, a 256 MiB address-space limit, and a three-second wall-clock limit. A full request has a 20-second execution limit. These restrictions are intended to protect the local services, not to make test verdicts tamper-proof.

The database credentials in `compose.yaml` are intended for local development only. Replace them and configure appropriate network and security settings before deploying anywhere else.
