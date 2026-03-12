---
title: FAQ
description: "Frequently asked questions about Middy, including timeout troubleshooting and common issues."
---

### My lambda keep timing out without responding, what do I do?

Likely your event loop is not empty. This happens when you have a database connect still open for example. Checkout `@middy/do-not-wait-for-empty-event-loop`.
