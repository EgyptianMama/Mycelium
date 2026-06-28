# RepoLens Tech Stack

RepoLens uses a "Hybrid Architecture." The heavy lifting (code ingestion, parsing, and graph building) happens purely in-browser using WebAssembly to protect user privacy and save costs. However, a lightweight backend is used to store user progress, repository metadata, and AI-generated summaries.

## 1. Frontend Framework
*   **Vite + React + TypeScript:** Chosen over Next.js because Vite is vastly superior for building purely static Single Page Applications (SPAs) that heavily rely on WebAssembly and Web Workers.
*   **Vanilla CSS:** A custom-built premium design system utilizing CSS variables for theming (dark mode), glassmorphism effects, and micro-animations to ensure a high-end, responsive feel.

## 2. Code Parsing (Ingestion Engine)
*   **Tree-sitter WASM (`tree-sitter-wasms`):** The industry standard for fast, incremental parsing. By running Tree-sitter in WebAssembly via Web Workers, we can parse multiple programming languages directly in the user's browser without freezing the UI thread or sending code to a server.

## 3. Knowledge Graph (Database)
*   **Graphology:** A robust, in-memory graph library for JavaScript. It will store all parsed nodes (Files, Functions, Classes) and edges (Calls, Imports) during the user's session.

## 4. Visualizations
*   **Sigma.js:** A WebGL-based graph rendering engine (built to work with Graphology) that can display complex dependency graphs smoothly.
*   **React Flow:** For rendering step-by-step, flowchart-style educational tracks (e.g., "The Life of a Request" or "Repo 101 Curriculum").
*   **Monaco Editor:** The engine behind VS Code, integrated to provide a premium, read-only code viewing experience with perfect syntax highlighting.

## 5. AI & Large Language Models
*   **@mlc-ai/web-llm (WebGPU):** For running quantized, open-source Large Language Models directly in the browser.
*   **Ollama (Localhost API):** A fallback mechanism for users who prefer to run heavier models natively on their machines.
*   **LangChain.js / Vercel AI SDK:** For orchestrating agent prompts, memory, and tool-calling against the in-memory graph.

## 6. Backend & State Management (The Cloud Layer)
*   **Supabase (or Firebase):** Used as a lightweight, free-tier cloud backend. It will handle:
    *   **User Authentication:** Allowing users to log in and save their progress.
    *   **Metadata Database:** Storing repository URLs, commit hashes, and lightweight AI-generated summaries (the "learning progress") so users can pick up where they left off.
    *   *Crucially: The actual source code of the repositories is NEVER uploaded to this backend.*
