<div align="center">
<img width="40%" height="40%" alt="homescreen-hero_logo_cropped_wide_again" src="https://github.com/user-attachments/assets/892ea966-cf31-4a2e-8494-c92afe08ad49" />

[![Typing SVG](https://readme-typing-svg.herokuapp.com?font=Oxanium&size=36&pause=1000&color=F3B358&background=FFFFFF00&center=true&repeat=false&width=435&lines=homescreen-hero)](https://git.io/typing-svg)

**A self-hosted Plex companion app with homescreen management, server insights, and useful tools, all in a sleek web dashboard**

![Static Badge](https://img.shields.io/badge/Plex-%20Built%20for%20Plex-e5a00d?style=flat&logo=Plex)
[![](https://dcbadge.limes.pink/api/server/https://discord.gg/yQ8pJzURsr?theme=default-inverted&style=flat&compact=true)](https://discord.gg/yQ8pJzURsr) ![Static Badge](https://img.shields.io/badge/Claude-Built%20with%20AI-%23D97757?style=flat&logo=Claude) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Documentation](https://img.shields.io/badge/Documentation-195de6?logo=readthedocs&logoColor=white&labelColor=555&label=%20)](https://docs.homescreenhero.com)
 ![GitHub Release](https://img.shields.io/github/v/release/trentferguson/homescreen-hero?logo=GitHub&color=%2327B63F)

## **[Try the Live Demo!](https://demo.homescreenhero.com)**
***Note:** The demo uses a mock Plex server I built, and is meant to be a Dashboard/UI preview. Not all functionality is enabled*

</div>

<div align="center">
<img src="https://github.com/user-attachments/assets/3f89a2a8-dd2f-4172-9cc0-b5c72bbc38d8" alt="homescreen-hero dashboard demo" width="90%" />
</div>

## Why homescreen-hero?

homescreen-hero is for Plex users who want more control over how their libraries feel, not just how they're stored. It brings together collection management, automation, personalization, and server tools in one self-hosted app, all so that you get to choose what appears, when it appears, and who sees it.

> **Transparency note:** While I am a professional engineer, homescreen-hero was built with a lot of help from AI coding tools, especially for frontend work and iteration. It's still actively designed, tested, reviewed, and maintained by a human(s), and being transparent about that process is important to me.

## Features

- **Web Dashboard:** Customizable drag-and-drop dashboard with widgets for Tautulli, Seerr, library analytics, and more
- **Smart Rotation:** Scheduled rotations with rule-based groups, smart filters, and random/weighted/LRU strategies
- **Per-User Targeting:** Show or hide collections per Plex user so every homescreen feels personalized
- **3rd Party List Sync:** Sync collections from Trakt, Letterboxd, MDBList, TMDb, AniList, and MAL. Auto-request missing items through Seerr.
- **Collection Sharing:** Share your custom built Plex collections with other users via exportable JSON files or shareable codes
- **Authentication:** Password login, Plex OAuth, or both (with role-based access control for future non-admin features)
- **Plex Tools:** Date Added Editor, Watch History Cleaner, Unwatched Reports, Copy Watch History, and more

> Got a feature idea? Head over to https://ideas.homescreenhero.com to submit feature requests and vote on the ideas you'd like to see implemented first!

📖 **[Full documentation at docs.homescreenhero.com](https://docs.homescreenhero.com)**

## Quick Start

For all installation methods, including more detailed setup instructions, see the [Installation docs](https://docs.homescreenhero.com/docs/getting-started/installation).

**Prerequisites:** [Docker](https://docs.docker.com/engine/install/), a running [Plex server](https://www.plex.tv/media-server-downloads/), and your [Plex token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/)

> **Security tip:** Want to keep secrets out of config files? Copy `.env.example` to `.env` and fill in your sensitive values *before* running the wizard. The wizard will automatically use your environment variables instead of writing them to config.yaml.

```bash
git clone https://github.com/trentferguson/homescreen-hero.git
cd homescreen-hero
mkdir -p data
docker-compose up -d
```

Open http://localhost:8000 (or whichever port you specified in .env file) and the Setup Wizard will guide you through configuration.


### Windows Portable (Beta)

A portable Windows build is available as a zip download on each [Release](https://github.com/trentferguson/homescreen-hero/releases/latest). See the [Windows Portable (Beta)](https://docs.homescreenhero.com/docs/getting-started/installation#windows-portable-beta) docs for installation instructions.

## Configuration

Copy `.env.example` to `.env` and fill in your Plex URL, token, and any integration API keys. The Setup Wizard handles the rest on first launch.

`HOMESCREEN_HERO_CONFIG` overrides the configuration file location. Without it, the app first checks `config.yaml` in its working directory, then an existing `/data/config.yaml` in the Docker data volume. If neither file exists, first-time setup still creates `config.yaml` in the working directory.

See the [Environment Variables](https://docs.homescreenhero.com/docs/getting-started/environment-variables) and [Configuration](https://docs.homescreenhero.com/docs/getting-started/configuration) docs for the full reference.

## Docker Image Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest stable release |
| `v0.3.1`, `v0.4.0`, etc. | Specific versions for pinned deployments |
| `nightly` | Automated builds from `develop` branch (unstable) |

```bash
docker pull trentferguson/homescreen-hero:latest
```

## Community Discord

If you are experiencing any issues, have feedback about the app, or wanna throw out a really cool feature request you thought of, our Discord server is the best place to be! My goal with homescreen-hero is to follow a community-focused development cycle, focusing first on implementing features requested by users/other contributors 😊

### Join the homescreen-hero [Discord Server](https://discord.gg/BsXtshZv8x)

## Contributing

All contributions welcome! Before you get started, please read through [CONTRIBUTING.md](CONTRIBUTING.md) to get an understanding of development setup and project guidelines. 

**Note:** Please make sure to follow the outlined conventions for PR titles and descriptions. Thank you :)

## License

This project is licensed under the [MIT License](LICENSE) - see the [LICENSE](LICENSE) file for details. All contributions to this project are welcomed! 

## 🙏 Acknowledgments

-   [**Agregarr:**](https://github.com/agregarr/agregarr) For being an amazing self-hosted app and inspiring me to try building something myself. Seriously, this app is awesome.
-   [**ColleXions:**](https://github.com/jl94x4/ColleXions) For initially doing exactly what I needed this app today. Another great inspiration for me to try my own hand at an creating something like this.
-   **Stitch (Google):** For helping me come up with a clean frontend design philosophy. It took a lot of trial error (I have almost no frontend dev experience, but turns out I'm very picky about what it looks like lol)
-   **Claude Code, Chat GPT, and Github Copilot:** For building ~90% of my frontend. As a Data Engineer, a big part of creating this app for myself was to get a true understanding of where AI Coding Agents stand today, and what exactly they can/cannot do. I got tired of the headlines/Reddit comments and figured this was the quickest way to the truth.

## 🐶 Puppy Tax 
I'm not ashamed to use my cutie for free internet points! (she was also great moral support on the *"I've been banging my head against a wall for days trying to figure out why the rotation runs every thirty seconds* types of issues lol)

<img width="25%" height="25%" alt="IMG_3015" src="https://github.com/user-attachments/assets/e24b34da-b541-4ead-b822-98ec31b5154e" />
<img width="25%" height="25%" alt="IMG_1225" src="https://github.com/user-attachments/assets/a4b6ad17-063b-4068-ac2d-91ec60f117f2" />
<img width="25%" height="25%" alt="IMG_3017" src="https://github.com/user-attachments/assets/300e1e92-ea19-4dc0-8dfc-8a17413725c6" />

---

<div align="center">

Made with ❤️, 💧, and ☕ by [trentferguson](https://github.com/trentferguson)

</div>
