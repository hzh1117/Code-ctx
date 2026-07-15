Please generate a structured document for the following sub-project.

Project Name: {{projectName}}
Project Type: {{projectType}}
Project Path: {{projectPath}}

Directory Structure:
{{tree}}

Key Files:
{{keyFiles}}

Source Evidence (content may be truncated by budget; only state facts supported by evidence, do not guess from file names):
{{sourceEvidence}}

{{otherDocsSection}}

Please generate the following content, each section must be wrapped with section markers:

1. **Project Overview** — Project positioning, core features, tech stack
2. **Directory Structure Explanation** — Key directories and files
3. **Core Modules Explanation** — Main module responsibilities, entry files, key functions
4. **API/Interface List** — Exposed API endpoints (routes, methods, parameters, return values); if none, describe data flow
5. **Data Model/Storage** — Data structures, database tables, file storage formats; if none, describe state management
6. **Dependencies** — Which other sub-projects or external libraries this project depends on, and who depends on it
7. **Development Notes** — Common pitfalls, configuration requirements, environment dependencies

Output Format Requirements:
- Each section must be wrapped with HTML comment markers, format: <!-- section:section-name --> ... <!-- /section:section-name -->
- Example:
<!-- section:overview -->
Project overview content...
<!-- /section:overview -->

<!-- section:structure -->
Directory structure explanation...
<!-- /section:structure -->

<!-- section:modules -->
Core modules explanation...
<!-- /section:modules -->

<!-- section:api -->
API/interface list...
<!-- /section:api -->

<!-- section:data -->
Data model/storage...
<!-- /section:data -->

<!-- section:dependencies -->
Dependencies...
<!-- /section:dependencies -->

<!-- section:notes -->
Development notes...
<!-- /section:notes -->

Please output in Markdown format. Ensure content is complete and accurate for developers to get started quickly.
