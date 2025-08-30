import os
import shutil
from pathlib import Path

import torch
from transformers import AutoTokenizer, AutoModelForTokenClassification

# Paths
ROOT = Path(__file__).resolve().parents[2]  # .../tt
MODEL_SRC = ROOT / "pii_model"  # source HF model directory (PyTorch)
OUT_DIR = ROOT / "tt2" / "assets" / "models" / "pii_model"  # target app assets dir
OUT_DIR.mkdir(parents=True, exist_ok=True)

ONNX_PATH = OUT_DIR / "model.onnx"

def main():
    print(f"[export] Loading model from: {MODEL_SRC}")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_SRC)
    model = AutoModelForTokenClassification.from_pretrained(MODEL_SRC)
    model.eval()

    # Small max length just for export shape; runtime will be dynamic via dynamic_axes
    max_len = 32

    # Build a sample input (batch=1, dynamic seq)
    encoded = tokenizer(
        "This is a sample input for ONNX export.",
        return_tensors="pt",
        padding="max_length",
        truncation=True,
        max_length=max_len,
    )

    # Determine which inputs are supported by the model/tokenizer
    model_inputs = []
    input_names = []
    dynamic_axes = {}
    for name in ["input_ids", "attention_mask", "token_type_ids"]:
        if name in encoded:
            model_inputs.append(encoded[name])
            input_names.append(name)
            dynamic_axes[name] = {0: "batch", 1: "sequence"}

    if not model_inputs:
        raise RuntimeError("No valid model inputs found for export.")

    output_names = ["logits"]
    dynamic_axes["logits"] = {0: "batch", 1: "sequence"}

    print(f"[export] Exporting to: {ONNX_PATH}")
    torch.onnx.export(
        model,
        tuple(model_inputs),
        str(ONNX_PATH),
        input_names=input_names,
        output_names=output_names,
        dynamic_axes=dynamic_axes,
        opset_version=17,
        do_constant_folding=True,
    )

    if not ONNX_PATH.exists():
        raise RuntimeError("ONNX export did not produce model.onnx")

    print(f"[export] ONNX saved: {ONNX_PATH}")

    # Copy tokenizer/config artifacts for runtime parity
    to_copy = [
        "tokenizer.json",
        "vocab.txt",
        "config.json",
        "tokenizer_config.json",
        "special_tokens_map.json",
    ]
    for fname in to_copy:
        src = MODEL_SRC / fname
        if src.exists():
            dst = OUT_DIR / fname
            shutil.copy2(src, dst)
            print(f"[export] Copied {src.name} -> {dst}")
        else:
            print(f"[export] Skipped missing {fname}")

    print("[export] Done.")

if __name__ == "__main__":
    # Ensure CPU export
    os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")
    main()