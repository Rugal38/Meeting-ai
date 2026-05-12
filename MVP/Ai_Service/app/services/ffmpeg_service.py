import ffmpeg
import os
import subprocess

async def extract_audio(input_path: str) -> str:
    """
    Extracts audio from a video file and converts it to 16kHz mono WAV.
    Returns the path to the extracted audio file.
    """
    output_path = os.path.splitext(input_path)[0] + "_audio.wav"
    
    # Absolute path to ffmpeg for reliability on Windows
    ffmpeg_path = r"C:\ffmpeg\bin\ffmpeg.exe"
    
    # Check if ffmpeg exists at the specified path
    if not os.path.exists(ffmpeg_path):
        # Fallback to system path if manual path is missing
        ffmpeg_path = "ffmpeg"

    try:
        command = [
            ffmpeg_path,
            "-y", # Overwrite output
            "-i", input_path,
            "-vn", # Disable video
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            output_path
        ]
        
        # Using subprocess directly for better control on Windows
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()
        
        if process.returncode != 0:
            raise Exception(f"FFmpeg error: {stderr.decode()}")
            
        return output_path
    except Exception as e:
        raise Exception(f"Extraction failed: {str(e)}")
