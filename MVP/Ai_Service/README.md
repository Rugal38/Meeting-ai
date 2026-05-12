# AI Service - Meeting Assistant

This service provides AI capabilities for the Meeting Assistant project, including:
- Audio/Video transcription using `faster-whisper`.
- Meeting summarization, key points, and conclusions using `Mistral-7B`.

## Prerequisites
- Python 3.10+
- FFmpeg installed and in PATH
- NVIDIA GPU with 8GB VRAM (recommended for RTX 3070 support)

## Setup

1. **Create a virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Install PyTorch with CUDA support (if applicable):**
   Visit [pytorch.org](https://pytorch.org/get-started/locally/) to get the correct command for your CUDA version.

## Running the Service

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.
Documentation: `http://localhost:8000/docs`

## API Endpoints

- `POST /api/transcribe`: Upload an audio/video file for transcription.
