import modal
import io
import os
from fastapi import Header, HTTPException

# Define image: Đảm bảo cài llama-cpp-python compile với CUDA
image = (
    modal.Image.from_registry("nvidia/cuda:12.2.2-cudnn8-devel-ubuntu22.04", add_python="3.11")
    .apt_install("espeak-ng", "libsndfile1", "build-essential", "git", "clang", "ffmpeg")
    .pip_install("cmake")
    # Thiết lập biến môi trường TRƯỚC khi pip install các gói phụ thuộc
    .env({"CMAKE_ARGS": "-DGGML_CUDA=on", "CC": "clang", "CXX": "clang++"})
    # Cài llama-cpp-python riêng để chắc chắn nó build với CUDA
    .pip_install("llama-cpp-python", extra_options="--no-cache-dir --force-reinstall --upgrade")
    .pip_install("vieneu", "soundfile", "numpy", "torch", "torchaudio", "pydub")
)

app = modal.App("ebook-vieneu-tts-gpu")

# Volume để lưu model (tránh tải lại)
model_cache = modal.Volume.from_name("vieneu-model-cache", create_if_missing=True)

@app.cls(
    image=image,
    volumes={"/root/.cache/huggingface": model_cache},
    gpu="L4",
    container_idle_timeout=5,
    timeout=600,
    max_containers=10,  # Giới hạn tối đa 8 GPU containers
    secrets=[modal.Secret.from_name("ebook-secrets")],
)
class VieNeuTTS:
    @modal.enter()
    def enter(self):
        print("📥 Đang khởi động & Load Model vào GPU...")
        from vieneu import Vieneu
        
        # Load model Full (Chất lượng cao nhất)
        try:
             # Model này thường trả về 24000Hz (theo docs), không phải 44100Hz
             self.tts = Vieneu("pnnbao-ump/VieNeu-TTS")
             self.sample_rate = 24000 # Fix: VieNeuTTS 0.5B vẫn dùng 24kHz
             print("✅ Đã load VieNeu-TTS (Full Version)")
        except Exception as e:
             print(f"⚠️ Lỗi load model full: {e}. Thử fallback về default...")
             self.tts = Vieneu() # Fallback
             self.sample_rate = 24000
        
    @modal.web_endpoint(method="POST")
    def generate(self, item: dict, x_api_key: str = Header(None)):
        # Check API Key
        if x_api_key != os.environ.get("TTS_API_KEY"):
            raise HTTPException(status_code=401, detail="Unauthorized: Invalid API Key")

        import soundfile as sf
        
        text = item.get("text")
        voice_name = item.get("voice", "Binh") # Giọng mặc định

        if not text:
            return {"error": "Text is required"}, 400

        print(f"🎤 Đang đọc: {text[:50]}...") # Log 50 ký tự đầu

        try:
            # Lấy giọng (Preset)
            try:
                voice = self.tts.get_preset_voice(voice_name)
            except:
                voice = self.tts.get_preset_voice("Binh")

            # Chuẩn hóa text nhẹ
            text = text.strip()
            if text and text[-1] not in ".!?":
                text += "."

            # Generate (Inference)
            # temperature=0.2 giúp giọng đọc ổn định, ít bị lỗi lặp từ
            audio = self.tts.infer(text=text, voice=voice, temperature=0.2, top_k=50)

            # Convert sang WAV
            buffer = io.BytesIO()
            
            # Dùng self.sample_rate đã xác định lúc load model
            sf.write(buffer, audio, self.sample_rate, format='WAV')
            buffer.seek(0)
            
            from fastapi import Response
            return Response(content=buffer.read(), media_type="audio/wav")

        except Exception as e:
            print(f"❌ Error: {e}")
            # Trả về lỗi 500 để bên NestJS biết mà handle
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=str(e))

    @modal.web_endpoint(method="POST")
    def generate_stream(self, item: dict, x_api_key: str = Header(None)):
        # Check API Key
        if x_api_key != os.environ.get("TTS_API_KEY"):
            raise HTTPException(status_code=401, detail="Unauthorized: Invalid API Key")

        from fastapi.responses import StreamingResponse
        import re
        import subprocess
        import numpy as np
        import io

        text = item.get("text", "")
        voice_name = item.get("voice", "Binh")
        
        try:
            voice = self.tts.get_preset_voice(voice_name)
        except:
            voice = self.tts.get_preset_voice("Binh")

        def audio_generator():
            # 1. Khởi tạo 1 process FFmpeg duy nhất cho cả buổi stream
            process = subprocess.Popen(
                [
                    'ffmpeg',
                    '-f', 'f32le',          # Định dạng đầu vào (float 32-bit)
                    '-ar', str(self.sample_rate),
                    '-ac', '1',             # Mono
                    '-i', 'pipe:0',         # Nhận từ stdin
                    '-f', 'mp3',            # Định dạng đầu ra
                    '-b:a', '128k',         # Bitrate
                    '-flush_packets', '1',  # Đẩy dữ liệu đi ngay lập tức <--- QUAN TRỌNG
                    'pipe:1'                # Xuất ra stdout
                ],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL
            )

            sentences = re.split(r'(?<=[.!?])\s+', text)
            
            try:
                for sentence in sentences:
                    if not sentence.strip(): continue
                    
                    # AI xử lý
                    audio_data = self.tts.infer(text=sentence, voice=voice)
                    
                    # Tạo silence khớp dtype với audio_data
                    silence = np.zeros(int(self.sample_rate * 0.2), dtype=audio_data.dtype)
                    combined = np.concatenate([audio_data, silence])

                    # Ghi dữ liệu raw vào stdin của ffmpeg
                    process.stdin.write(combined.tobytes())
                    process.stdin.flush() # Ép dữ liệu vào ống dẫn

                    # Đọc dữ liệu đã nén từ stdout và yield về Client
                    # Dùng đoạn lặp này để lấy hết dữ liệu đang có trong ống mp3
                    while True:
                        # Đọc từng cụm nhỏ (ví dụ 4096 bytes) để tránh block
                        chunk = process.stdout.read(4096)
                        if not chunk: break
                        yield chunk
                        if len(chunk) < 4096: break # Đã đọc hết buffer hiện tại
                        
            finally:
                # Dọn dẹp process khi kết thúc
                if process.stdin:
                    process.stdin.close()
                process.wait()
                # Đọc nốt những byte cuối cùng
                remaining = process.stdout.read()
                if remaining:
                    yield remaining

        return StreamingResponse(audio_generator(), media_type="audio/mpeg")

    @modal.method()
    def process_batch(self, text, voice_name):
        import numpy as np
        # Load voice (nên cache trong class state nếu được)
        try:
            voice = self.tts.get_preset_voice(voice_name)
        except:
            voice = self.tts.get_preset_voice("Binh")
            
        # Inference
        audio_chunk = self.tts.infer(text=text, voice=voice, temperature=0.2, top_k=50)
        return audio_chunk

    @modal.web_endpoint(method="POST")
    def generate_chapter(self, item: dict, x_api_key: str = Header(None)):
        # Check API Key
        if x_api_key != os.environ.get("TTS_API_KEY"):
            raise HTTPException(status_code=401, detail="Unauthorized: Invalid API Key")

        import soundfile as sf
        import numpy as np
        import io
        import re
        from concurrent.futures import ThreadPoolExecutor

        # --- 1. Chuẩn bị Input (Giữ nguyên logic của bạn) ---
        text = item.get("text", "")
        paragraphs = item.get("paragraphs", [])
        voice_name = item.get("voice", "Binh")
        if not paragraphs:
            paragraphs = [p.strip() for p in text.split('\n') if p.strip()]

        print(f"📚 Processing Chapter: {len(paragraphs)} paragraphs")

        # --- 2. PRE-CALCULATE TOÀN BỘ BATCH (Bước quan trọng) ---
        # Thay vì vừa chạy vừa tính, hãy tính toán hết danh sách text cần đọc trước
        all_tasks = [] 
        
        MAX_WORDS_PER_BATCH = 80
        silence_short = np.zeros(int(self.sample_rate * 0.25), dtype=np.float32)
        silence_long = np.zeros(int(self.sample_rate * 0.7), dtype=np.float32)

        for p_idx, para_text in enumerate(paragraphs):
            raw_sentences = re.split(r'(?<=[.!?])\s+', para_text.strip())
            sentences = [s.strip() for s in raw_sentences if s.strip()]
            
            batches = []
            current_batch = []
            current_word_count = 0

            # Logic gom batch (Giữ nguyên của bạn)
            for sent in sentences:
                w_count = len(sent.split())
                if w_count > MAX_WORDS_PER_BATCH:
                    if current_batch:
                        batches.append(" ".join(current_batch))
                        current_batch = []
                        current_word_count = 0
                    batches.append(sent) 
                    continue

                if current_word_count + w_count > MAX_WORDS_PER_BATCH:
                    batches.append(" ".join(current_batch))
                    current_batch = [sent]
                    current_word_count = w_count
                else:
                    current_batch.append(sent)
                    current_word_count += w_count
            
            if current_batch:
                batches.append(" ".join(current_batch))

            # Lưu task lại: (text, loại_silence_theo_sau)
            for b_idx, batch_text in enumerate(batches):
                if batch_text and batch_text[-1] not in ".!?": batch_text += "."
                
                # Xác định silence cần chèn sau batch này
                silence_type = 'long' if b_idx == len(batches) - 1 else 'short'
                all_tasks.append({
                    "text": batch_text,
                    "silence": silence_type,
                    "index": len(all_tasks) # Để sort lại nếu cần
                })

        print(f"🚀 Launching {len(all_tasks)} tasks in parallel...")

        # --- 3. PARALLEL INFERENCE (Thay đổi lớn nhất) ---
        # Cách 1: Dùng modal .map() nếu bạn muốn scale ra nhiều container (Cực nhanh nhưng tốn quota)
        # results = list(self.process_batch.map([t['text'] for t in all_tasks], kwargs={"voice_name": voice_name}))
        
        # Cách 2: Chạy tuần tự nhưng tối ưu (Nếu chỉ có 1 GPU container đang chạy)
        # Nhưng ở đây để fix lỗi 310s, mình khuyên dùng logic gom list inputs
        
        # Giả sử self.tts.infer không hỗ trợ batch input, ta vẫn phải loop. 
        # NHƯNG, nếu bạn dùng Modal Class, hãy dùng .map() để tận dụng Async
        
        # List comprehension này sẽ gửi request song song (nếu cấu hình container allow concurrent inputs)
        # Hoặc ít nhất nó loại bỏ overhead của logic tính toán python xen kẽ
        
        input_texts = [t['text'] for t in all_tasks]
        
        # GỌI HÀM process_batch QUA MAP (QUAN TRỌNG)
        # Điều này kích hoạt khả năng chạy song song của Modal
        audio_results = list(self.process_batch.map(input_texts, kwargs={"voice_name": voice_name}))

        # --- 4. Ráp nối Audio ---
        final_audio_parts = []
        for i, audio_chunk in enumerate(audio_results):
            final_audio_parts.append(audio_chunk)
            
            # Thêm silence tương ứng
            if all_tasks[i]['silence'] == 'short':
                final_audio_parts.append(silence_short)
            else:
                final_audio_parts.append(silence_long)

        # --- 5. Export ---
        merged_audio = np.concatenate(final_audio_parts)
        
        # Normalize (Nhanh, dùng Numpy)
        max_val = np.abs(merged_audio).max()
        if max_val > 0: merged_audio = merged_audio / max_val * 0.9

        # Direct WAV encoding (Nhanh hơn qua Pydub nếu không cần nén mp3 quá gắt)
        # Tuy nhiên để giữ MP3 output:
        wav_buffer = io.BytesIO()
        sf.write(wav_buffer, merged_audio, self.sample_rate, format='WAV')
        wav_buffer.seek(0)
        
        # Có thể cân nhắc trả về WAV luôn để client tự nén nếu muốn server nhanh tuyệt đối
        # Hoặc dùng ffmpeg trực tiếp thay vì pydub (nhưng pydub tiện hơn)
        from pydub import AudioSegment
        audio_segment = AudioSegment.from_wav(wav_buffer)
        mp3_buffer = io.BytesIO()
        audio_segment.export(mp3_buffer, format="mp3", bitrate="192k")
        mp3_buffer.seek(0)

        from fastapi import Response
        return Response(content=mp3_buffer.read(), media_type="audio/mpeg")