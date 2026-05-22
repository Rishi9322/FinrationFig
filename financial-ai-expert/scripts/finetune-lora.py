"""
LoRA Fine-Tuning Script for Qwen 2.5 7B on CMA Mapping Data
Uses Unsloth for 2x faster fine-tuning with GPU acceleration.

Prerequisites (run once):
  pip install unsloth datasets transformers trl peft

Hardware requirement: NVIDIA GPU with ≥8 GB VRAM (RTX 3060 12GB+, RTX 3090, RTX 4080/4090)
"""

import json
from pathlib import Path

# ─── Configuration ────────────────────────────────────────────────────────────

MODEL_NAME    = "unsloth/Qwen2.5-7B-Instruct-bnb-4bit"  # 4-bit quantized — ~8 GB VRAM
OUTPUT_DIR    = "./lora-cma-qwen"
TRAINING_DATA = "./training_data/cma_mappings.jsonl"
MAX_SEQ_LEN   = 2048
EPOCHS        = 3
BATCH_SIZE    = 2
GRAD_ACCUM    = 4
LR            = 2e-4
LORA_R        = 16
LORA_ALPHA    = 16

# ─── Training data format (JSONL, one example per line) ───────────────────────
#
# Each line: { "instruction": "Map this label to a CMA schema field: ...", "output": "form_iii_liabilities.sundry_creditors" }
#
# We auto-generate synthetic training pairs from the CMA schema synonyms.

def generate_synthetic_data():
    """Generate training pairs from cma-schema synonyms."""
    from cma_schema_py import CMA_SCHEMA_SYNONYMS  # see cma_schema_py.py

    examples = []
    for schema_key, meta in CMA_SCHEMA_SYNONYMS.items():
        for synonym in meta["synonyms"]:
            examples.append({
                "instruction": f"Map this Indian accounting label to a CMA schema field: '{synonym}'",
                "output": schema_key,
                "confidence": 1.0
            })
    return examples


def format_prompt(example: dict) -> str:
    return f"""<|im_start|>system
You are a senior Indian banking CMA analyst. Map financial line-item labels to the standard RBI CMA schema.
<|im_end|>
<|im_start|>user
{example["instruction"]}
<|im_end|>
<|im_start|>assistant
{example["output"]}<|im_end|>"""


def train():
    try:
        from unsloth import FastLanguageModel
        import torch
        from datasets import Dataset
        from trl import SFTTrainer
        from transformers import TrainingArguments
    except ImportError:
        print("ERROR: Missing dependencies.")
        print("Install with: pip install unsloth datasets transformers trl peft")
        return

    print(f"Loading {MODEL_NAME} with 4-bit quantization...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=MODEL_NAME,
        max_seq_length=MAX_SEQ_LEN,
        dtype=None,        # auto-detect: bfloat16 on Ampere+, float16 on older
        load_in_4bit=True, # saves VRAM
    )

    # Apply LoRA adapters
    model = FastLanguageModel.get_peft_model(
        model,
        r=LORA_R,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha=LORA_ALPHA,
        lora_dropout=0.05,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=42,
    )

    # Load or generate training data
    data_path = Path(TRAINING_DATA)
    if data_path.exists():
        with open(data_path) as f:
            examples = [json.loads(l) for l in f if l.strip()]
    else:
        print("No training data found — generating synthetic pairs from CMA schema...")
        examples = generate_synthetic_data()
        data_path.parent.mkdir(exist_ok=True)
        with open(data_path, "w") as f:
            for ex in examples:
                f.write(json.dumps(ex) + "\n")
        print(f"Saved {len(examples)} synthetic training pairs to {TRAINING_DATA}")

    texts = [format_prompt(ex) for ex in examples]
    dataset = Dataset.from_dict({"text": texts})

    print(f"Training on {len(dataset)} examples for {EPOCHS} epochs...")

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LEN,
        args=TrainingArguments(
            per_device_train_batch_size=BATCH_SIZE,
            gradient_accumulation_steps=GRAD_ACCUM,
            warmup_steps=10,
            num_train_epochs=EPOCHS,
            learning_rate=LR,
            fp16=not torch.cuda.is_bf16_supported(),
            bf16=torch.cuda.is_bf16_supported(),
            logging_steps=10,
            output_dir=OUTPUT_DIR,
            save_strategy="epoch",
            report_to="none",
        ),
    )

    trainer.train()

    # Save LoRA weights
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print(f"\nFine-tuned model saved to {OUTPUT_DIR}")

    # Export to GGUF for Ollama
    print("\nExporting to GGUF for Ollama (Q4_K_M)...")
    model.save_pretrained_gguf(OUTPUT_DIR + "-gguf", tokenizer, quantization_method="q4_k_m")
    print(f"GGUF model saved to {OUTPUT_DIR}-gguf")
    print("\nTo use in Ollama:")
    print(f"  ollama create cma-qwen -f {OUTPUT_DIR}-gguf/Modelfile")
    print("  ollama run cma-qwen")


if __name__ == "__main__":
    train()
