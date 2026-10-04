# The agent's computer: a small Debian box with a shell and common tools. No network (run with --network none).
FROM debian:bookworm-slim
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      bash coreutils procps python3 nano less file tree git ca-certificates jq bc zip unzip \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -u 1000 -m -s /bin/bash agent \
    && printf 'export PS1="\\[\\e[38;5;141m\\]agent@lexari\\[\\e[0m\\]:\\w$ "\ncd ~\n' >> /home/agent/.bashrc \
    && printf 'Welcome to your agent'"'"'s computer.\nFiles you and your agent make live in /home/agent.\n' > /home/agent/README.txt \
    && chown -R agent:agent /home/agent
USER agent
WORKDIR /home/agent
CMD ["sleep", "infinity"]
