# The agent's computer: a small Debian desktop (TigerVNC's Xvnc + Openbox + tint2 + Chromium) with a shell and common tools.
# Runs with --network none. The only way out is a filtering web proxy on a unix socket in /run/lexari (see relay.mjs):
# socat bridges 127.0.0.1:3128 inside the container to it, so the browser, curl and git reach the public web on ports 80/443
# and nothing on the host or private networks. The screen leaves the same way: Xvnc listens only on /run/lexari/vnc.sock
# (no TCP) and resizes to the viewer, so a phone gets a phone-sized desktop.
# Image tools: ImageMagick (convert, magick) and Pillow (python3 -c "from PIL import Image") for editing photos in chat.
FROM debian:bookworm-slim
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      bash coreutils procps python3 python3-pil imagemagick nano less file tree git ca-certificates jq bc zip unzip curl \
      tigervnc-standalone-server openbox tint2 hsetroot xdotool x11-utils x11-xserver-utils xterm socat \
      chromium fonts-dejavu-core fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/* /usr/share/doc/* /usr/share/man/* \
    && useradd -u 1000 -m -s /bin/bash agent
COPY image/ /opt/lexari/
RUN chmod 755 /opt/lexari/bin/* && ln -s /opt/lexari/bin/* /usr/local/bin/ \
    && cp /opt/lexari/openbox/menu.xml /etc/xdg/openbox/menu.xml && sed -i 's|<number>4</number>|<number>1</number>|' /etc/xdg/openbox/rc.xml \
    && sed -i 's|</applications>|<application class="*"><maximized>yes</maximized><decor>no</decor></application></applications>|' /etc/xdg/openbox/rc.xml \
    && mkdir -p /etc/xdg/tint2 && cp /opt/lexari/tint2rc /etc/xdg/tint2/tint2rc \
    && mkdir -p /usr/share/applications && cp /opt/lexari/*.desktop /usr/share/applications/ \
    && mkdir -p /run/lexari && chown agent:agent /run/lexari \
    && printf 'export PS1="\\[\\e[38;5;141m\\]agent@lexari\\[\\e[0m\\]:\\w$ "\ncd ~\n' >> /etc/skel/.bashrc
ENV DISPLAY=:0 http_proxy=http://127.0.0.1:3128 https_proxy=http://127.0.0.1:3128 HTTP_PROXY=http://127.0.0.1:3128 HTTPS_PROXY=http://127.0.0.1:3128 no_proxy=localhost,127.0.0.1
LABEL lexari.desktop.version="5"
USER agent
WORKDIR /home/agent
CMD ["/opt/lexari/bin/lexari-session"]
