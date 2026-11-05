# Study dashboards

Two static, browser-local study tools: `ects/` for ECTS planning and `campus/` for courses, assessments and tasks. No server or account is required. ECTS data is stored in localStorage; Campus data and progress history are stored in IndexedDB. Browser storage is specific to a browser and device and can be cleared by the browser. Export JSON backups from each dashboard's settings before clearing storage or changing devices. Campus exports current records; its local progress history remains in the original browser.

Run locally with `npm ci && npm run dev` in the repository root for ECTS, or in `Dashboard2` for Campus. Both build with `npm run build`. GitHub Actions builds and publishes both routes to Pages.
