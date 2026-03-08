# RCF Protocol - TypeScript SDK

The official TypeScript SDK and Command Line Interface for the RCF (Requirement Compliance Framework) Protocol. 
This SDK provides tooling for extracting and validating compliance metadata from source code using the RCF standard.

## Installation

```bash
# Install the SDK in your project
npm install rcf-protocol

# Or install globally to use the CLI anywhere
npm install -g rcf-protocol
```

## Features

- **Standardized Markers**: Identify strict RCF specification requirements directly in code.
- **RCF Parser**: Programmatic API for parsing `.rcf` requirements maps.
- **Compliance Validation CLI**: Enforce implementations against requirements mechanically.
- **TypeScript Native**: Full typing support out of the box.

## Core concepts

- `@rcf[RequirementID]:` - Embedded directly into comments to link implementation blocks.
- `RCF Map` - The central source of truth for all requirements, mapped to files/lines.

## CLI Usage

The `rcf-cli` binary allows for quick validation or map extraction straight from your terminal.

```bash
# Validates the current directory against the specification
rcf-cli validate ./src
```
