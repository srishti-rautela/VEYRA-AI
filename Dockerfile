FROM python:3.11-slim

WORKDIR /app


# =====================================================
# System dependencies
# =====================================================

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*


# =====================================================
# Python dependencies
# =====================================================

RUN pip install --upgrade pip


RUN pip install --no-cache-dir \
    fastapi>=0.110.0 \
    "uvicorn[standard]>=0.27.0" \
    sqlalchemy>=2.0.0 \
    pydantic>=2.0.0 \
    httpx>=0.27.0 \
    numpy>=1.24.0 \
    pandas \
    python-multipart \
    opencv-python-headless>=4.8.0


# =====================================================
# AI / Computer Vision dependencies
# =====================================================

RUN pip install --no-cache-dir \
    ultralytics==8.3.40 \
    torch \
    torchvision


# =====================================================
# Copy project
# =====================================================

COPY app/ ./app/
COPY data/ ./data/


RUN mkdir -p data/camera_clips


# =====================================================
# Environment
# =====================================================

ENV DATABASE_URL=sqlite:///./data/store_intelligence.db

ENV POS_CSV_PATH=data/pos_transactions.csv

ENV PORT=8000


EXPOSE 8000


# =====================================================
# Health Check
# =====================================================

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
CMD python -c "import urllib.request, os; urllib.request.urlopen('http://localhost:' + os.getenv('PORT','8000') + '/health')" || exit 1


# =====================================================
# Start API
# =====================================================

CMD ["sh","-c","python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]