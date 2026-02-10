// =============================================================================
// OctoSky — n8n Workflow: Code Node Reference
// =============================================================================
//
// This directory contains the JavaScript snippets used inside the n8n
// "Code" nodes.  They are kept here for version-control; copy-paste the
// contents into the n8n Code Node editor.
//
// Workflow Topology (n8n canvas):
//
//   ┌────────────┐     ┌────────────┐     ┌────────────┐
//   │  Cron      │────▶│  Execute   │────▶│  Node A    │
//   │  Trigger   │     │  Command   │     │  Parse     │
//   │  (*/30 min)│     │  hunter.js │     │  stdout    │
//   └────────────┘     └────────────┘     └────────────┘
//                                               │
//                              ┌────────────────┘
//                              ▼
//                      ┌────────────┐     ┌────────────┐
//                      │  Node B    │────▶│  HTTP Req  │
//                      │  Build AI  │     │  Ollama    │
//                      │  Prompt    │     │  (Phi-3)   │
//                      └────────────┘     └────────────┘
//                                               │
//                              ┌────────────────┘
//                              ▼
//                      ┌────────────┐     ┌────────────┐     ┌─────────────┐
//                      │  Node C    │────▶│  Write File│────▶│  PostgreSQL │
//                      │  Merge     │     │  weather.  │     │  Insert     │
//                      │  Data + AI │     │  json      │     │             │
//                      └────────────┘     └─────────── ┘     └─────────────┘
//
// Each node's code is in a separate file below.
// =============================================================================
