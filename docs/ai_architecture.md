# AI and Model Architecture

RepoLens is built to be a 100% free, privacy-first, and local-first application. To achieve this, we do not rely on paid cloud APIs (like OpenAI or Anthropic). Instead, we run specialized Small Language Models (SLMs) directly on the user's hardware.

## 1. Execution Engines (Where the AI Runs)

### Primary Engine: WebGPU (`@mlc-ai/web-llm`)
*   **Technology:** Uses WebGPU to run quantized open-source models (e.g., Llama-3-8B-Instruct, Phi-3-Mini) directly inside the browser's JavaScript environment.
*   **Benefits:** Zero installation required for the user. The model weights are downloaded and cached in the browser, and inference runs on the user's local graphics card. No data ever leaves the machine.

### Fallback Engine: Ollama Localhost Bridge
*   **Technology:** A direct API connection to `http://localhost:11434`.
*   **Benefits:** For users with older hardware that lacks WebGPU support, or users who want to run massive 32B+ models, RepoLens can seamlessly connect to a native Ollama instance running in the background.

## 2. Feature Implementations (How the AI is Used)

### A. ELI5 (Explain Like I'm 5) Code Translator
*   **Trigger:** User clicks on a file or complex function in the UI.
*   **Data Flow:** The UI extracts the raw source code and its immediate graph context (callers/callees) and sends it to the local LLM.
*   **Prompting Strategy:** Hidden system prompts instruct the LLM to act as a senior mentor, summarizing the code's purpose, responsibilities, and architectural role in plain English.

### B. "Repo 101" Curriculum Synthesizer
*   **Trigger:** Post-ingestion (after the knowledge graph is built).
*   **Data Flow:** A high-level summary of the graph (frameworks detected, file counts, main entry points) is compiled and sent to the LLM.
*   **Output:** The LLM generates a personalized, step-by-step interactive onboarding course (e.g., "Lesson 1: Understanding the React Frontend", "Lesson 2: The Core Database Models").

### C. The "Nexus" Investigator Agent
*   **Technology:** LangChain.js (or Vercel AI SDK) running in the browser.
*   **Mechanism:** When a user asks a complex question (e.g., "Where does payment processing happen?"), the LLM operates as a ReAct (Reason + Act) agent. It uses predefined "tools" to query the in-memory `graphology` database, ensuring that its answers are perfectly grounded in the actual codebase, preventing hallucinations.
