# AI Voice-to-Database POS Engine

A full-stack, voice-activated Point of Sale (POS) prototype designed to parse continuous unstructured audio into strict JSON schemas, enforcing deterministic business logic through a relational database. 

This project bridges the gap between unpredictable LLM outputs and strict backend requirements, serving as a conceptual blueprint for enterprise-scale restaurant architecture.

## 🚀 Technical Architecture

*   **Client-Side Edge Computing:** Utilizes the browser's native Web Speech API in React to handle continuous voice recognition locally. This prevents expensive, constant audio streaming to the backend and triggers server execution only upon specific wake-word detection.
*   **Asynchronous Orchestrator:** A Node.js/Express backend that receives text streams, interfaces with a live database to assemble context, and securely communicates with the Gemini LLM API.
*   **Atomic Database Guardrails:** Integrated with Neon PostgreSQL to manage transactional state. To counter LLM math hallucinations, the backend executes atomic SQL constraints (`UPDATE ... AND stock >= $1`) to guarantee negative inventory is physically impossible.
*   **Enterprise Scaling (RAG Ready):** The architecture is designed to support a Retrieval-Augmented Generation (RAG) pipeline. System blueprints (`/docs`) outline how semantic vector search can be utilized alongside stateful SQL transactions to support a 1M+ item database.

## 🛠️ Tech Stack
*   **Frontend:** React, Web Speech API
*   **Backend:** Node.js, Express.js
*   **Database:** PostgreSQL (Neon)
*   **AI Integration:** Gemini API (Strict JSON mode)

## 💡 Key Engineering Challenges Solved
1.  **Separation of Concerns:** Delegated semantic language understanding to the LLM while keeping strict mathematical state (inventory/capacity) locked in PostgreSQL.
2.  **Data Normalization:** Engineered the parser to automatically inject live system timestamps for missing dates and enforce strict 24-hour SQL time constraints from natural language inputs (e.g., "7 p.m." -> "19:00:00").