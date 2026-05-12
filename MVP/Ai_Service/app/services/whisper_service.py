from faster_whisper import WhisperModel
import torch
import os
import sys

# Fix for Windows: Add NVIDIA libraries to DLL path
if sys.platform == "win32":
    import site
    packages = site.getsitepackages()
    # Also check user site packages
    if site.ENABLE_USER_SITE:
        packages.append(site.getusersitepackages())
    
    for sp in packages:
        # We look for the nvidia folder
        nvidia_base = os.path.join(sp, "nvidia")
        if os.path.exists(nvidia_base):
            for root, dirs, files in os.walk(nvidia_base):
                if "bin" in dirs:
                    bin_path = os.path.join(root, "bin")
                    print(f"Adding to DLL search path: {bin_path}")
                    os.add_dll_directory(bin_path)

# Configuration from PROJECT_CONTEXT_V2.txt
MODEL_SIZE = "medium"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
COMPUTE_TYPE = "int8" if DEVICE == "cuda" else "float32"

print(f"Loading Whisper model: {MODEL_SIZE} on {DEVICE} with {COMPUTE_TYPE}")
model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)

async def transcribe(file_path: str):
    segments, info = model.transcribe(file_path, beam_size=2, vad_filter=True)
    
    full_text = ""
    segments_list = []
    
    for segment in segments:
        full_text += segment.text + " "
        segments_list.append({
            "start": segment.start,
            "end": segment.end,
            "text": segment.text.strip(),
            "language": info.language,
            "probability": segment.avg_logprob
        })
    
    return {
        "language": info.language,
        "language_probability": info.language_probability,
        "duration": info.duration,
        "text": full_text.strip(),
        "segments": segments_list
    }
