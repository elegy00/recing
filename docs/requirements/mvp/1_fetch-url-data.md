## 1. Fetch recipe URL data

### Goal
Accept a user-submitted recipe URL and retrieve enough server-rendered page content for the recipe extraction step, without downloading unrelated assets or exposing the application to unsafe network access.

### Scope
- Input: one absolute `http` or `https` URL submitted from the web UI.
- Output: normalized fetch metadata and the retrieved HTML/text payload for the LLM step.
- Out of scope for MVP: crawling linked pages, downloading images/videos/fonts/scripts as separate assets, login-protected recipes, browser automation, and JavaScript-rendered pages whose recipe content is not present in the initial server response.

### Functional requirements
1. The application shall validate that the submitted value is an absolute `http` or `https` URL before making a request.
2. The application shall reject unsupported schemes such as `file:`, `ftp:`, `data:`, and local filesystem paths.
3. The application shall apply basic SSRF protection by rejecting localhost, loopback, link-local, private network, and otherwise non-public target addresses after DNS resolution.
4. The application shall fetch the URL with a 20 second timeout.
5. The application shall stop reading the response once it exceeds 5 MB and report the response as too large.
6. The application shall follow redirects when every redirect target also passes URL and SSRF validation.
7. The application shall request and accept HTML content; non-HTML responses shall be rejected with a user-facing explanation.
8. The application shall not download page subresources such as images, CSS, JavaScript, fonts, ads, or trackers.
9. The application shall preserve the final URL, HTTP status, content type, page title when available, and the raw or cleaned HTML/text body for the next step.
10. The application shall produce clear error states for invalid URL, unreachable host, timeout, redirect failure, unsupported content type, response too large, and non-success HTTP status.

### Quality requirements
- Fetching one URL must be bounded by the 20 second timeout.
- Network and parsing failures must not crash the web application.
- Logs should include enough diagnostic detail for developers, but must not expose full recipe content unnecessarily.

### Acceptance criteria
- A valid public, server-rendered recipe page can be submitted and its HTML/text is passed to the LLM request step.
- A non-URL string is rejected before any network request is made.
- A URL resolving to localhost or a private network address is rejected.
- Redirecting recipe URLs are supported when all redirect targets are safe.
- A response larger than 5 MB or slower than 20 seconds is stopped and reported to the user.
