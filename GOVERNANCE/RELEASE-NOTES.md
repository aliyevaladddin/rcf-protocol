# RCF-PACKAGING — Build & Publish Guide

This guide explains how to package the `rcf-cli` tool and distribute it.

## 1. Local Build

To create the distribution files (`.whl` and `.tar.gz`), follow these steps:

### Prerequisites
Install the `build` tool:
```bash
pip install build
```

### Build Command
Run this command inside the `sdk/python` directory:
```bash
python3 -m build
```

**Result:** A new `dist/` folder will be created inside `sdk/python` containing the package files.

---

## 2. Publishing to PyPI

To upload your package to the Python Package Index (PyPI):

1. **Install Twine:**
   ```bash
   pip install twine
   ```
2. **Upload:**
   ```bash
   twine upload dist/*
   ```
   *(You will need a PyPI account and an API token)*

---

## 3. Publishing to GitHub Packages

To host the package directly on your GitHub repository:

### Manual Upload
You can use `twine` by pointing to the GitHub registry:
```bash
twine upload --repository-url https://maven.pkg.github.com/OWNER/REPOSITORY dist/*
```

### Automated (GitHub Actions)
Create a file `.github/workflows/publish.yml`:
```yaml
name: Publish RCF SDK
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
      - name: Build and publish
        run: |
          pip install build twine
          cd sdk/python
          python3 -m build
          twine upload dist/*
        env:
          TWINE_USERNAME: __token__
          TWINE_PASSWORD: ${{ secrets.PYPI_API_TOKEN }}
```

---

**© 2026 RCF Protocol**
