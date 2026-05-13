OCR compare harness

Place test images in `tools/ocr/inputs/`. For each image `example.png` you can optionally add a ground truth file `example.txt` containing expected extracted text.

Environment variables:
- `OPENROUTER_API_KEY` — your OpenRouter API key
- `OPENROUTER_URL` — (optional) URL to send requests to (default: `https://api.openrouter.ai/v1/chat/completions`)
- `OPENROUTER_MODEL` — (optional) model name to pass (default: `baidu/qianfan-ocr-fast:free`)

Run:

```bash
node tools/ocr/compare.mjs
```

Output:
- JSON files in `tools/ocr/out/` and a consolidated `report.json` with Tesseract and OpenRouter outputs and simple string-distance scores when ground truth is provided.

Notes:
- The OpenRouter request body used by the script is a generic image-in request; depending on the model you may need to adapt `compare.mjs` to match the exact API contract for the model (some models accept `input_image` items, others expect different shapes).
- Tesseract runs locally via `tesseract.js`. For large batches, prefer server-side OCR or cloud OCR providers for speed and reliability.
- For `nvidia/llama-nemotron-embed-vl-1b-v2:free`, note it is an embedding/vision-language model — it may not return plain OCR text; you can use it to create embeddings for downstream extraction or to ask an LLM to summarize/structure the image.
