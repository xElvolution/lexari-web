# The agent's computer: a small Debian desktop (TigerVNC's Xvnc + Openbox + tint2 + Chromium) with a shell and common tools.
# Runs with --network none. The only way out is a filtering web proxy on a unix socket in /run/lexari (see relay.mjs):
# socat bridges 127.0.0.1:3128 inside the container to it, so the browser, curl and git reach the public web on ports 80/443
# and nothing on the host or private networks. The screen leaves the same way: Xvnc listens only on /run/lexari/vnc.sock
# (no TCP) and resizes to the viewer, so a phone gets a phone-sized desktop.
# Image tools: ImageMagick (convert, magick) and Pillow (python3 -c "from PIL import Image") for editing photos in chat.
# v6 (agent abilities): PulseAudio virtual speaker + silent mic and ffmpeg (meeting audio, videos), whisper.cpp with the
# base.en model (offline speech-to-text), Piper TTS with one English voice (voiceovers), Node 22 + npm (build and deploy
# sites), python3-websocket (drives the browser over its local DevTools port for joining meetings).
FROM debian:bookworm-slim AS whisper
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends build-essential cmake git ca-certificates curl \
    && git clone --depth 1 --branch v1.7.6 https://github.com/ggml-org/whisper.cpp /src \
    && cd /src && cmake -B build -DBUILD_SHARED_LIBS=OFF -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=ON -DGGML_NATIVE=OFF -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON \
    && cmake --build build -j3 --config Release --target whisper-cli \
    && mkdir -p /out && cp build/bin/whisper-cli /out/ \
    && curl -fsSL -o /out/ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
FROM debian:bookworm-slim AS tools
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ca-certificates curl xz-utils \
    && mkdir -p /out/piper /out/node \
    && curl -fsSL https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz | tar -xz -C /out \
    && curl -fsSL -o /out/piper/en_US-lessac-medium.onnx https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx \
    && curl -fsSL -o /out/piper/en_US-lessac-medium.onnx.json https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json \
    && curl -fsSL https://nodejs.org/dist/v22.20.0/node-v22.20.0-linux-x64.tar.xz | tar -xJ -C /out/node --strip-components=1
FROM debian:bookworm-slim
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      bash coreutils procps python3 python3-pil python3-websocket imagemagick nano less file tree git ca-certificates jq bc zip unzip curl \
      tigervnc-standalone-server openbox tint2 hsetroot xdotool x11-utils x11-xserver-utils xterm socat \
      chromium fonts-dejavu-core fonts-liberation fonts-noto-color-emoji fonts-noto-core \
      pulseaudio pulseaudio-utils ffmpeg \
    && rm -rf /var/lib/apt/lists/* /usr/share/doc/* /usr/share/man/* \
    && useradd -u 1000 -m -s /bin/bash agent
COPY --from=whisper /out/whisper-cli /usr/local/bin/whisper-cli
COPY --from=whisper /out/ggml-base.en.bin /opt/whisper/ggml-base.en.bin
COPY --from=tools /out/piper /opt/piper
COPY --from=tools /out/node /opt/node
COPY image/ /opt/lexari/
RUN chmod 755 /opt/lexari/bin/* && ln -s /opt/lexari/bin/* /usr/local/bin/ \
    && ln -s /opt/node/bin/node /opt/node/bin/npm /opt/node/bin/npx /usr/local/bin/ && ln -s /opt/piper/piper /usr/local/bin/piper \
    && cp /opt/lexari/openbox/menu.xml /etc/xdg/openbox/menu.xml && sed -i 's|<number>4</number>|<number>1</number>|' /etc/xdg/openbox/rc.xml \
    && sed -i 's|</applications>|<application class="*"><maximized>yes</maximized><decor>no</decor></application></applications>|' /etc/xdg/openbox/rc.xml \
    && mkdir -p /etc/xdg/tint2 && cp /opt/lexari/tint2rc /etc/xdg/tint2/tint2rc \
    && mkdir -p /usr/share/applications && cp /opt/lexari/*.desktop /usr/share/applications/ \
    && mkdir -p /run/lexari && chown agent:agent /run/lexari \
    && printf 'export PS1="\\[\\e[38;5;141m\\]agent@lexari\\[\\e[0m\\]:\\w$ "\ncd ~\n' >> /etc/skel/.bashrc
ENV DISPLAY=:0 http_proxy=http://127.0.0.1:3128 https_proxy=http://127.0.0.1:3128 HTTP_PROXY=http://127.0.0.1:3128 HTTPS_PROXY=http://127.0.0.1:3128 no_proxy=localhost,127.0.0.1 \
    XDG_RUNTIME_DIR=/tmp/runtime PULSE_SERVER=unix:/tmp/runtime/pulse/native NPM_CONFIG_PREFIX=/home/agent/.npm-global PATH=/home/agent/.npm-global/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    WHISPER_MODEL=/opt/whisper/ggml-base.en.bin PIPER_VOICE=/opt/piper/en_US-lessac-medium.onnx
LABEL lexari.desktop.version="6"
USER agent
WORKDIR /home/agent
CMD ["/opt/lexari/bin/lexari-session"]
