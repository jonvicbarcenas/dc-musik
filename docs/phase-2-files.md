# Phase 2: Complete file contents

All 24 delivered files are reproduced below in full, including the generated npm lockfile and the Phase 1 overview formatted by Prettier. Each heading is the absolute workspace path. This is a snapshot of Phase 2; future phases may update configuration files.

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/package.json

````json
{
  "name": "discord-music-stream",
  "version": "0.1.0",
  "private": true,
  "description": "A self-hosted Discord music bot with validated full-track mirroring and Lavalink v4.",
  "type": "module",
  "engines": {
    "node": ">=20.19.0"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsup",
    "start": "node --enable-source-maps dist/index.js",
    "start:sharded": "node --enable-source-maps dist/shard.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "npm run typecheck && npm run lint && npm run format:check && npm test && npm run build",
    "config:check": "tsx scripts/check-env.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx scripts/migrate.ts",
    "commands:register": "tsx scripts/register-commands.ts"
  },
  "dependencies": {
    "better-sqlite3": "12.11.1",
    "discord.js": "14.27.0",
    "dotenv": "18.0.7",
    "drizzle-orm": "0.45.4",
    "ioredis": "6.0.0",
    "ipaddr.js": "2.5.0",
    "lavalink-client": "2.11.0",
    "pino": "10.4.0",
    "zod": "4.6.6"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@types/better-sqlite3": "9.6.0",
    "@types/node": "20.19.43",
    "drizzle-kit": "0.31.11",
    "eslint": "10.12.0",
    "globals": "17.13.0",
    "pino-pretty": "13.2.0",
    "prettier": "3.9.10",
    "tsup": "8.5.1",
    "tsx": "4.23.15",
    "typescript": "5.9.3",
    "typescript-eslint": "8.71.1",
    "vite": "7.3.7",
    "vitest": "4.1.11",
    "yaml": "2.9.1"
  },
  "overrides": {
    "esbuild": "0.28.2",
    "tinypool": "2.1.2"
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/package-lock.json

````json
{
  "name": "discord-music-stream",
  "version": "0.1.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "discord-music-stream",
      "version": "0.1.0",
      "dependencies": {
        "better-sqlite3": "12.11.1",
        "discord.js": "14.27.0",
        "dotenv": "18.0.7",
        "drizzle-orm": "0.45.4",
        "ioredis": "6.0.0",
        "ipaddr.js": "2.5.0",
        "lavalink-client": "2.11.0",
        "pino": "10.4.0",
        "zod": "4.6.6"
      },
      "devDependencies": {
        "@eslint/js": "10.0.1",
        "@types/better-sqlite3": "9.6.0",
        "@types/node": "20.19.43",
        "drizzle-kit": "0.31.11",
        "eslint": "10.12.0",
        "globals": "17.13.0",
        "pino-pretty": "13.2.0",
        "prettier": "3.9.10",
        "tsup": "8.5.1",
        "tsx": "4.23.15",
        "typescript": "5.9.3",
        "typescript-eslint": "8.71.1",
        "vite": "7.3.7",
        "vitest": "4.1.11",
        "yaml": "2.9.1"
      },
      "engines": {
        "node": ">=20.19.0"
      }
    },
    "node_modules/@cacheable/memory": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/@cacheable/memory/-/memory-2.2.0.tgz",
      "integrity": "sha512-CTLKqLItRCEixEAewD3/j9DB3/o96gpTPD4eJ1v+DGOlxZRZncRQkGYqqnAGCscYd6RNeXfGeiuCphsPtqyIfQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@cacheable/utils": "^2.5.0",
        "@keyv/bigmap": "^1.3.1",
        "hookified": "^1.15.1",
        "keyv": "^5.6.0"
      }
    },
    "node_modules/@cacheable/utils": {
      "version": "2.5.0",
      "resolved": "https://registry.npmjs.org/@cacheable/utils/-/utils-2.5.0.tgz",
      "integrity": "sha512-buipgOVDkkPXNR5+xBpDw7Zk2n1EvU7qBJCNUcL7rhQ//kfpOXPAvQ511Os0vpLYJ1pZnvudNytkQt2hst3wqA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hashery": "^1.5.1",
        "keyv": "^5.6.0"
      }
    },
    "node_modules/@discordjs/builders": {
      "version": "1.14.1",
      "resolved": "https://registry.npmjs.org/@discordjs/builders/-/builders-1.14.1.tgz",
      "integrity": "sha512-gSKkhXLqs96TCzk66VZuHHl8z2bQMJFGwrXC0f33ngK+FLNau4hU1PYny3DNJfNdSH+gVMzE85/d5FQ2BpcNwQ==",
      "license": "Apache-2.0",
      "dependencies": {
        "@discordjs/formatters": "^0.6.2",
        "@discordjs/util": "^1.2.0",
        "@sapphire/shapeshift": "^4.0.0",
        "discord-api-types": "^0.38.40",
        "fast-deep-equal": "^3.1.3",
        "ts-mixer": "^6.0.4",
        "tslib": "^2.6.3"
      },
      "engines": {
        "node": ">=16.11.0"
      },
      "funding": {
        "url": "https://github.com/discordjs/discord.js?sponsor"
      }
    },
    "node_modules/@discordjs/collection": {
      "version": "1.5.3",
      "resolved": "https://registry.npmjs.org/@discordjs/collection/-/collection-1.5.3.tgz",
      "integrity": "sha512-SVb428OMd3WO1paV3rm6tSjM4wC+Kecaa1EUGX7vc6/fddvw/6lg90z4QtCqm21zvVe92vMMDt9+DkIvjXImQQ==",
      "license": "Apache-2.0",
      "engines": {
        "node": ">=16.11.0"
      }
    },
    "node_modules/@discordjs/formatters": {
      "version": "0.6.2",
      "resolved": "https://registry.npmjs.org/@discordjs/formatters/-/formatters-0.6.2.tgz",
      "integrity": "sha512-y4UPwWhH6vChKRkGdMB4odasUbHOUwy7KL+OVwF86PvT6QVOwElx+TiI1/6kcmcEe+g5YRXJFiXSXUdabqZOvQ==",
      "license": "Apache-2.0",
      "dependencies": {
        "discord-api-types": "^0.38.33"
      },
      "engines": {
        "node": ">=16.11.0"
      },
      "funding": {
        "url": "https://github.com/discordjs/discord.js?sponsor"
      }
    },
    "node_modules/@discordjs/rest": {
      "version": "2.6.3",
      "resolved": "https://registry.npmjs.org/@discordjs/rest/-/rest-2.6.3.tgz",
      "integrity": "sha512-wvOylxNYJkwKjctS/Mn5GP1w9r3/rzyH+ThD1JlAca6zEdlHs8QWBBUQJpU5Q+W6DoIj/Ljh1IPlZs7hTU+UAg==",
      "license": "Apache-2.0",
      "dependencies": {
        "@discordjs/collection": "^2.1.1",
        "@discordjs/util": "^1.2.0",
        "@sapphire/async-queue": "^1.5.3",
        "@sapphire/snowflake": "^3.5.5",
        "@vladfrangu/async_event_emitter": "^2.4.6",
        "discord-api-types": "^0.38.50",
        "magic-bytes.js": "^1.13.0",
        "tslib": "^2.6.3",
        "undici": "^6.27.0"
      },
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/discordjs/discord.js?sponsor"
      }
    },
    "node_modules/@discordjs/rest/node_modules/@discordjs/collection": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/@discordjs/collection/-/collection-2.1.1.tgz",
      "integrity": "sha512-LiSusze9Tc7qF03sLCujF5iZp7K+vRNEDBZ86FT9aQAv3vxMLihUvKvpsCWiQ2DJq1tVckopKm1rxomgNUc9hg==",
      "license": "Apache-2.0",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/discordjs/discord.js?sponsor"
      }
    },
    "node_modules/@discordjs/util": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/@discordjs/util/-/util-1.2.0.tgz",
      "integrity": "sha512-3LKP7F2+atl9vJFhaBjn4nOaSWahZ/yWjOvA4e5pnXkt2qyXRCHLxoBQy81GFtLGCq7K9lPm9R517M1U+/90Qg==",
      "license": "Apache-2.0",
      "dependencies": {
        "discord-api-types": "^0.38.33"
      },
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/discordjs/discord.js?sponsor"
      }
    },
    "node_modules/@discordjs/ws": {
      "version": "1.2.3",
      "resolved": "https://registry.npmjs.org/@discordjs/ws/-/ws-1.2.3.tgz",
      "integrity": "sha512-wPlQDxEmlDg5IxhJPuxXr3Vy9AjYq5xCvFWGJyD7w7Np8ZGu+Mc+97LCoEc/+AYCo2IDpKioiH0/c/mj5ZR9Uw==",
      "license": "Apache-2.0",
      "dependencies": {
        "@discordjs/collection": "^2.1.0",
        "@discordjs/rest": "^2.5.1",
        "@discordjs/util": "^1.1.0",
        "@sapphire/async-queue": "^1.5.2",
        "@types/ws": "^8.5.10",
        "@vladfrangu/async_event_emitter": "^2.2.4",
        "discord-api-types": "^0.38.1",
        "tslib": "^2.6.2",
        "ws": "^8.17.0"
      },
      "engines": {
        "node": ">=16.11.0"
      },
      "funding": {
        "url": "https://github.com/discordjs/discord.js?sponsor"
      }
    },
    "node_modules/@discordjs/ws/node_modules/@discordjs/collection": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/@discordjs/collection/-/collection-2.1.1.tgz",
      "integrity": "sha512-LiSusze9Tc7qF03sLCujF5iZp7K+vRNEDBZ86FT9aQAv3vxMLihUvKvpsCWiQ2DJq1tVckopKm1rxomgNUc9hg==",
      "license": "Apache-2.0",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/discordjs/discord.js?sponsor"
      }
    },
    "node_modules/@drizzle-team/brocli": {
      "version": "0.10.2",
      "resolved": "https://registry.npmjs.org/@drizzle-team/brocli/-/brocli-0.10.2.tgz",
      "integrity": "sha512-z33Il7l5dKjUgGULTqBsQBQwckHh5AbIuxhdsIxDDiZAzBOrZO6q9ogcWC65kU382AfynTfgNumVcNIjuIua6w==",
      "dev": true,
      "license": "Apache-2.0"
    },
    "node_modules/@esbuild-kit/core-utils": {
      "version": "3.3.2",
      "resolved": "https://registry.npmjs.org/@esbuild-kit/core-utils/-/core-utils-3.3.2.tgz",
      "integrity": "sha512-sPRAnw9CdSsRmEtnsl2WXWdyquogVpB3yZ3dgwJfe8zrOzTsV7cJvmwrKVa+0ma5BoiGJ+BoqkMvawbayKUsqQ==",
      "deprecated": "Merged into tsx: https://tsx.hirok.io",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "esbuild": "~0.18.20",
        "source-map-support": "^0.5.21"
      }
    },
    "node_modules/@esbuild-kit/esm-loader": {
      "version": "2.6.5",
      "resolved": "https://registry.npmjs.org/@esbuild-kit/esm-loader/-/esm-loader-2.6.5.tgz",
      "integrity": "sha512-FxEMIkJKnodyA1OaCUoEvbYRkoZlLZ4d/eXFu9Fh8CbBBgP5EmZxrfTRyN0qpXZ4vOvqnE5YdRdcrmUUXuU+dA==",
      "deprecated": "Merged into tsx: https://tsx.hirok.io",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@esbuild-kit/core-utils": "^3.3.2",
        "get-tsconfig": "^4.7.0"
      }
    },
    "node_modules/@esbuild/aix-ppc64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/aix-ppc64/-/aix-ppc64-0.28.2.tgz",
      "integrity": "sha512-XExcO+dvLKvVtNTibSTBej1NCAbaGhWn9Ww1ZPx80qsahhPFe/8jgWP0IchNe0F3HwkU7n8ejhH8bjonqht8mQ==",
      "cpu": [
        "ppc64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "aix"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/android-arm": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/android-arm/-/android-arm-0.28.2.tgz",
      "integrity": "sha512-kXXoiPVVGQcnIYGOeaovwOURpniDBpSq4A03qkQ+BMQqtGG6HYap3xne9C1O1yo4TR3qxlCX5IqqmX6fFo2Lqg==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/android-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/android-arm64/-/android-arm64-0.28.2.tgz",
      "integrity": "sha512-5YfKeeI8qWfBZIX+u2xZC3Zlb3Os/gLS2sbEKM+I4ZOcsWmHS2WLysCcQZDAFRslDUU5Oiq44gf6PYN1vGwG5A==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/android-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/android-x64/-/android-x64-0.28.2.tgz",
      "integrity": "sha512-O387ite7SzUyCcy3JQX4P4bLtEA7bLLkx+esve5JHnyYfNTxcVpXZo9jhdB0lTKN44gztELTdU7nS8Nr16Fs1Q==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/darwin-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/darwin-arm64/-/darwin-arm64-0.28.2.tgz",
      "integrity": "sha512-n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp+KsxiyUSrRdIXnt73VhrPAx0fV44hgfmIVKjxMN9J1t5jySVkw==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/darwin-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/darwin-x64/-/darwin-x64-0.28.2.tgz",
      "integrity": "sha512-uq6suIWYP37qzGddBKPw5QEQPi6HiLGsO7UmkpfyaYNQ3D+rN6w6WfwH+nuqcGXWvawGwxOEroO4YGnFh95azw==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/freebsd-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/freebsd-arm64/-/freebsd-arm64-0.28.2.tgz",
      "integrity": "sha512-n+I0BTSRIoy+d6RPKnEVwql5UwBJolytvY4mAOIEJorKlqgPII8ix6slVVrfZ5Tnj7glIZvloylbB/EJPMWEXw==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/freebsd-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/freebsd-x64/-/freebsd-x64-0.28.2.tgz",
      "integrity": "sha512-78XJTJkvPs0kz2w61301PJjXl4g7q3JqiYMZ/M/yVI73EHBrCRTgkhu9oqG7vPqq+a/yadEW8aD+agKlk5xrmg==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-arm": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-arm/-/linux-arm-0.28.2.tgz",
      "integrity": "sha512-XlDnu2q5yoqems+xay6wSAcg9DDD7K9RLKZEBOMZm3ckNpJBvOX20tSfby8KfrrhINDyv9V2YVZKY/SpoGJI8w==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-arm64/-/linux-arm64-0.28.2.tgz",
      "integrity": "sha512-pW4AC0P3it8c7do9MVM4p51FzHzdM/TZrerurgRcHJ2WTa1VQ1CIq18xncfpBJw4ojkiZZrKW2yIBWBP92j6Ug==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-ia32": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-ia32/-/linux-ia32-0.28.2.tgz",
      "integrity": "sha512-CYbnj78HsIeA+DhgUKgFCfvNsTHFhMMrinUrMZpDXJXKN8T3XViTZ/+wtHeVxEWY8ewSzTFN+nRmSwO2tZaLUQ==",
      "cpu": [
        "ia32"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-loong64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-loong64/-/linux-loong64-0.28.2.tgz",
      "integrity": "sha512-buwkd8nsph4R+ajRvw0qM5Hja/TXQow3ptzWO2EbG/cqcIkHloRrdlBtQlshyYGTNFvfkfJ5tpPLVkY4DtsPfQ==",
      "cpu": [
        "loong64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-mips64el": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-mips64el/-/linux-mips64el-0.28.2.tgz",
      "integrity": "sha512-ZVykbDyk7519VwiNb9Lcj9m8XM6v5V9uKPvrEMkkEedVewf+0itkhahp4HDpgERXhwLRpWFypsGbG/J8s0QjJA==",
      "cpu": [
        "mips64el"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-ppc64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-ppc64/-/linux-ppc64-0.28.2.tgz",
      "integrity": "sha512-CAXl+Dtd9UUuJd8pKKdwh6MLm3MUMiqMPmhZ3tTSXPqfyQ3vDl6R5hZdZ/kYojK4ofXtdfSv1tFq8XzWx3heNQ==",
      "cpu": [
        "ppc64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-riscv64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-riscv64/-/linux-riscv64-0.28.2.tgz",
      "integrity": "sha512-GeXCej4IQtU1B+QlDV8W/RRvbzI3O/Stss+/bCXv4lZls5WGRtu2a+3JkA3i4qIUlMXpcHebWpF8AkJhATowuA==",
      "cpu": [
        "riscv64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-s390x": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-s390x/-/linux-s390x-0.28.2.tgz",
      "integrity": "sha512-3H1weTYZPxt/WOhByszQZybS9w5lKzUn1FDMsgEChbHWQwHYQQRfBxgCcZvPhjHfKyJjIievvMmEUawJrdY9Dg==",
      "cpu": [
        "s390x"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-0.28.2.tgz",
      "integrity": "sha512-4xTZr1FUmSoQW4XIWmit3tzQrUTZM+N3P0XV8xROKYF50XfI7xeO90+1bZvNwxIufQ9hDQVRJH5YhgPVF8A/HQ==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/netbsd-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/netbsd-arm64/-/netbsd-arm64-0.28.2.tgz",
      "integrity": "sha512-sSATRjPeDBg3pdgHoQfoYBob11Kk1FGa9lui5RIHZCoCkJa9QKlvl3/vKz2usCmYYjs7ymJR/2Nnsqe+Hjt5nw==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "netbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/netbsd-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/netbsd-x64/-/netbsd-x64-0.28.2.tgz",
      "integrity": "sha512-lqnzCV+mM0gIADaKihiCg6ifgfU2L3h5E33rNQBN1Y4MaVGnzryzmvvf7UHxprpQdE8hpqLolJ9Rl+SkIRDpyw==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "netbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/openbsd-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/openbsd-arm64/-/openbsd-arm64-0.28.2.tgz",
      "integrity": "sha512-AL2qJILH7lNjrDmCQDvdxMfAUIv8KMNZOvrwAQ8i8//ntL9FflhOyMJ8OZSMBb8/AWXe3/5v5S20y3zCoZWKoQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "openbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/openbsd-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/openbsd-x64/-/openbsd-x64-0.28.2.tgz",
      "integrity": "sha512-QtiuPytchRyC4rwUKhexJdQKvDuZ6hWloi3igqPQNUJCS1/v9EiO3UTOXR6A3FoMo4fnAKbWJdqaIwhOzh8qEw==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "openbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/openharmony-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/openharmony-arm64/-/openharmony-arm64-0.28.2.tgz",
      "integrity": "sha512-WkhYDmpTjLvGlScA1rwjRUmhl4k8oXR3cIbtqWmELgU/dFeHHlEllxDvdWcNJV9rbzCexB5vz8gtNewWLgCT7Q==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "openharmony"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/sunos-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/sunos-x64/-/sunos-x64-0.28.2.tgz",
      "integrity": "sha512-GPMSkTOtMnv2U2F8gxe4Io6qmVs+YKyp832Etqqxr0hFngmXQ3rzwytelm3GIn7T4VviRUlf3sOgBOiTdvaf7g==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "sunos"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/win32-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-arm64/-/win32-arm64-0.28.2.tgz",
      "integrity": "sha512-PIhhEkE9uPBleRBrQEJpUn7MBnibZzbGzYWPmY3x+YoVg/95zbjB4CxPPOQ8l5tYYM4mMaCthF8/1DIfBQQyWQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/win32-ia32": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-ia32/-/win32-ia32-0.28.2.tgz",
      "integrity": "sha512-YmJbfTlvU7Sdn9BB+4PRES4oB6pxgS37MAONj+hBr/cpXS1aBPKXxNnDbu+QCWPj0o9dgyxeq79g6c5P8KeuYA==",
      "cpu": [
        "ia32"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/win32-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-x64/-/win32-x64-0.28.2.tgz",
      "integrity": "sha512-5ebpxr3nWMzrL/rnUI755Jkuee0bHL/Gq0WTF9lvcpv73wAp5eu8MfBUgWK9bhWvZjj7yX8etf/8tI8Ney695g==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@eslint-community/eslint-utils": {
      "version": "4.10.1",
      "resolved": "https://registry.npmjs.org/@eslint-community/eslint-utils/-/eslint-utils-4.10.1.tgz",
      "integrity": "sha512-cuadcxVFE8sDK6iWJbs8Sn0av2Nrh2QSGQhVlBW9AaAHqHwjWsZHT8LJ4hFGPh7ASBV2deFdM7H/DPjulmh8rg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "eslint-visitor-keys": "^3.4.3"
      },
      "engines": {
        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      },
      "peerDependencies": {
        "eslint": "^6.0.0 || ^7.0.0 || >=8.0.0"
      }
    },
    "node_modules/@eslint-community/eslint-utils/node_modules/eslint-visitor-keys": {
      "version": "3.4.3",
      "resolved": "https://registry.npmjs.org/eslint-visitor-keys/-/eslint-visitor-keys-3.4.3.tgz",
      "integrity": "sha512-wpc+LXeiyiisxPlEkUzU6svyS1frIO3Mgxj1fdy7Pm8Ygzguax2N3Fa/D/ag1WqbOprdI+uY6wMUl8/a2G+iag==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/@eslint-community/regexpp": {
      "version": "4.12.2",
      "resolved": "https://registry.npmjs.org/@eslint-community/regexpp/-/regexpp-4.12.2.tgz",
      "integrity": "sha512-EriSTlt5OC9/7SXkRSCAhfSxxoSUgBm33OH+IkwbdpgoqsSsUg7y3uh+IICI/Qg4BBWr3U2i39RpmycbxMq4ew==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^12.0.0 || ^14.0.0 || >=16.0.0"
      }
    },
    "node_modules/@eslint/config-array": {
      "version": "0.23.5",
      "resolved": "https://registry.npmjs.org/@eslint/config-array/-/config-array-0.23.5.tgz",
      "integrity": "sha512-Y3kKLvC1dvTOT+oGlqNQ1XLqK6D1HU2YXPc52NmAlJZbMMWDzGYXMiPRJ8TYD39muD/OTjlZmNJ4ib7dvSrMBA==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@eslint/object-schema": "^3.0.5",
        "debug": "^4.3.1",
        "minimatch": "^10.2.4"
      },
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      }
    },
    "node_modules/@eslint/config-helpers": {
      "version": "0.7.0",
      "resolved": "https://registry.npmjs.org/@eslint/config-helpers/-/config-helpers-0.7.0.tgz",
      "integrity": "sha512-DObd/KKUsU+FaFv4PLxSRenpXfQWmPXXP3pPZ6/K1PCrMu2vQpMDMuQe/BqYeoLcz8ro0bVDF1RxOJgfVEdhUw==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@eslint/core": "^1.2.1"
      },
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      }
    },
    "node_modules/@eslint/core": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/@eslint/core/-/core-1.2.1.tgz",
      "integrity": "sha512-MwcE1P+AZ4C6DWlpin/OmOA54mmIZ/+xZuJiQd4SyB29oAJjN30UW9wkKNptW2ctp4cEsvhlLY/CsQ1uoHDloQ==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@types/json-schema": "^7.0.15"
      },
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      }
    },
    "node_modules/@eslint/js": {
      "version": "10.0.1",
      "resolved": "https://registry.npmjs.org/@eslint/js/-/js-10.0.1.tgz",
      "integrity": "sha512-zeR9k5pd4gxjZ0abRoIaxdc7I3nDktoXZk2qOv9gCNWx3mVwEn32VRhyLaRsDiJjTs0xq/T8mfPtyuXu7GWBcA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      },
      "funding": {
        "url": "https://eslint.org/donate"
      },
      "peerDependencies": {
        "eslint": "^10.0.0"
      },
      "peerDependenciesMeta": {
        "eslint": {
          "optional": true
        }
      }
    },
    "node_modules/@eslint/object-schema": {
      "version": "3.0.5",
      "resolved": "https://registry.npmjs.org/@eslint/object-schema/-/object-schema-3.0.5.tgz",
      "integrity": "sha512-vqTaUEgxzm+YDSdElad6PiRoX4t8VGDjCtt05zn4nU810UIx/uNEV7/lZJ6KwFThKZOzOxzXy48da+No7HZaMw==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      }
    },
    "node_modules/@eslint/plugin-kit": {
      "version": "0.7.3",
      "resolved": "https://registry.npmjs.org/@eslint/plugin-kit/-/plugin-kit-0.7.3.tgz",
      "integrity": "sha512-IkO+/KEUvwbVpiURZg+P7zF74z5Jxe0UgJxVni+RtoHQ6IZieXaO02kmadomap/q+l6bc/jdPGGqTjhuZnuz1Q==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@eslint/core": "^1.2.1",
        "levn": "^0.4.1"
      },
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      }
    },
    "node_modules/@humanfs/core": {
      "version": "0.19.2",
      "resolved": "https://registry.npmjs.org/@humanfs/core/-/core-0.19.2.tgz",
      "integrity": "sha512-UhXNm+CFMWcbChXywFwkmhqjs3PRCmcSa/hfBgLIb7oQ5HNb1wS0icWsGtSAUNgefHeI+eBrA8I1fxmbHsGdvA==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@humanfs/types": "^0.15.0"
      },
      "engines": {
        "node": ">=18.18.0"
      }
    },
    "node_modules/@humanfs/node": {
      "version": "0.16.8",
      "resolved": "https://registry.npmjs.org/@humanfs/node/-/node-0.16.8.tgz",
      "integrity": "sha512-gE1eQNZ3R++kTzFUpdGlpmy8kDZD/MLyHqDwqjkVQI0JMdI1D51sy1H958PNXYkM2rAac7e5/CnIKZrHtPh3BQ==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@humanfs/core": "^0.19.2",
        "@humanfs/types": "^0.15.0",
        "@humanwhocodes/retry": "^0.4.0"
      },
      "engines": {
        "node": ">=18.18.0"
      }
    },
    "node_modules/@humanfs/types": {
      "version": "0.15.0",
      "resolved": "https://registry.npmjs.org/@humanfs/types/-/types-0.15.0.tgz",
      "integrity": "sha512-ZZ1w0aoQkwuUuC7Yf+7sdeaNfqQiiLcSRbfI08oAxqLtpXQr9AIVX7Ay7HLDuiLYAaFPu8oBYNq/QIi9URHJ3Q==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=18.18.0"
      }
    },
    "node_modules/@humanwhocodes/module-importer": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/@humanwhocodes/module-importer/-/module-importer-1.0.1.tgz",
      "integrity": "sha512-bxveV4V8v5Yb4ncFTT3rPSgZBOpCkjfK0y4oVVVJwIuDVBRMDXrPyXRL988i5ap9m9bnyEEjWfm5WkBmtffLfA==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=12.22"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/nzakas"
      }
    },
    "node_modules/@humanwhocodes/retry": {
      "version": "0.4.3",
      "resolved": "https://registry.npmjs.org/@humanwhocodes/retry/-/retry-0.4.3.tgz",
      "integrity": "sha512-bV0Tgo9K4hfPCek+aMAn81RppFKv2ySDQeMoSZuvTASywNTnVJCArCZE2FWqpvIatKu7VMRLWlR1EazvVhDyhQ==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=18.18"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/nzakas"
      }
    },
    "node_modules/@ioredis/commands": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/@ioredis/commands/-/commands-2.0.0.tgz",
      "integrity": "sha512-vrx0AE/T0h7cRZwfo1M39Cr+ZhZrkf0V8mQN75wucKCxCLD9l/VX6no3gFvrLqD1IlG/1LtzWovqEw3t0Vr9zg==",
      "license": "MIT"
    },
    "node_modules/@jridgewell/gen-mapping": {
      "version": "0.3.13",
      "resolved": "https://registry.npmjs.org/@jridgewell/gen-mapping/-/gen-mapping-0.3.13.tgz",
      "integrity": "sha512-2kkt/7niJ6MgEPxF0bYdQ6etZaA+fQvDcLKckhy1yIQOzaoKjBBjSj63/aLVjYE3qhRt5dvM+uUyfCg6UKCBbA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.0",
        "@jridgewell/trace-mapping": "^0.3.24"
      }
    },
    "node_modules/@jridgewell/resolve-uri": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/@jridgewell/resolve-uri/-/resolve-uri-3.1.2.tgz",
      "integrity": "sha512-bRISgCIjP20/tbWSPWMEi54QVPRZExkuD9lJL+UIxUKtwVJA8wW1Trb1jMs1RFXo1CBTNZ/5hpC9QvmKWdopKw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@jridgewell/sourcemap-codec": {
      "version": "1.6.0",
      "resolved": "https://registry.npmjs.org/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.6.0.tgz",
      "integrity": "sha512-T7jf+5zgsZHwNJ4lvQ7/aezbyk0nNX+zJVWpmHA7VYsEx7a7qr5Rg5IbtJFqkgze5Y2sruq1RUY8Q837Od7iFw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@jridgewell/trace-mapping": {
      "version": "0.3.31",
      "resolved": "https://registry.npmjs.org/@jridgewell/trace-mapping/-/trace-mapping-0.3.31.tgz",
      "integrity": "sha512-zzNR+SdQSDJzc8joaeP8QQoCQr8NuYx2dIIytl1QeBEZHJ9uW6hebsrYgbz8hJwUQao3TWCMtmfV8Nu1twOLAw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/resolve-uri": "^3.1.0",
        "@jridgewell/sourcemap-codec": "^1.4.14"
      }
    },
    "node_modules/@keyv/bigmap": {
      "version": "1.3.1",
      "resolved": "https://registry.npmjs.org/@keyv/bigmap/-/bigmap-1.3.1.tgz",
      "integrity": "sha512-WbzE9sdmQtKy8vrNPa9BRnwZh5UF4s1KTmSK0KUVLo3eff5BlQNNWDnFOouNpKfPKDnms9xynJjsMYjMaT/aFQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hashery": "^1.4.0",
        "hookified": "^1.15.0"
      },
      "engines": {
        "node": ">= 18"
      },
      "peerDependencies": {
        "keyv": "^5.6.0"
      }
    },
    "node_modules/@keyv/serialize": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/@keyv/serialize/-/serialize-1.1.1.tgz",
      "integrity": "sha512-dXn3FZhPv0US+7dtJsIi2R+c7qWYiReoEh5zUntWCf4oSpMNib8FDhSoed6m3QyZdx5hK7iLFkYk3rNxwt8vTA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@napi-rs/lzma-linux-x64-gnu": {
      "version": "1.5.1",
      "resolved": "https://registry.npmjs.org/@napi-rs/lzma-linux-x64-gnu/-/lzma-linux-x64-gnu-1.5.1.tgz",
      "integrity": "sha512-oTXEIha4SsuXdTA4Iyskj0kpdx2yVXdhd75c2v3xGrHFfVMsbhTPZU/nMPL4sWKo4pBHm3aucLaqGlF696dTyQ==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^22.20 || ^24.12 || >=25"
      }
    },
    "node_modules/@pinojs/redact": {
      "version": "0.4.0",
      "resolved": "https://registry.npmjs.org/@pinojs/redact/-/redact-0.4.0.tgz",
      "integrity": "sha512-k2ENnmBugE/rzQfEcdWHcCY+/FM3VLzH9cYEsbdsoqrvzAKRhUZeRNhAZvB8OitQJ1TBed3yqWtdjzS6wJKBwg==",
      "license": "MIT"
    },
    "node_modules/@rollup/rollup-android-arm-eabi": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-android-arm-eabi/-/rollup-android-arm-eabi-4.64.5.tgz",
      "integrity": "sha512-MrfgRQSpD5hkkRg6XI16B6EDLb+6+xp8xje6bpdSwkYw+qxrBKbUVrRAQu9h82UT+QumSIVQ8HXsXjPd2dlhqw==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ]
    },
    "node_modules/@rollup/rollup-android-arm64": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-android-arm64/-/rollup-android-arm64-4.64.5.tgz",
      "integrity": "sha512-+uu2p/R9Tzn8GpoQyX1pAo5dmKT1DhXevfaCzqzmPFhnLjHLWw7uWkaVGlxmhwYoRiYYhsGfRcD5cTBpL7rgSw==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ]
    },
    "node_modules/@rollup/rollup-darwin-arm64": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-darwin-arm64/-/rollup-darwin-arm64-4.64.5.tgz",
      "integrity": "sha512-17dys+YEmzwzzFVHQAVDONg5FALXY9kd99HFEpfk4gJVHYxoh5bGea3D4t1fXXnwkTcOe25wPyd6nWS0I8IdLQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ]
    },
    "node_modules/@rollup/rollup-darwin-x64": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-darwin-x64/-/rollup-darwin-x64-4.64.5.tgz",
      "integrity": "sha512-wg0zQEKkEvFZf1UaaX1UELOoPs//OSKUG7D+yITuqOsAvza7LvHTv5Wu4nmMfzNG7EYI2jp2PJC7Id6OETmsYQ==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ]
    },
    "node_modules/@rollup/rollup-freebsd-arm64": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-freebsd-arm64/-/rollup-freebsd-arm64-4.64.5.tgz",
      "integrity": "sha512-CoJmWcpEMuwin+TZ/ev/H9uDyF/uxUKQSWXdmIPn/UBx/uGV9+4ebMp0FwnlhWR9PE1AdzYsKf3bZevhif38+A==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ]
    },
    "node_modules/@rollup/rollup-freebsd-x64": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-freebsd-x64/-/rollup-freebsd-x64-4.64.5.tgz",
      "integrity": "sha512-PxZnLAaTUAL5xG0W2BXLeYPKrK2b3LIASV2/e/Kf7PZvSLI1iAQIm9B9aJD+YyFIT7hc6qaMV3+OOO35R28LfA==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ]
    },
    "node_modules/@rollup/rollup-linux-arm-gnueabihf": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-arm-gnueabihf/-/rollup-linux-arm-gnueabihf-4.64.5.tgz",
      "integrity": "sha512-uPo3IvnONjhbFXwWgroBeFwOicuhT7ZwQrnzkzmOtBJzeQbkUJUE1SJDfDI31ijQ5+ZUIA6sPrdUMxTSnxUWAg==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-arm-musleabihf": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-arm-musleabihf/-/rollup-linux-arm-musleabihf-4.64.5.tgz",
      "integrity": "sha512-ywI8Jyuc4LyHYTjC0mw4yA1ulvZBkHusdpWnoiEBsmBuHvSnt90btTBGCZ+s/2y+YNNfVAEKy33nPo5UI9zTmg==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-arm64-gnu": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-arm64-gnu/-/rollup-linux-arm64-gnu-4.64.5.tgz",
      "integrity": "sha512-tmuXJoQ/3ovSr637aykZMdQteU/CB2APAz2CrvsbibuoHZi1BS1Db13cVViBdEARGwXCLn1DSJ8wsjoThLJPGA==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-arm64-musl": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-arm64-musl/-/rollup-linux-arm64-musl-4.64.5.tgz",
      "integrity": "sha512-5FMjSYNcUOHx7oW8Qu9KB6jGPpvF/8sG7+BDHwU/Ihh1/6FMJ9ySmsFG4tJ1qbNRuP8OLzCBDso4sF0mQaLuFQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-loong64-gnu": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-loong64-gnu/-/rollup-linux-loong64-gnu-4.64.5.tgz",
      "integrity": "sha512-K8ZJ+neLDbUkIrL8dqF/5LtuVCrKwo27kREgOlxjBEjlOXwHvDnHLU8Z/UKv/B49qi7e8hsSDOyoJwhwqhvX4w==",
      "cpu": [
        "loong64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-loong64-musl": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-loong64-musl/-/rollup-linux-loong64-musl-4.64.5.tgz",
      "integrity": "sha512-NlVxsq7PFPv0DBKGuNWRDKixQYQCjM53zl04mxEcKMBmJbCBIUm1JdPfIWDRHyOOFzzYPmLQzfeEwh4716ayQg==",
      "cpu": [
        "loong64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-ppc64-gnu": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-ppc64-gnu/-/rollup-linux-ppc64-gnu-4.64.5.tgz",
      "integrity": "sha512-ARhRHJYs5eCFet5azfrHD97vOkD8OzNW2RSMlvo5CcBqXaTOLfp0OHDtUQh7/K5AL5fUYoFp2fgC9KDg4vVYMQ==",
      "cpu": [
        "ppc64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-ppc64-musl": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-ppc64-musl/-/rollup-linux-ppc64-musl-4.64.5.tgz",
      "integrity": "sha512-atSgreM5C7jpxd9aEXN+6vJ5wTd05iYw+S3FiQpw7VsoEl8B90llbq35ARON+GOHj5QlVQEq2vOKWCHTob/BSQ==",
      "cpu": [
        "ppc64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-riscv64-gnu": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-riscv64-gnu/-/rollup-linux-riscv64-gnu-4.64.5.tgz",
      "integrity": "sha512-vmlmwBFGnjVWxSRoVabNkyYuscSmg52Pd0fM8jEbNT3Jmka4A6HcB84x4uAmuumznWfBVaxKOqU6jbEgomWKCA==",
      "cpu": [
        "riscv64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-riscv64-musl": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-riscv64-musl/-/rollup-linux-riscv64-musl-4.64.5.tgz",
      "integrity": "sha512-hhJrP6S9WkbsbcHgUkvCBS5Cn8IdsG8XjlLZyxjnv9+NdoYfbbZE4TWJYr8apdaj1M5t5Y1id2StnEslxpNFyA==",
      "cpu": [
        "riscv64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-s390x-gnu": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-s390x-gnu/-/rollup-linux-s390x-gnu-4.64.5.tgz",
      "integrity": "sha512-NNVCyN9pGrwFmQa4bf+Cnf5aVH3g6ZpnlOg1Cs/H9swIHT9bRixijfzUqyEIWm1WtiAuR1LJ+rJH6zpBm8kgQA==",
      "cpu": [
        "s390x"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-x64-gnu": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-x64-gnu/-/rollup-linux-x64-gnu-4.64.5.tgz",
      "integrity": "sha512-dR9nd6OKnvSS60Ifz/L7Mj5zzYyoqyRn2NwTuaOONKaa3xsVGXyp8YusMbvFyEOR94DxnwgcbgsFqkHd29ZSzQ==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-x64-musl": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-x64-musl/-/rollup-linux-x64-musl-4.64.5.tgz",
      "integrity": "sha512-1tzsMjaqhsh3bAO6SJiJqh8hIr9sSPRd+i2vPPxJHod8/XYnf9TEnK0z/u3r1z1AkI347X0KbRSg9dWcxeGahw==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-openbsd-x64": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-openbsd-x64/-/rollup-openbsd-x64-4.64.5.tgz",
      "integrity": "sha512-01mWMQblKoXXsmk28KXtpbA96w7g/aOWUoV3AC16fdHdqkykGalqyyM+5u8M7uP5/MEMiiPv69Hv7iv/hEH/dA==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "openbsd"
      ]
    },
    "node_modules/@rollup/rollup-openharmony-arm64": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-openharmony-arm64/-/rollup-openharmony-arm64-4.64.5.tgz",
      "integrity": "sha512-trdnMPb/DNm4V/CgsaoGgr90HfQQ071wfK0KoIs4YpLvjBgVQGXhGabg2Z6nK4EcYNilrb9ZZPcsP6+zpJIdxQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "openharmony"
      ]
    },
    "node_modules/@rollup/rollup-win32-arm64-msvc": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-win32-arm64-msvc/-/rollup-win32-arm64-msvc-4.64.5.tgz",
      "integrity": "sha512-x2LxZlfdfsw99T6/qb9EqE/Qi84JWzibjyOJyhJsgFJy6CafaTiqIXCCnslCGrV5XWNh7fwrS3FbRENcuKnooA==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@rollup/rollup-win32-ia32-msvc": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-win32-ia32-msvc/-/rollup-win32-ia32-msvc-4.64.5.tgz",
      "integrity": "sha512-/Qd/9aDQIo0+jmItgBmPIs8195YVbDxRRApn47GyufgbutCDOh7eP5vSKKlI4QNFeaI+wKQAkSMsPnF3EuMpaA==",
      "cpu": [
        "ia32"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@rollup/rollup-win32-x64-gnu": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-win32-x64-gnu/-/rollup-win32-x64-gnu-4.64.5.tgz",
      "integrity": "sha512-ngUJ/XvOWrqbd2IMsfXfh2xXFLTP3sY7sCKvxbGvYdBZ1KmXFd3ewDZ9n3/GNzAUgzRuhLT/UvJRivbNoAQRBw==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@rollup/rollup-win32-x64-msvc": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-win32-x64-msvc/-/rollup-win32-x64-msvc-4.64.5.tgz",
      "integrity": "sha512-IhV6ew/DuzUWwHaYmlh7MrPCV3lKFUq/amTEwysi4r/mwNPAEfAMh5dYWeTSPTeMy2pFHGMEWYtPkHzfX3tG5A==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@sapphire/async-queue": {
      "version": "1.5.5",
      "resolved": "https://registry.npmjs.org/@sapphire/async-queue/-/async-queue-1.5.5.tgz",
      "integrity": "sha512-cvGzxbba6sav2zZkH8GPf2oGk9yYoD5qrNWdu9fRehifgnFZJMV+nuy2nON2roRO4yQQ+v7MK/Pktl/HgfsUXg==",
      "license": "MIT",
      "engines": {
        "node": ">=v14.0.0",
        "npm": ">=7.0.0"
      }
    },
    "node_modules/@sapphire/shapeshift": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/@sapphire/shapeshift/-/shapeshift-4.0.0.tgz",
      "integrity": "sha512-d9dUmWVA7MMiKobL3VpLF8P2aeanRTu6ypG2OIaEv/ZHH/SUQ2iHOVyi5wAPjQ+HmnMuL0whK9ez8I/raWbtIg==",
      "license": "MIT",
      "dependencies": {
        "fast-deep-equal": "^3.1.3",
        "lodash": "^4.17.21"
      },
      "engines": {
        "node": ">=v16"
      }
    },
    "node_modules/@sapphire/snowflake": {
      "version": "3.5.5",
      "resolved": "https://registry.npmjs.org/@sapphire/snowflake/-/snowflake-3.5.5.tgz",
      "integrity": "sha512-xzvBr1Q1c4lCe7i6sRnrofxeO1QTP/LKQ6A6qy0iB4x5yfiSfARMEQEghojzTNALDTcv8En04qYNIco9/K9eZQ==",
      "license": "MIT",
      "engines": {
        "node": ">=v14.0.0",
        "npm": ">=7.0.0"
      }
    },
    "node_modules/@standard-schema/spec": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/@standard-schema/spec/-/spec-1.1.0.tgz",
      "integrity": "sha512-l2aFy5jALhniG5HgqrD6jXLi/rUWrKvqN/qJx6yoJsgKhblVd+iqqU4RCXavm/jPityDo5TCvKMnpjKnOriy0w==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/better-sqlite3": {
      "version": "9.6.0",
      "resolved": "https://registry.npmjs.org/@types/better-sqlite3/-/better-sqlite3-9.6.0.tgz",
      "integrity": "sha512-ZEEwBSgMu7GYJOynoagg5X9JbxfL6dTJDsgViJIqh67jV44kyOr9RXfmFjLK5rzC4MWssP06t9hu/JwGDnUbCg==",
      "devOptional": true,
      "license": "MIT",
      "peer": true,
      "dependencies": {
        "@types/node": "*"
      }
    },
    "node_modules/@types/chai": {
      "version": "5.2.3",
      "resolved": "https://registry.npmjs.org/@types/chai/-/chai-5.2.3.tgz",
      "integrity": "sha512-Mw558oeA9fFbv65/y4mHtXDs9bPnFMZAL/jxdPFUpOHHIXX91mcgEHbS5Lahr+pwZFR8A7GQleRWeI6cGFC2UA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@types/deep-eql": "*",
        "assertion-error": "^2.0.1"
      }
    },
    "node_modules/@types/deep-eql": {
      "version": "4.0.2",
      "resolved": "https://registry.npmjs.org/@types/deep-eql/-/deep-eql-4.0.2.tgz",
      "integrity": "sha512-c9h9dVVMigMPc4bwTvC5dxqtqJZwQPePsWjPlpSOnojbor6pGqdk541lfA7AqFQr5pB1BRdq0juY9db81BwyFw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/esrecurse": {
      "version": "4.3.1",
      "resolved": "https://registry.npmjs.org/@types/esrecurse/-/esrecurse-4.3.1.tgz",
      "integrity": "sha512-xJBAbDifo5hpffDBuHl0Y8ywswbiAp/Wi7Y/GtAgSlZyIABppyurxVueOPE8LUQOxdlgi6Zqce7uoEpqNTeiUw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/estree": {
      "version": "1.0.9",
      "resolved": "https://registry.npmjs.org/@types/estree/-/estree-1.0.9.tgz",
      "integrity": "sha512-GhdPgy1el4/ImP05X05Uw4cw2/M93BCUmnEvWZNStlCzEKME4Fkk+YpoA5OiHNQmoS7Cafb8Xa3Pya8m1Qrzeg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/json-schema": {
      "version": "7.0.15",
      "resolved": "https://registry.npmjs.org/@types/json-schema/-/json-schema-7.0.15.tgz",
      "integrity": "sha512-5+fP8P8MFNC+AyZCDxrB2pkZFPGzqQWUzpSeuuVLvm8VMcorNYavBqoFcxK8bQz4Qsbn4oUEEem4wDLfcysGHA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/node": {
      "version": "20.19.43",
      "resolved": "https://registry.npmjs.org/@types/node/-/node-20.19.43.tgz",
      "integrity": "sha512-6oYBAi5ikg4Pl+kGsoYtawUMBT2zZMCvPNF7pVLnHZfd1zf38DRiWn/gT01RYCdUqkv7Fhr+C9ot4/tb+2sVvA==",
      "license": "MIT",
      "dependencies": {
        "undici-types": "~6.21.0"
      }
    },
    "node_modules/@types/ws": {
      "version": "8.18.2",
      "resolved": "https://registry.npmjs.org/@types/ws/-/ws-8.18.2.tgz",
      "integrity": "sha512-67MQl+fpWKVTT1NYdnmo3U4sc/xPo/zQBncVnI74qmQa0z/b+1g6iYqNmGCPbxO+zz2aklb08a0oHfegiVd0/w==",
      "license": "MIT",
      "dependencies": {
        "@types/node": "*"
      }
    },
    "node_modules/@typescript-eslint/eslint-plugin": {
      "version": "8.71.1",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/eslint-plugin/-/eslint-plugin-8.71.1.tgz",
      "integrity": "sha512-nNlBf6HuotqMgZvSkWD5hNdemiBIxQ2NmrlgfcUIeZRs+BbakjscCQRq/Hb74EFVnFiSWWdL12JruqwBy3ERDw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@eslint-community/regexpp": "^4.12.2",
        "@typescript-eslint/scope-manager": "8.71.1",
        "@typescript-eslint/type-utils": "8.71.1",
        "@typescript-eslint/utils": "8.71.1",
        "@typescript-eslint/visitor-keys": "8.71.1",
        "ignore": "^7.0.5",
        "natural-compare": "^1.4.0",
        "ts-api-utils": "^2.5.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "@typescript-eslint/parser": "^8.71.1",
        "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0",
        "typescript": ">=4.8.4 <6.1.0"
      }
    },
    "node_modules/@typescript-eslint/eslint-plugin/node_modules/ignore": {
      "version": "7.0.12",
      "resolved": "https://registry.npmjs.org/ignore/-/ignore-7.0.12.tgz",
      "integrity": "sha512-/8UvqAPU9DGTI9k4mxtf49U37Isfwr8Uts96+SBHIkFxPJnHS0Ew4f00sM4Scd8V8EjM0jUNtVDdv1kPdt35lg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 4"
      }
    },
    "node_modules/@typescript-eslint/parser": {
      "version": "8.71.1",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/parser/-/parser-8.71.1.tgz",
      "integrity": "sha512-oM/5sAqz/l1v/zYK1qTOPrn2+JIrBGC1V6uNYucRO5gh6eT9vWJ/RhPbGE59byvZEUQ4VP6XkLBaS5Jti5jpvw==",
      "dev": true,
      "license": "MIT",
      "peer": true,
      "dependencies": {
        "@typescript-eslint/scope-manager": "8.71.1",
        "@typescript-eslint/types": "8.71.1",
        "@typescript-eslint/typescript-estree": "8.71.1",
        "@typescript-eslint/visitor-keys": "8.71.1",
        "debug": "^4.4.3"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0",
        "typescript": ">=4.8.4 <6.1.0"
      }
    },
    "node_modules/@typescript-eslint/project-service": {
      "version": "8.71.1",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/project-service/-/project-service-8.71.1.tgz",
      "integrity": "sha512-Oijc9RUsohHjncg6iGi7gCtjnEjYt9FWv9u6ygK8uKcHK5eLjLAkqERQ9BaytbpceOFdk6kifPCS/zAZE+A99g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/tsconfig-utils": "^8.71.1",
        "@typescript-eslint/types": "^8.71.1",
        "debug": "^4.4.3"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "typescript": ">=4.8.4 <6.1.0"
      }
    },
    "node_modules/@typescript-eslint/scope-manager": {
      "version": "8.71.1",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/scope-manager/-/scope-manager-8.71.1.tgz",
      "integrity": "sha512-1YUDZXdTnXLlob03SFHBipdyMBsDVm7zoSz0ytTJ39dk5J1TgsTK03VlR/dLXG/RLLUrPcYbD4rp23BmHxHP0w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/types": "8.71.1",
        "@typescript-eslint/visitor-keys": "8.71.1"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      }
    },
    "node_modules/@typescript-eslint/tsconfig-utils": {
      "version": "8.71.1",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/tsconfig-utils/-/tsconfig-utils-8.71.1.tgz",
      "integrity": "sha512-oTvkml5SxXhgg+WWKhod5qWQICDXtOB+/Hi9VdPKFAANJ2b7YOgMffgvzXuqog7R6A/JtrzRf128dsxummyWhg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "typescript": ">=4.8.4 <6.1.0"
      }
    },
    "node_modules/@typescript-eslint/type-utils": {
      "version": "8.71.1",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/type-utils/-/type-utils-8.71.1.tgz",
      "integrity": "sha512-kH3t3jZCYv2PZSBEWPKTariLrCaoF1CLoPitYFBJOhAGEwWnSRAtGEifrfrpBa4K9JlwWNZotgA5w3/wLSk/FQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/types": "8.71.1",
        "@typescript-eslint/typescript-estree": "8.71.1",
        "@typescript-eslint/utils": "8.71.1",
        "debug": "^4.4.3",
        "ts-api-utils": "^2.5.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0",
        "typescript": ">=4.8.4 <6.1.0"
      }
    },
    "node_modules/@typescript-eslint/types": {
      "version": "8.71.1",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/types/-/types-8.71.1.tgz",
      "integrity": "sha512-ybYnPTUwg3VQQOFEiBPLs8Jxl1ry2vXdn1kVKguomBbvxpetdu3MKTNDqFNUrlG8ylP9MpZosmXMFYlGQHk1oQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      }
    },
    "node_modules/@typescript-eslint/typescript-estree": {
      "version": "8.71.1",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/typescript-estree/-/typescript-estree-8.71.1.tgz",
      "integrity": "sha512-pSKSEK1JJpHs6KiKVtABCE4iJK5d7FLFzDXQNBQ2oRY7LEd3UwOt3TZemTgu9syTIf56dJWlTn/pdmrO9oKUXQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/project-service": "8.71.1",
        "@typescript-eslint/tsconfig-utils": "8.71.1",
        "@typescript-eslint/types": "8.71.1",
        "@typescript-eslint/visitor-keys": "8.71.1",
        "debug": "^4.4.3",
        "minimatch": "^10.2.2",
        "semver": "^7.7.3",
        "tinyglobby": "^0.2.15",
        "ts-api-utils": "^2.5.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "typescript": ">=4.8.4 <6.1.0"
      }
    },
    "node_modules/@typescript-eslint/utils": {
      "version": "8.71.1",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/utils/-/utils-8.71.1.tgz",
      "integrity": "sha512-CBjT6gfAz3DW2j9Q4moFnqt208Aq+506sVGXfpRcyAeqn0EpayL0mjdWoCO2t3RC7GewNrFxdeehuEaPg6DMzQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@eslint-community/eslint-utils": "^4.9.1",
        "@typescript-eslint/scope-manager": "8.71.1",
        "@typescript-eslint/types": "8.71.1",
        "@typescript-eslint/typescript-estree": "8.71.1"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0",
        "typescript": ">=4.8.4 <6.1.0"
      }
    },
    "node_modules/@typescript-eslint/visitor-keys": {
      "version": "8.71.1",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/visitor-keys/-/visitor-keys-8.71.1.tgz",
      "integrity": "sha512-0GxiUGqMU0qXJt58cBsiG3DP8lUmBaFo2vChtUX+CT7PnR3v/VGLLrzVP4K9r1lNiZXjHYefMBbPunplr09v6w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/types": "8.71.1",
        "eslint-visitor-keys": "^5.0.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      }
    },
    "node_modules/@vitest/expect": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@vitest/expect/-/expect-4.1.11.tgz",
      "integrity": "sha512-VX2x5vNJXET47KAFzwERI+KRMtTTCSWTfSMKsW7JsUsXV4psq++e3DvZpuTDOpHcxytiDs6p2nhVb2tVDiiUYw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@standard-schema/spec": "^1.1.0",
        "@types/chai": "^5.2.2",
        "@vitest/spy": "4.1.11",
        "@vitest/utils": "4.1.11",
        "chai": "^6.2.2",
        "tinyrainbow": "^3.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/vitest"
      }
    },
    "node_modules/@vitest/mocker": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@vitest/mocker/-/mocker-4.1.11.tgz",
      "integrity": "sha512-2XJVD55d1o5AZous5CCGKS74g/riOj9odEt2bQpCVZeblHyHdnMeFl4jl0XjU21stf4mbjUkew2eXQZt65g5CQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@vitest/spy": "4.1.11",
        "estree-walker": "^3.0.3",
        "magic-string": "^0.30.21"
      },
      "funding": {
        "url": "https://opencollective.com/vitest"
      },
      "peerDependencies": {
        "msw": "^2.4.9",
        "vite": "^6.0.0 || ^7.0.0 || ^8.0.0"
      },
      "peerDependenciesMeta": {
        "msw": {
          "optional": true
        },
        "vite": {
          "optional": true
        }
      }
    },
    "node_modules/@vitest/pretty-format": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@vitest/pretty-format/-/pretty-format-4.1.11.tgz",
      "integrity": "sha512-yiZzPbGTS9Sr/JpFl8zHrcIkAofNbFV6k21vIgQN/cY/oxZeXhJv5sc/MBJ5jFKWmWs+oJHw0UXLZjmf931+Vw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "tinyrainbow": "^3.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/vitest"
      }
    },
    "node_modules/@vitest/runner": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@vitest/runner/-/runner-4.1.11.tgz",
      "integrity": "sha512-LztvUgdwMNJMIkj3hQnnxiC2Xy1zNxq928W/xhjCLaNCzqTZOudjwbQf6v9IntZGPw132i2Lq2rgTRZHD3JHNw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@vitest/utils": "4.1.11",
        "pathe": "^2.0.3"
      },
      "funding": {
        "url": "https://opencollective.com/vitest"
      }
    },
    "node_modules/@vitest/snapshot": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@vitest/snapshot/-/snapshot-4.1.11.tgz",
      "integrity": "sha512-pN7ikn1ON7h8ee4gIAp4AzyK+zBtJPzVbqOgu5LCEh4VaJVbPQcgYQYJIMGQPXVeJJq1fnfazis7a5pFNPahog==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@vitest/pretty-format": "4.1.11",
        "@vitest/utils": "4.1.11",
        "magic-string": "^0.30.21",
        "pathe": "^2.0.3"
      },
      "funding": {
        "url": "https://opencollective.com/vitest"
      }
    },
    "node_modules/@vitest/spy": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@vitest/spy/-/spy-4.1.11.tgz",
      "integrity": "sha512-apNa/prQy2qCeywhnixOHPRCgGNhvg7T4Dapfl1GahLp/R+uhBm5cPyFoNVyqsNd2h1nJxL6BqqdIjiABL60YA==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://opencollective.com/vitest"
      }
    },
    "node_modules/@vitest/utils": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@vitest/utils/-/utils-4.1.11.tgz",
      "integrity": "sha512-zTCVGpyFsGWBhllOyKlTw/vnr6D9qxsfSDyfbyZmTyjHw5N/VuvzHpHoQjm2ZJzn4RJgx5w4r7V0er69CmLgPQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@vitest/pretty-format": "4.1.11",
        "convert-source-map": "^2.0.0",
        "tinyrainbow": "^3.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/vitest"
      }
    },
    "node_modules/@vladfrangu/async_event_emitter": {
      "version": "2.4.7",
      "resolved": "https://registry.npmjs.org/@vladfrangu/async_event_emitter/-/async_event_emitter-2.4.7.tgz",
      "integrity": "sha512-Xfe6rpCTxSxfbswi/W/Pz7zp1WWSNn4A0eW4mLkQUewCrXXtMj31lCg+iQyTkh/CkusZSq9eDflu7tjEDXUY6g==",
      "license": "MIT",
      "engines": {
        "node": ">=v14.0.0",
        "npm": ">=7.0.0"
      }
    },
    "node_modules/acorn": {
      "version": "8.19.0",
      "resolved": "https://registry.npmjs.org/acorn/-/acorn-8.19.0.tgz",
      "integrity": "sha512-oJlA3XiRm7Cyk6qFD2Jn8ak9B7jSy0qy00ADO3+8dpT0LSjFihQYv4C02LFCSYJV3Q37xYwwRy5m+IpIiUzqWw==",
      "dev": true,
      "license": "MIT",
      "peer": true,
      "bin": {
        "acorn": "bin/acorn"
      },
      "engines": {
        "node": ">=0.4.0"
      }
    },
    "node_modules/acorn-jsx": {
      "version": "5.3.2",
      "resolved": "https://registry.npmjs.org/acorn-jsx/-/acorn-jsx-5.3.2.tgz",
      "integrity": "sha512-rq9s+JNhf0IChjtDXxllJ7g41oZk5SlXtp0LHwyA5cejwn7vKmKp4pPri6YEePv2PU65sAsegbXtIinmDFDXgQ==",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "acorn": "^6.0.0 || ^7.0.0 || ^8.0.0"
      }
    },
    "node_modules/ajv": {
      "version": "6.15.0",
      "resolved": "https://registry.npmjs.org/ajv/-/ajv-6.15.0.tgz",
      "integrity": "sha512-fgFx7Hfoq60ytK2c7DhnF8jIvzYgOMxfugjLOSMHjLIPgenqa7S7oaagATUq99mV6IYvN2tRmC0wnTYX6iPbMw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fast-deep-equal": "^3.1.1",
        "fast-json-stable-stringify": "^2.0.0",
        "json-schema-traverse": "^0.4.1",
        "uri-js": "^4.2.2"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/epoberezkin"
      }
    },
    "node_modules/any-promise": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/any-promise/-/any-promise-1.3.0.tgz",
      "integrity": "sha512-7UvmKalWRt1wgjL1RrGxoSJW/0QZFIegpeGvZG9kjp8vrRu55XTHbwnqq2GpXm9uLbcuhxm3IqX9OB4MZR1b2A==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/assertion-error": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/assertion-error/-/assertion-error-2.0.1.tgz",
      "integrity": "sha512-Izi8RQcffqCeNVgFigKli1ssklIbpHnCYc6AknXGYoB6grJqyeby7jv12JUQgmTAnIDnbck1uxksT4dzN3PWBA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/atomic-sleep": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/atomic-sleep/-/atomic-sleep-1.0.0.tgz",
      "integrity": "sha512-kNOjDqAh7px0XWNI+4QbzoiR/nTkHAWNud2uvnJquD1/x5a7EQZMJT0AczqK0Qn67oY/TTQ1LbUKajZpp3I9tQ==",
      "license": "MIT",
      "engines": {
        "node": ">=8.0.0"
      }
    },
    "node_modules/balanced-match": {
      "version": "4.0.4",
      "resolved": "https://registry.npmjs.org/balanced-match/-/balanced-match-4.0.4.tgz",
      "integrity": "sha512-BLrgEcRTwX2o6gGxGOCNyMvGSp35YofuYzw9h1IMTRmKqttAZZVU67bdb9Pr2vUHA8+j3i2tJfjO6C6+4myGTA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "18 || 20 || >=22"
      }
    },
    "node_modules/base64-js": {
      "version": "1.5.1",
      "resolved": "https://registry.npmjs.org/base64-js/-/base64-js-1.5.1.tgz",
      "integrity": "sha512-AKpaYlHn8t4SVbOHCy+b5+KKgvR4vrsD8vbvrbiQJps7fKDTkjkDry6ji0rUJjC0kzbNePLwzxq8iypo41qeWA==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/better-sqlite3": {
      "version": "12.11.1",
      "resolved": "https://registry.npmjs.org/better-sqlite3/-/better-sqlite3-12.11.1.tgz",
      "integrity": "sha512-dq9AtApgg5PGFtBzPFSBl3HZQjHok5gaQCM6zh2Yk0aSmDCs1CbnVI8/HgASQkNKsWFpseIO9beg5xxpYhbIfA==",
      "hasInstallScript": true,
      "license": "MIT",
      "peer": true,
      "dependencies": {
        "bindings": "^1.5.0",
        "prebuild-install": "^7.1.1"
      },
      "engines": {
        "node": "20.x || 22.x || 23.x || 24.x || 25.x || 26.x"
      }
    },
    "node_modules/bindings": {
      "version": "1.5.0",
      "resolved": "https://registry.npmjs.org/bindings/-/bindings-1.5.0.tgz",
      "integrity": "sha512-p2q/t/mhvuOj/UeLlV6566GD/guowlr0hHxClI0W9m7MWYkL1F0hLo+0Aexs9HSPCtR1SXQ0TD3MMKrXZajbiQ==",
      "license": "MIT",
      "dependencies": {
        "file-uri-to-path": "1.0.0"
      }
    },
    "node_modules/bl": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/bl/-/bl-4.1.0.tgz",
      "integrity": "sha512-1W07cM9gS6DcLperZfFSj+bWLtaPGSOHWhPiGzXmvVJbRLdG82sH/Kn8EtW1VqWVA54AKf2h5k5BbnIbwF3h6w==",
      "license": "MIT",
      "dependencies": {
        "buffer": "^5.5.0",
        "inherits": "^2.0.4",
        "readable-stream": "^3.4.0"
      }
    },
    "node_modules/brace-expansion": {
      "version": "5.0.12",
      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "balanced-match": "^4.0.2"
      },
      "engines": {
        "node": "20 || >=22"
      }
    },
    "node_modules/buffer": {
      "version": "5.7.1",
      "resolved": "https://registry.npmjs.org/buffer/-/buffer-5.7.1.tgz",
      "integrity": "sha512-EHcyIPBQ4BSGlvjB16k5KgAJ27CIsHY/2JBmCRReo48y9rQ3MaUzWX3KVlBa4U7MyX02HdVj0K7C3WaB3ju7FQ==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "base64-js": "^1.3.1",
        "ieee754": "^1.1.13"
      }
    },
    "node_modules/buffer-from": {
      "version": "1.1.2",
      "resolved": "https://registry.npmjs.org/buffer-from/-/buffer-from-1.1.2.tgz",
      "integrity": "sha512-E+XQCRwSbaaiChtv6k6Dwgc+bx+Bs6vuKJHHl5kox/BaKbhiXzqQOwK4cO22yElGp2OCmjwVhT3HmxgyPGnJfQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/bundle-require": {
      "version": "5.1.0",
      "resolved": "https://registry.npmjs.org/bundle-require/-/bundle-require-5.1.0.tgz",
      "integrity": "sha512-3WrrOuZiyaaZPWiEt4G3+IffISVC9HYlWueJEBWED4ZH4aIAC2PnkdnuRrR94M+w6yGWn4AglWtJtBI8YqvgoA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "load-tsconfig": "^0.2.3"
      },
      "engines": {
        "node": "^12.20.0 || ^14.13.1 || >=16.0.0"
      },
      "peerDependencies": {
        "esbuild": ">=0.18"
      }
    },
    "node_modules/cac": {
      "version": "6.7.14",
      "resolved": "https://registry.npmjs.org/cac/-/cac-6.7.14.tgz",
      "integrity": "sha512-b6Ilus+c3RrdDk+JhLKUAQfzzgLEPy6wcXqS7f/xe1EETvsDP6GORG7SFuOs6cID5YkqchW/LXZbX5bc8j7ZcQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/cacheable": {
      "version": "2.5.0",
      "resolved": "https://registry.npmjs.org/cacheable/-/cacheable-2.5.0.tgz",
      "integrity": "sha512-60cyAOytib/OzBw1JNSoSV/boK1AtHryDIjvVBk7XbN4ugfkM3+Sry7fEjNgPMGgOjuaZPAp8ruZ0Cxafwyq9g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@cacheable/memory": "^2.2.0",
        "@cacheable/utils": "^2.5.0",
        "hookified": "^1.15.0",
        "keyv": "^5.6.0",
        "qified": "^0.10.1"
      }
    },
    "node_modules/chai": {
      "version": "6.3.0",
      "resolved": "https://registry.npmjs.org/chai/-/chai-6.3.0.tgz",
      "integrity": "sha512-XWAtwJ6OHO+tj0EKCs0Y2UamnyOxseZWltU4x2U2wh8g4AigdjwvtUjvLP2tqkA/avxHEtzxNaqGq/YGNwckKg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/chokidar": {
      "version": "4.0.3",
      "resolved": "https://registry.npmjs.org/chokidar/-/chokidar-4.0.3.tgz",
      "integrity": "sha512-Qgzu8kfBvo+cA4962jnP1KkS6Dop5NS6g7R5LFYJr4b8Ub94PPQXUksCw9PvXoeXPRRddRNC5C1JQUR2SMGtnA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "readdirp": "^4.0.1"
      },
      "engines": {
        "node": ">= 14.16.0"
      },
      "funding": {
        "url": "https://paulmillr.com/funding/"
      }
    },
    "node_modules/chownr": {
      "version": "1.1.4",
      "resolved": "https://registry.npmjs.org/chownr/-/chownr-1.1.4.tgz",
      "integrity": "sha512-jJ0bqzaylmJtVnNgzTeSOs8DPavpbYgEr/b0YL8/2GO3xJEhInFmhKMUnEJQjZumK7KXGFhUy89PrsJWlakBVg==",
      "license": "ISC"
    },
    "node_modules/cluster-key-slot": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/cluster-key-slot/-/cluster-key-slot-1.1.1.tgz",
      "integrity": "sha512-rwHwUfXL40Chm1r08yrhU3qpUvdVlgkKNeyeGPOxnW8/SyVDvgRaed/Uz54AqWNaTCAThlj6QAs3TZcKI0xDEw==",
      "license": "Apache-2.0",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/colorette": {
      "version": "2.0.20",
      "resolved": "https://registry.npmjs.org/colorette/-/colorette-2.0.20.tgz",
      "integrity": "sha512-IfEDxwoWIjkeXL1eXcDiow4UbKjhLdq6/EuSVR9GMN7KVH3r9gQ83e73hsz1Nd1T3ijd5xv1wcWRYO+D6kCI2w==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/commander": {
      "version": "4.1.1",
      "resolved": "https://registry.npmjs.org/commander/-/commander-4.1.1.tgz",
      "integrity": "sha512-NOKm8xhkzAjzFx8B2v5OAHT+u5pRQc2UCa2Vq9jYL/31o2wi9mxBA7LIFs3sV5VSC49z6pEhfbMULvShKj26WA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/confbox": {
      "version": "0.1.8",
      "resolved": "https://registry.npmjs.org/confbox/-/confbox-0.1.8.tgz",
      "integrity": "sha512-RMtmw0iFkeR4YV+fUOSucriAQNb9g8zFR52MWCtl+cCZOFRNL6zeB395vPzFhEjjn4fMxXudmELnl/KF/WrK6w==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/consola": {
      "version": "3.4.2",
      "resolved": "https://registry.npmjs.org/consola/-/consola-3.4.2.tgz",
      "integrity": "sha512-5IKcdX0nnYavi6G7TtOhwkYzyjfJlatbjMjuLSfE2kYT5pMDOilZ4OvMhi637CcDICTmz3wARPoyhqyX1Y+XvA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^14.18.0 || >=16.10.0"
      }
    },
    "node_modules/convert-source-map": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/convert-source-map/-/convert-source-map-2.0.0.tgz",
      "integrity": "sha512-Kvp459HrV2FEJ1CAsi1Ku+MY3kasH19TFykTz2xWmMeq6bk2NU3XXvfJ+Q61m0xktWwt+1HSYf3JZsTms3aRJg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/cross-spawn": {
      "version": "7.0.6",
      "resolved": "https://registry.npmjs.org/cross-spawn/-/cross-spawn-7.0.6.tgz",
      "integrity": "sha512-uV2QOWP2nWzsy2aMp8aRibhi9dlzF5Hgh5SHaB9OiTGEyDTiJJyx0uy51QXdyWbtAHNua4XJzUKca3OzKUd3vA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "path-key": "^3.1.0",
        "shebang-command": "^2.0.0",
        "which": "^2.0.1"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/dateformat": {
      "version": "4.6.3",
      "resolved": "https://registry.npmjs.org/dateformat/-/dateformat-4.6.3.tgz",
      "integrity": "sha512-2P0p0pFGzHS5EMnhdxQi7aJN+iMheud0UhG4dlE1DLAlvL8JHjJJTX/CSm4JXwV0Ka5nGk3zC5mcb5bUQUxxMA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "*"
      }
    },
    "node_modules/debug": {
      "version": "4.4.3",
      "resolved": "https://registry.npmjs.org/debug/-/debug-4.4.3.tgz",
      "integrity": "sha512-RGwwWnwQvkVfavKVt22FGLw+xYSdzARwm0ru6DhTVA3umU5hZc28V3kO4stgYryrTlLpuvgI9GiijltAjNbcqA==",
      "license": "MIT",
      "dependencies": {
        "ms": "^2.1.3"
      },
      "engines": {
        "node": ">=6.0"
      },
      "peerDependenciesMeta": {
        "supports-color": {
          "optional": true
        }
      }
    },
    "node_modules/decompress-response": {
      "version": "6.0.0",
      "resolved": "https://registry.npmjs.org/decompress-response/-/decompress-response-6.0.0.tgz",
      "integrity": "sha512-aW35yZM6Bb/4oJlZncMH2LCoZtJXTRxES17vE3hoRiowU2kWHaJKFkSBDnDR+cm9J+9QhXmREyIfv0pji9ejCQ==",
      "license": "MIT",
      "dependencies": {
        "mimic-response": "^3.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/deep-extend": {
      "version": "0.6.0",
      "resolved": "https://registry.npmjs.org/deep-extend/-/deep-extend-0.6.0.tgz",
      "integrity": "sha512-LOHxIOaPYdHlJRtCQfDIVZtfw/ufM8+rVj649RIHzcm/vGwQRXFt6OPqIFWsm2XEMrNIEtWR64sY1LEKD2vAOA==",
      "license": "MIT",
      "engines": {
        "node": ">=4.0.0"
      }
    },
    "node_modules/deep-is": {
      "version": "0.1.4",
      "resolved": "https://registry.npmjs.org/deep-is/-/deep-is-0.1.4.tgz",
      "integrity": "sha512-oIPzksmTg4/MriiaYGO+okXDT7ztn/w3Eptv/+gSIdMdKsJo0u4CfYNFJPy+4SKMuCqGw2wxnA+URMg3t8a/bQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/denque": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/denque/-/denque-2.1.0.tgz",
      "integrity": "sha512-HVQE3AAb/pxF8fQAoiqpvg9i3evqug3hoiwakOyZAwJm+6vZehbkYXZ0l4JxS+I3QxM97v5aaRNhj8v5oBhekw==",
      "license": "Apache-2.0",
      "engines": {
        "node": ">=0.10"
      }
    },
    "node_modules/detect-libc": {
      "version": "2.1.2",
      "resolved": "https://registry.npmjs.org/detect-libc/-/detect-libc-2.1.2.tgz",
      "integrity": "sha512-Btj2BOOO83o3WyH59e8MgXsxEQVcarkUOpEYrubB0urwnN10yQ364rsiByU11nZlqWYZm05i/of7io4mzihBtQ==",
      "license": "Apache-2.0",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/discord-api-types": {
      "version": "0.38.56",
      "resolved": "https://registry.npmjs.org/discord-api-types/-/discord-api-types-0.38.56.tgz",
      "integrity": "sha512-Hti4RZsGvF5C7SM8rF2MDHtIm0Hyfrlk84GpEA29nj91tvVVMvX+oQSCodu10t2ZcjFGofq8TX0YyC04B2E69Q==",
      "license": "MIT"
    },
    "node_modules/discord.js": {
      "version": "14.27.0",
      "resolved": "https://registry.npmjs.org/discord.js/-/discord.js-14.27.0.tgz",
      "integrity": "sha512-qHbFlFG2N7y3LjPySYsL6A1+BnX6bkTVgo842EX0CqVPk/KTMwZkojPHEXKsQUpWZNyz5BISNHK1cPpQw0+m4A==",
      "license": "Apache-2.0",
      "dependencies": {
        "@discordjs/builders": "^1.14.1",
        "@discordjs/collection": "1.5.3",
        "@discordjs/formatters": "^0.6.2",
        "@discordjs/rest": "^2.6.2",
        "@discordjs/util": "^1.2.0",
        "@discordjs/ws": "^1.2.3",
        "@sapphire/snowflake": "3.5.5",
        "discord-api-types": "^0.38.49",
        "fast-deep-equal": "3.1.3",
        "lodash.snakecase": "4.1.1",
        "magic-bytes.js": "^1.13.0",
        "tslib": "^2.6.3",
        "undici": "^6.27.0"
      },
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/discordjs/discord.js?sponsor"
      }
    },
    "node_modules/dotenv": {
      "version": "18.0.7",
      "resolved": "https://registry.npmjs.org/dotenv/-/dotenv-18.0.7.tgz",
      "integrity": "sha512-QEvMEF8ca3GNZJJnAbOgxpj5ULhBvnMcURp+XKrtvqFNPgjBvYoswQ0Jl2cO7JzCjxZjJhr9ZuIEhlrRxMft/Q==",
      "license": "BSD-2-Clause",
      "bin": {
        "dotenv": "dist/index.cjs"
      },
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://dotenvx.com"
      }
    },
    "node_modules/drizzle-kit": {
      "version": "0.31.11",
      "resolved": "https://registry.npmjs.org/drizzle-kit/-/drizzle-kit-0.31.11.tgz",
      "integrity": "sha512-YCYqxTLIB2OCqf6w9/Vef13baBVbwQIPcbT4Y56AfO6B9ajZhDhD8Jkveg/hJvT/iuMloKD/IYYkyMMNhr7Kqg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@drizzle-team/brocli": "^0.10.2",
        "@esbuild-kit/esm-loader": "^2.5.5",
        "esbuild": "^0.25.4",
        "tsx": "^4.21.0"
      },
      "bin": {
        "drizzle-kit": "bin.cjs"
      }
    },
    "node_modules/drizzle-orm": {
      "version": "0.45.4",
      "resolved": "https://registry.npmjs.org/drizzle-orm/-/drizzle-orm-0.45.4.tgz",
      "integrity": "sha512-NiM1YZpJ2UxyeE67DpDDZ+Tsw4YLX3trSlkNT7Tm9eKoUNb1LvaAaQzXgYQsWs+AQ9TUmmwMmBOCXuqqxUWKKQ==",
      "license": "Apache-2.0",
      "peerDependencies": {
        "@aws-sdk/client-rds-data": ">=3",
        "@cloudflare/workers-types": ">=4",
        "@electric-sql/pglite": ">=0.2.0",
        "@libsql/client": ">=0.10.0",
        "@libsql/client-wasm": ">=0.10.0",
        "@neondatabase/serverless": ">=0.10.0",
        "@netlify/db": ">=0.4.0",
        "@op-engineering/op-sqlite": ">=2",
        "@opentelemetry/api": "^1.4.1",
        "@planetscale/database": ">=1.13",
        "@prisma/client": "*",
        "@tidbcloud/serverless": "*",
        "@types/better-sqlite3": "*",
        "@types/pg": "*",
        "@types/sql.js": "*",
        "@upstash/redis": ">=1.34.7",
        "@vercel/postgres": ">=0.8.0",
        "@xata.io/client": "*",
        "better-sqlite3": ">=7",
        "bun-types": "*",
        "expo-sqlite": ">=14.0.0",
        "gel": ">=2",
        "knex": "*",
        "kysely": "*",
        "mysql2": ">=2",
        "pg": ">=8",
        "postgres": ">=3",
        "sql.js": ">=1",
        "sqlite3": ">=5"
      },
      "peerDependenciesMeta": {
        "@aws-sdk/client-rds-data": {
          "optional": true
        },
        "@cloudflare/workers-types": {
          "optional": true
        },
        "@electric-sql/pglite": {
          "optional": true
        },
        "@libsql/client": {
          "optional": true
        },
        "@libsql/client-wasm": {
          "optional": true
        },
        "@neondatabase/serverless": {
          "optional": true
        },
        "@netlify/db": {
          "optional": true
        },
        "@op-engineering/op-sqlite": {
          "optional": true
        },
        "@opentelemetry/api": {
          "optional": true
        },
        "@planetscale/database": {
          "optional": true
        },
        "@prisma/client": {
          "optional": true
        },
        "@tidbcloud/serverless": {
          "optional": true
        },
        "@types/better-sqlite3": {
          "optional": true
        },
        "@types/pg": {
          "optional": true
        },
        "@types/sql.js": {
          "optional": true
        },
        "@upstash/redis": {
          "optional": true
        },
        "@vercel/postgres": {
          "optional": true
        },
        "@xata.io/client": {
          "optional": true
        },
        "better-sqlite3": {
          "optional": true
        },
        "bun-types": {
          "optional": true
        },
        "expo-sqlite": {
          "optional": true
        },
        "gel": {
          "optional": true
        },
        "knex": {
          "optional": true
        },
        "kysely": {
          "optional": true
        },
        "mysql2": {
          "optional": true
        },
        "pg": {
          "optional": true
        },
        "postgres": {
          "optional": true
        },
        "prisma": {
          "optional": true
        },
        "sql.js": {
          "optional": true
        },
        "sqlite3": {
          "optional": true
        }
      }
    },
    "node_modules/end-of-stream": {
      "version": "1.4.5",
      "resolved": "https://registry.npmjs.org/end-of-stream/-/end-of-stream-1.4.5.tgz",
      "integrity": "sha512-ooEGc6HP26xXq/N+GCGOT0JKCLDGrq2bQUZrQ7gyrJiZANJ/8YDTxTpQBXGMn+WbIQXNVpyWymm7KYVICQnyOg==",
      "license": "MIT",
      "dependencies": {
        "once": "^1.4.0"
      }
    },
    "node_modules/es-module-lexer": {
      "version": "2.3.2",
      "resolved": "https://registry.npmjs.org/es-module-lexer/-/es-module-lexer-2.3.2.tgz",
      "integrity": "sha512-poHGpORABojJJucnV9KbOavETW8lBVnphkW77ER5/BQ5Fz7oXSoCNek7IH3vR5nRjdsEz926ibFYX8KtLQmdyw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/esbuild": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/esbuild/-/esbuild-0.28.2.tgz",
      "integrity": "sha512-HKVLS8dvII+xoKW9kmqxbRKrnWEXfJJr/FZhhJmiqIB0e053QNYFqOBouTMO/k5sID4MvCiUCvv8b9M4h32wIA==",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "peer": true,
      "bin": {
        "esbuild": "bin/esbuild"
      },
      "engines": {
        "node": ">=18"
      },
      "optionalDependencies": {
        "@esbuild/aix-ppc64": "0.28.2",
        "@esbuild/android-arm": "0.28.2",
        "@esbuild/android-arm64": "0.28.2",
        "@esbuild/android-x64": "0.28.2",
        "@esbuild/darwin-arm64": "0.28.2",
        "@esbuild/darwin-x64": "0.28.2",
        "@esbuild/freebsd-arm64": "0.28.2",
        "@esbuild/freebsd-x64": "0.28.2",
        "@esbuild/linux-arm": "0.28.2",
        "@esbuild/linux-arm64": "0.28.2",
        "@esbuild/linux-ia32": "0.28.2",
        "@esbuild/linux-loong64": "0.28.2",
        "@esbuild/linux-mips64el": "0.28.2",
        "@esbuild/linux-ppc64": "0.28.2",
        "@esbuild/linux-riscv64": "0.28.2",
        "@esbuild/linux-s390x": "0.28.2",
        "@esbuild/linux-x64": "0.28.2",
        "@esbuild/netbsd-arm64": "0.28.2",
        "@esbuild/netbsd-x64": "0.28.2",
        "@esbuild/openbsd-arm64": "0.28.2",
        "@esbuild/openbsd-x64": "0.28.2",
        "@esbuild/openharmony-arm64": "0.28.2",
        "@esbuild/sunos-x64": "0.28.2",
        "@esbuild/win32-arm64": "0.28.2",
        "@esbuild/win32-ia32": "0.28.2",
        "@esbuild/win32-x64": "0.28.2"
      }
    },
    "node_modules/escape-string-regexp": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/escape-string-regexp/-/escape-string-regexp-4.0.0.tgz",
      "integrity": "sha512-TtpcNJ3XAzx3Gq8sWRzJaVajRs0uVxA2YAkdb1jm2YkPz4G6egUFAyA3n5vtEIZefPk5Wa4UXbKuS5fKkJWdgA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/eslint": {
      "version": "10.12.0",
      "resolved": "https://registry.npmjs.org/eslint/-/eslint-10.12.0.tgz",
      "integrity": "sha512-npHjrHb2o4ehH3mE+YuxABR+0gyb0aVWCIolgJDArwCiHEIsonBm3ZKjel5b0U5+a+MbEvIyRCGCzD3eKKK2NA==",
      "dev": true,
      "license": "MIT",
      "peer": true,
      "workspaces": [
        "packages/*"
      ],
      "dependencies": {
        "@eslint-community/eslint-utils": "^4.8.0",
        "@eslint-community/regexpp": "^4.12.2",
        "@eslint/config-array": "^0.23.5",
        "@eslint/config-helpers": "^0.7.0",
        "@eslint/core": "^1.2.1",
        "@eslint/plugin-kit": "^0.7.3",
        "@humanfs/node": "^0.16.6",
        "@humanwhocodes/module-importer": "^1.0.1",
        "@humanwhocodes/retry": "^0.4.2",
        "@types/estree": "^1.0.6",
        "ajv": "^6.14.0",
        "cross-spawn": "^7.0.6",
        "debug": "^4.3.2",
        "escape-string-regexp": "^4.0.0",
        "eslint-scope": "^9.1.2",
        "eslint-visitor-keys": "^5.0.1",
        "espree": "^11.2.0",
        "esquery": "^1.7.0",
        "esutils": "^2.0.2",
        "fast-deep-equal": "^3.1.3",
        "file-entry-cache": "11.1.5 || >11.1.6 <12",
        "find-up": "^5.0.0",
        "glob-parent": "^6.0.2",
        "ignore": "^5.2.0",
        "imurmurhash": "^0.1.4",
        "is-glob": "^4.0.0",
        "json-stable-stringify-without-jsonify": "^1.0.1",
        "minimatch": "^10.2.5",
        "natural-compare": "^1.4.0",
        "optionator": "^0.9.3"
      },
      "bin": {
        "eslint": "bin/eslint.js"
      },
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      },
      "funding": {
        "url": "https://eslint.org/donate"
      },
      "peerDependencies": {
        "jiti": "*"
      },
      "peerDependenciesMeta": {
        "jiti": {
          "optional": true
        }
      }
    },
    "node_modules/eslint-scope": {
      "version": "9.1.2",
      "resolved": "https://registry.npmjs.org/eslint-scope/-/eslint-scope-9.1.2.tgz",
      "integrity": "sha512-xS90H51cKw0jltxmvmHy2Iai1LIqrfbw57b79w/J7MfvDfkIkFZ+kj6zC3BjtUwh150HsSSdxXZcsuv72miDFQ==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "@types/esrecurse": "^4.3.1",
        "@types/estree": "^1.0.8",
        "esrecurse": "^4.3.0",
        "estraverse": "^5.2.0"
      },
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/eslint-visitor-keys": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/eslint-visitor-keys/-/eslint-visitor-keys-5.0.1.tgz",
      "integrity": "sha512-tD40eHxA35h0PEIZNeIjkHoDR4YjjJp34biM0mDvplBe//mB+IHCqHDGV7pxF+7MklTvighcCPPZC7ynWyjdTA==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/espree": {
      "version": "11.2.0",
      "resolved": "https://registry.npmjs.org/espree/-/espree-11.2.0.tgz",
      "integrity": "sha512-7p3DrVEIopW1B1avAGLuCSh1jubc01H2JHc8B4qqGblmg5gI9yumBgACjWo4JlIc04ufug4xJ3SQI8HkS/Rgzw==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "acorn": "^8.16.0",
        "acorn-jsx": "^5.3.2",
        "eslint-visitor-keys": "^5.0.1"
      },
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/esquery": {
      "version": "1.7.0",
      "resolved": "https://registry.npmjs.org/esquery/-/esquery-1.7.0.tgz",
      "integrity": "sha512-Ap6G0WQwcU/LHsvLwON1fAQX9Zp0A2Y6Y/cJBl9r/JbW90Zyg4/zbG6zzKa2OTALELarYHmKu0GhpM5EO+7T0g==",
      "dev": true,
      "license": "BSD-3-Clause",
      "dependencies": {
        "estraverse": "^5.1.0"
      },
      "engines": {
        "node": ">=0.10"
      }
    },
    "node_modules/esrecurse": {
      "version": "4.3.0",
      "resolved": "https://registry.npmjs.org/esrecurse/-/esrecurse-4.3.0.tgz",
      "integrity": "sha512-KmfKL3b6G+RXvP8N1vr3Tq1kL/oCFgn2NYXEtqP8/L3pKapUA4G8cFVaoF3SU323CD4XypR/ffioHmkti6/Tag==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "estraverse": "^5.2.0"
      },
      "engines": {
        "node": ">=4.0"
      }
    },
    "node_modules/estraverse": {
      "version": "5.3.0",
      "resolved": "https://registry.npmjs.org/estraverse/-/estraverse-5.3.0.tgz",
      "integrity": "sha512-MMdARuVEQziNTeJD8DgMqmhwR11BRQ/cBP+pLtYdSTnf3MIO8fFeiINEbX36ZdNlfU/7A9f3gUw49B3oQsvwBA==",
      "dev": true,
      "license": "BSD-2-Clause",
      "engines": {
        "node": ">=4.0"
      }
    },
    "node_modules/estree-walker": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/estree-walker/-/estree-walker-3.0.3.tgz",
      "integrity": "sha512-7RUKfXgSMMkzt6ZuXmqapOurLGPPfgj6l9uRZ7lRGolvk0y2yocc35LdcxKC5PQZdn2DMqioAQ2NoWcrTKmm6g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@types/estree": "^1.0.0"
      }
    },
    "node_modules/esutils": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/esutils/-/esutils-2.0.3.tgz",
      "integrity": "sha512-kVscqXk4OCp68SZ0dkgEKVi6/8ij300KBWTJq32P/dYeWTSwK41WyTxalN1eRmA5Z9UU/LX9D7FWSmV9SAYx6g==",
      "dev": true,
      "license": "BSD-2-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/expand-template": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/expand-template/-/expand-template-2.0.3.tgz",
      "integrity": "sha512-XYfuKMvj4O35f/pOXLObndIRvyQ+/+6AhODh+OKWj9S9498pHHn/IMszH+gt0fBCRWMNfk1ZSp5x3AifmnI2vg==",
      "license": "(MIT OR WTFPL)",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/expect-type": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/expect-type/-/expect-type-1.4.0.tgz",
      "integrity": "sha512-KfYbmpRm0VbLjEvVa9yGwCi9GI34xvi7A/HXYWQO65CSD2u3MczUJSuwXKFIxlGsgBQizV9q5J9NHj4VG0n+pA==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=12.0.0"
      }
    },
    "node_modules/fast-copy": {
      "version": "4.1.2",
      "resolved": "https://registry.npmjs.org/fast-copy/-/fast-copy-4.1.2.tgz",
      "integrity": "sha512-DUHggaYcouhy5I1LacDJ+JDSqGlumVJP2EAi5Nwt1pWPeLpSvIjkrY+x4fsoI1/+GlTyq+DM9zdgWCFSfqNODA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fast-deep-equal": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/fast-deep-equal/-/fast-deep-equal-3.1.3.tgz",
      "integrity": "sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q==",
      "license": "MIT"
    },
    "node_modules/fast-json-stable-stringify": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/fast-json-stable-stringify/-/fast-json-stable-stringify-2.1.0.tgz",
      "integrity": "sha512-lhd/wF+Lk98HZoTCtlVraHtfh5XYijIjalXck7saUtuanSDyLMxnHhSXEDJqHxD7msR8D0uCmqlkwjCV8xvwHw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fast-levenshtein": {
      "version": "2.0.6",
      "resolved": "https://registry.npmjs.org/fast-levenshtein/-/fast-levenshtein-2.0.6.tgz",
      "integrity": "sha512-DCXu6Ifhqcks7TZKY3Hxp3y6qphY5SJZmrWMDrKcERSOXWQdMhU9Ig/PYrzyw/ul9jOIyh0N4M0tbC5hodg8dw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fast-safe-stringify": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/fast-safe-stringify/-/fast-safe-stringify-2.1.1.tgz",
      "integrity": "sha512-W+KJc2dmILlPplD/H4K9l9LcAHAfPtP6BY84uVLXQ6Evcz9Lcg33Y2z1IVblT6xdY54PXYVHEv+0Wpq8Io6zkA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fdir": {
      "version": "6.5.0",
      "resolved": "https://registry.npmjs.org/fdir/-/fdir-6.5.0.tgz",
      "integrity": "sha512-tIbYtZbucOs0BRGqPJkshJUYdL+SDH7dVM8gjy+ERp3WAUjLEFJE+02kanyHtwjWOnwrKYBiwAmM0p4kLJAnXg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12.0.0"
      },
      "peerDependencies": {
        "picomatch": "^3 || ^4"
      },
      "peerDependenciesMeta": {
        "picomatch": {
          "optional": true
        }
      }
    },
    "node_modules/file-entry-cache": {
      "version": "11.1.5",
      "resolved": "https://registry.npmjs.org/file-entry-cache/-/file-entry-cache-11.1.5.tgz",
      "integrity": "sha512-+PFTHITI08JIGhnNpGNI8T8inUpgZfk3GNEqfT9R2zZV2iFXg3CvqzSl/uEhs7TSGujYRELEANyDvS8Fj7+S7Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "flat-cache": "^6.1.23"
      }
    },
    "node_modules/file-uri-to-path": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/file-uri-to-path/-/file-uri-to-path-1.0.0.tgz",
      "integrity": "sha512-0Zt+s3L7Vf1biwWZ29aARiVYLx7iMGnEUl9x33fbB/j3jR81u/O2LbqK+Bm1CDSNDKVtJ/YjwY7TUd5SkeLQLw==",
      "license": "MIT"
    },
    "node_modules/find-up": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/find-up/-/find-up-5.0.0.tgz",
      "integrity": "sha512-78/PXT1wlLLDgTzDs7sjq9hzz0vXD+zn+7wypEe4fXQxCmdmqfGsEPQxmiCSQI3ajFV91bVSsvNtrJRiW6nGng==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "locate-path": "^6.0.0",
        "path-exists": "^4.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/fix-dts-default-cjs-exports": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/fix-dts-default-cjs-exports/-/fix-dts-default-cjs-exports-1.0.1.tgz",
      "integrity": "sha512-pVIECanWFC61Hzl2+oOCtoJ3F17kglZC/6N94eRWycFgBH35hHx0Li604ZIzhseh97mf2p0cv7vVrOZGoqhlEg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "magic-string": "^0.30.17",
        "mlly": "^1.7.4",
        "rollup": "^4.34.8"
      }
    },
    "node_modules/flat-cache": {
      "version": "6.1.23",
      "resolved": "https://registry.npmjs.org/flat-cache/-/flat-cache-6.1.23.tgz",
      "integrity": "sha512-f++BY9pTk+983xK1FLzlLpmM0i0z+jHmx3QESGkURMXujQZz1k5wzwX6hjnQ8goaD0B+sYnDK1yZ6MTyZfUaqA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "cacheable": "^2.5.0",
        "flatted": "^3.4.2",
        "hookified": "^1.15.0"
      }
    },
    "node_modules/flatted": {
      "version": "3.4.4",
      "resolved": "https://registry.npmjs.org/flatted/-/flatted-3.4.4.tgz",
      "integrity": "sha512-5+ybhBZANEJxaH3X5evAFatUxLfEHSr7n6kYJ+1Qd0mUqr4eu9gIf6GDbWHf8RJijHrjjO8G+la14SlL2SeS1Q==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/fs-constants": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/fs-constants/-/fs-constants-1.0.0.tgz",
      "integrity": "sha512-y6OAwoSIf7FyjMIv94u+b5rdheZEjzR63GTyZJm5qh4Bi+2YgwLCcI/fPFZkL5PSixOt6ZNKm+w+Hfp/Bciwow==",
      "license": "MIT"
    },
    "node_modules/fsevents": {
      "version": "2.3.3",
      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
      "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
      }
    },
    "node_modules/get-tsconfig": {
      "version": "4.14.3",
      "resolved": "https://registry.npmjs.org/get-tsconfig/-/get-tsconfig-4.14.3.tgz",
      "integrity": "sha512-++QEw4DIY7WGoukz+/+A/8dGYPT9l9yIadnmSgZ8Rjr3YVSVDipQSO9CdnJo9ePqFqUUqh+wk9uIaoiAwsiPkA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "resolve-pkg-maps": "^1.0.0"
      },
      "funding": {
        "url": "https://github.com/privatenumber/get-tsconfig?sponsor=1"
      }
    },
    "node_modules/github-from-package": {
      "version": "0.0.0",
      "resolved": "https://registry.npmjs.org/github-from-package/-/github-from-package-0.0.0.tgz",
      "integrity": "sha512-SyHy3T1v2NUXn29OsWdxmK6RwHD+vkj3v8en8AOBZ1wBQ/hCAQ5bAQTD02kW4W9tUp/3Qh6J8r9EvntiyCmOOw==",
      "license": "MIT"
    },
    "node_modules/glob-parent": {
      "version": "6.0.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-6.0.2.tgz",
      "integrity": "sha512-XxwI8EOhVQgWp6iDL+3b0r86f4d6AX6zSU55HfB4ydCEuXLXc5FcYeOu+nnGftS4TEju/11rt4KJPTMgbfmv4A==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.3"
      },
      "engines": {
        "node": ">=10.13.0"
      }
    },
    "node_modules/globals": {
      "version": "17.13.0",
      "resolved": "https://registry.npmjs.org/globals/-/globals-17.13.0.tgz",
      "integrity": "sha512-RwMTC61u7hrG3ZJMkZQOK4JLJrKS8QtoTii63EmWvFXHqycY9FObBJQCbsLxSO8kjKhWE5kV1GC+Vb1g3RI0Zg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/hashery": {
      "version": "1.5.1",
      "resolved": "https://registry.npmjs.org/hashery/-/hashery-1.5.1.tgz",
      "integrity": "sha512-iZyKG96/JwPz1N55vj2Ie2vXbhu440zfUfJvSwEqEbeLluk7NnapfGqa7LH0mOsnDxTF85Mx8/dyR6HfqcbmbQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hookified": "^1.15.0"
      },
      "engines": {
        "node": ">=20"
      }
    },
    "node_modules/help-me": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/help-me/-/help-me-5.0.0.tgz",
      "integrity": "sha512-7xgomUX6ADmcYzFik0HzAxh/73YlKR9bmFzf51CZwR+b6YtzU2m0u49hQCqV6SvlqIqsaxovfwdvbnsw3b/zpg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/hookified": {
      "version": "1.15.1",
      "resolved": "https://registry.npmjs.org/hookified/-/hookified-1.15.1.tgz",
      "integrity": "sha512-MvG/clsADq1GPM2KGo2nyfaWVyn9naPiXrqIe4jYjXNZQt238kWyOGrsyc/DmRAQ+Re6yeo6yX/yoNCG5KAEVg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/ieee754": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/ieee754/-/ieee754-1.2.1.tgz",
      "integrity": "sha512-dcyqhDvX1C46lXZcVqCpK+FtMRQVdIMN6/Df5js2zouUsqG7I6sFxitIC+7KYK29KdXOLHdu9zL4sFnoVQnqaA==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "BSD-3-Clause"
    },
    "node_modules/ignore": {
      "version": "5.3.2",
      "resolved": "https://registry.npmjs.org/ignore/-/ignore-5.3.2.tgz",
      "integrity": "sha512-hsBTNUqQTDwkWtcdYI2i06Y/nUBEsNEDJKjWdigLvegy8kDuJAS8uRlpkkcQpyEXL0Z/pjDy5HBmMjRCJ2gq+g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 4"
      }
    },
    "node_modules/imurmurhash": {
      "version": "0.1.4",
      "resolved": "https://registry.npmjs.org/imurmurhash/-/imurmurhash-0.1.4.tgz",
      "integrity": "sha512-JmXMZ6wuvDmLiHEml9ykzqO6lwFbof0GG4IkcGaENdCRDDmMVnny7s5HsIgHCbaq0w2MyPhDqkhTUgS2LU2PHA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.8.19"
      }
    },
    "node_modules/inherits": {
      "version": "2.0.4",
      "resolved": "https://registry.npmjs.org/inherits/-/inherits-2.0.4.tgz",
      "integrity": "sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ==",
      "license": "ISC"
    },
    "node_modules/ini": {
      "version": "1.3.8",
      "resolved": "https://registry.npmjs.org/ini/-/ini-1.3.8.tgz",
      "integrity": "sha512-JV/yugV2uzW5iMRSiZAyDtQd+nxtUnjeLt0acNdw98kKLrvuRVyB80tsREOE7yvGVgalhZ6RNXCmEHkUKBKxew==",
      "license": "ISC"
    },
    "node_modules/ioredis": {
      "version": "6.0.0",
      "resolved": "https://registry.npmjs.org/ioredis/-/ioredis-6.0.0.tgz",
      "integrity": "sha512-f+Dtubxfpf6KYFq7WVXJoOLn0bk4TJrMrN9SzeE+jrWrCWj7XX3fA6vkryafhADX+GMymRxgDJDOI33COkJc0w==",
      "license": "MIT",
      "dependencies": {
        "@ioredis/commands": "2.0.0",
        "cluster-key-slot": "1.1.1",
        "debug": "4.4.3",
        "denque": "2.1.0",
        "redis-errors": "1.2.0",
        "standard-as-callback": "2.1.0"
      },
      "engines": {
        "node": ">=20.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/ioredis"
      }
    },
    "node_modules/ipaddr.js": {
      "version": "2.5.0",
      "resolved": "https://registry.npmjs.org/ipaddr.js/-/ipaddr.js-2.5.0.tgz",
      "integrity": "sha512-aq+t5NAc+cS6rZQQVWC2x98CPqGtKKTMDd4Gaodv0wShnItdKg/51djkGJ1hqH+Oy0ivDftCbSLCQob8zso01w==",
      "license": "MIT",
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/is-extglob": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/is-extglob/-/is-extglob-2.1.1.tgz",
      "integrity": "sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-glob": {
      "version": "4.0.3",
      "resolved": "https://registry.npmjs.org/is-glob/-/is-glob-4.0.3.tgz",
      "integrity": "sha512-xelSayHH36ZgE7ZWhli7pW34hNbNl8Ojv5KVmkJD4hBdD3th8Tfk9vYasLM+mXWOZhFkgZfxhLSnrwRr4elSSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-extglob": "^2.1.1"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/isexe": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/isexe/-/isexe-2.0.0.tgz",
      "integrity": "sha512-RHxMLp9lnKHGHRng9QFhRCMbYAcVpn69smSGcq3f36xjgVVWThj4qqLbTLlq7Ssj8B+fIQ1EuCEGI2lKsyQeIw==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/joycon": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/joycon/-/joycon-3.1.1.tgz",
      "integrity": "sha512-34wB/Y7MW7bzjKRjUKTa46I2Z7eV62Rkhva+KkopW7Qvv/OSWBqvkSY7vusOPrNuZcUG3tApvdVgNB8POj3SPw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/json-schema-traverse": {
      "version": "0.4.1",
      "resolved": "https://registry.npmjs.org/json-schema-traverse/-/json-schema-traverse-0.4.1.tgz",
      "integrity": "sha512-xbbCH5dCYU5T8LcEhhuh7HJ88HXuW3qsI3Y0zOZFKfZEHcpWiHU/Jxzk629Brsab/mMiHQti9wMP+845RPe3Vg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/json-stable-stringify-without-jsonify": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/json-stable-stringify-without-jsonify/-/json-stable-stringify-without-jsonify-1.0.1.tgz",
      "integrity": "sha512-Bdboy+l7tA3OGW6FjyFHWkP5LuByj1Tk33Ljyq0axyzdk9//JSi2u3fP1QSmd1KNwq6VOKYGlAu87CisVir6Pw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/keyv": {
      "version": "5.6.0",
      "resolved": "https://registry.npmjs.org/keyv/-/keyv-5.6.0.tgz",
      "integrity": "sha512-CYDD3SOtsHtyXeEORYRx2qBtpDJFjRTGXUtmNEMGyzYOKj1TE3tycdlho7kA1Ufx9OYWZzg52QFBGALTirzDSw==",
      "dev": true,
      "license": "MIT",
      "peer": true,
      "dependencies": {
        "@keyv/serialize": "^1.1.1"
      }
    },
    "node_modules/lavalink-client": {
      "version": "2.11.0",
      "resolved": "https://registry.npmjs.org/lavalink-client/-/lavalink-client-2.11.0.tgz",
      "integrity": "sha512-x4mobBpwSjJ+jC2XDevcMc8Mj454Bx3cTfmWgtLHisY+U/HlK7ubWkdHawZrEwBW5E6zIDjoiBvVBR8FDIUdkw==",
      "license": "MIT",
      "dependencies": {
        "tslib": "^2.8.1",
        "ws": "^8.21.3"
      },
      "engines": {
        "bun": ">=1.1.27",
        "node": ">=18.0.0"
      }
    },
    "node_modules/levn": {
      "version": "0.4.1",
      "resolved": "https://registry.npmjs.org/levn/-/levn-0.4.1.tgz",
      "integrity": "sha512-+bT2uH4E5LGE7h/n3evcS/sQlJXCpIp6ym8OWJ5eV6+67Dsql/LaaT7qJBAt2rzfoa/5QBGBhxDix1dMt2kQKQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "prelude-ls": "^1.2.1",
        "type-check": "~0.4.0"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/lilconfig": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/lilconfig/-/lilconfig-3.1.3.tgz",
      "integrity": "sha512-/vlFKAoH5Cgt3Ie+JLhRbwOsCQePABiU3tJ1egGvyQ+33R/vcwM2Zl2QR/LzjsBeItPt3oSVXapn+m4nQDvpzw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=14"
      },
      "funding": {
        "url": "https://github.com/sponsors/antonk52"
      }
    },
    "node_modules/lines-and-columns": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/lines-and-columns/-/lines-and-columns-1.2.4.tgz",
      "integrity": "sha512-7ylylesZQ/PV29jhEDl3Ufjo6ZX7gCqJr5F7PKrqc93v7fzSymt1BpwEU8nAUXs8qzzvqhbjhK5QZg6Mt/HkBg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/load-tsconfig": {
      "version": "0.2.5",
      "resolved": "https://registry.npmjs.org/load-tsconfig/-/load-tsconfig-0.2.5.tgz",
      "integrity": "sha512-IXO6OCs9yg8tMKzfPZ1YmheJbZCiEsnBdcB03l0OcfK9prKnJb96siuHCr5Fl37/yo9DnKU+TLpxzTUspw9shg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^12.20.0 || ^14.13.1 || >=16.0.0"
      }
    },
    "node_modules/locate-path": {
      "version": "6.0.0",
      "resolved": "https://registry.npmjs.org/locate-path/-/locate-path-6.0.0.tgz",
      "integrity": "sha512-iPZK6eYjbxRu3uB4/WZ3EsEIMJFMqAoopl3R+zuq0UjcAm/MO6KCweDgPfP3elTztoKP3KtnVHxTn2NHBSDVUw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "p-locate": "^5.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/lodash": {
      "version": "4.18.1",
      "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.18.1.tgz",
      "integrity": "sha512-dMInicTPVE8d1e5otfwmmjlxkZoUpiVLwyeTdUsi/Caj/gfzzblBcCE5sRHV/AsjuCmxWrte2TNGSYuCeCq+0Q==",
      "license": "MIT"
    },
    "node_modules/lodash.snakecase": {
      "version": "4.1.1",
      "resolved": "https://registry.npmjs.org/lodash.snakecase/-/lodash.snakecase-4.1.1.tgz",
      "integrity": "sha512-QZ1d4xoBHYUeuouhEq3lk3Uq7ldgyFXGBhg04+oRLnIz8o9T65Eh+8YdroUwn846zchkA9yDsDl5CVVaV2nqYw==",
      "license": "MIT"
    },
    "node_modules/magic-bytes.js": {
      "version": "1.13.1",
      "resolved": "https://registry.npmjs.org/magic-bytes.js/-/magic-bytes.js-1.13.1.tgz",
      "integrity": "sha512-x5sn4UX2k5gCWlcfmoFwG4TPie8+dctESyqOBdhB5p6MsgWXdBKGmt9nXPObj/JI50TTL928lc5Yt1WntMn1bw==",
      "license": "MIT"
    },
    "node_modules/magic-string": {
      "version": "0.30.21",
      "resolved": "https://registry.npmjs.org/magic-string/-/magic-string-0.30.21.tgz",
      "integrity": "sha512-vd2F4YUyEXKGcLHoq+TEyCjxueSeHnFxyyjNp80yg0XV4vUhnDer/lvvlqM/arB5bXQN5K2/3oinyCRyx8T2CQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.5"
      }
    },
    "node_modules/mimic-response": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/mimic-response/-/mimic-response-3.1.0.tgz",
      "integrity": "sha512-z0yWI+4FDrrweS8Zmt4Ej5HdJmky15+L2e6Wgn3+iK5fWzb6T3fhNFq2+MeTRb064c6Wr4N/wv0DzQTjNzHNGQ==",
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/minimatch": {
      "version": "10.2.6",
      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-10.2.6.tgz",
      "integrity": "sha512-vpLQEs+VLCr1nU0BXS07maYoFwlDAH0gngQuuttxIwutDFEMHq2blX+8vpgxDdK3J1PwjCJiep77OitTZ4Ll1A==",
      "dev": true,
      "license": "BlueOak-1.0.0",
      "dependencies": {
        "brace-expansion": "^5.0.8"
      },
      "engines": {
        "node": "18 || 20 || >=22"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/minimist": {
      "version": "1.2.8",
      "resolved": "https://registry.npmjs.org/minimist/-/minimist-1.2.8.tgz",
      "integrity": "sha512-2yyAR8qBkN3YuheJanUpWC5U3bb5osDywNB8RzDVlDwDHbocAJveqqj1u8+SVD7jkWT4yvsHCpWqqWqAxb0zCA==",
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/mkdirp-classic": {
      "version": "0.5.3",
      "resolved": "https://registry.npmjs.org/mkdirp-classic/-/mkdirp-classic-0.5.3.tgz",
      "integrity": "sha512-gKLcREMhtuZRwRAfqP3RFW+TK4JqApVBtOIftVgjuABpAtpxhPGaDcfvbhNvD0B8iD1oUr/txX35NjcaY6Ns/A==",
      "license": "MIT"
    },
    "node_modules/mlly": {
      "version": "1.8.2",
      "resolved": "https://registry.npmjs.org/mlly/-/mlly-1.8.2.tgz",
      "integrity": "sha512-d+ObxMQFmbt10sretNDytwt85VrbkhhUA/JBGm1MPaWJ65Cl4wOgLaB1NYvJSZ0Ef03MMEU/0xpPMXUIQ29UfA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "acorn": "^8.16.0",
        "pathe": "^2.0.3",
        "pkg-types": "^1.3.1",
        "ufo": "^1.6.3"
      }
    },
    "node_modules/ms": {
      "version": "2.1.3",
      "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
      "integrity": "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==",
      "license": "MIT"
    },
    "node_modules/mz": {
      "version": "2.7.0",
      "resolved": "https://registry.npmjs.org/mz/-/mz-2.7.0.tgz",
      "integrity": "sha512-z81GNO7nnYMEhrGh9LeymoE4+Yr0Wn5McHIZMK5cfQCl+NDX08sCZgUc9/6MHni9IWuFLm1Z3HTCXu2z9fN62Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "any-promise": "^1.0.0",
        "object-assign": "^4.0.1",
        "thenify-all": "^1.0.0"
      }
    },
    "node_modules/nanoid": {
      "version": "3.3.20",
      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.20.tgz",
      "integrity": "sha512-uKdg2G3GNCKQn9byYOpxbGqrT2fGO5KRt5J/8b3pok8rT6qxGWF6hxMyJiEYtAf+FVyYuD9hRaDqX5uPFYJ4ZQ==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "bin": {
        "nanoid": "bin/nanoid.cjs"
      },
      "engines": {
        "node": "^10 || ^12 || ^13.7 || ^14 || >=15.0.1"
      }
    },
    "node_modules/napi-build-utils": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/napi-build-utils/-/napi-build-utils-2.0.0.tgz",
      "integrity": "sha512-GEbrYkbfF7MoNaoh2iGG84Mnf/WZfB0GdGEsM8wz7Expx/LlWf5U8t9nvJKXSp3qr5IsEbK04cBGhol/KwOsWA==",
      "license": "MIT"
    },
    "node_modules/natural-compare": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/natural-compare/-/natural-compare-1.4.0.tgz",
      "integrity": "sha512-OWND8ei3VtNC9h7V60qff3SVobHr996CTwgxubgyQYEpg290h9J0buyECNNJexkFm5sOajh5G116RYA1c8ZMSw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/node-abi": {
      "version": "3.98.0",
      "resolved": "https://registry.npmjs.org/node-abi/-/node-abi-3.98.0.tgz",
      "integrity": "sha512-Llh8noNw7s15m+rmIrZnZQbe4gLyasL9loT74rC92PkmwWKeEedKvc7o6pjp8B3MhrYT/Cl846NOYZbz1wmddw==",
      "license": "MIT",
      "dependencies": {
        "semver": "^7.3.5"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/object-assign": {
      "version": "4.1.1",
      "resolved": "https://registry.npmjs.org/object-assign/-/object-assign-4.1.1.tgz",
      "integrity": "sha512-rJgTQnkUnH1sFw8yT6VSU3zD3sWmu6sZhIseY8VX+GRu3P6F7Fu+JNDoXfklElbLJSnc3FUQHVe4cU5hj+BcUg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/obug": {
      "version": "2.2.1",
      "resolved": "https://registry.npmjs.org/obug/-/obug-2.2.1.tgz",
      "integrity": "sha512-XrsrhT5sybtKI6wakr2SPOlGZWWYbUXZ7a0jT8/QOeAPau+1X/bSegNe5YR75oJmEZQbKningirmGOEJCIk61Q==",
      "dev": true,
      "funding": [
        "https://github.com/sponsors/sxzz",
        "https://opencollective.com/debug"
      ],
      "license": "MIT",
      "engines": {
        "node": ">=12.20.0"
      }
    },
    "node_modules/on-exit-leak-free": {
      "version": "2.1.2",
      "resolved": "https://registry.npmjs.org/on-exit-leak-free/-/on-exit-leak-free-2.1.2.tgz",
      "integrity": "sha512-0eJJY6hXLGf1udHwfNftBqH+g73EU4B504nZeKpz1sYRKafAghwxEJunB2O7rDZkL4PGfsMVnTXZ2EjibbqcsA==",
      "license": "MIT",
      "engines": {
        "node": ">=14.0.0"
      }
    },
    "node_modules/once": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/once/-/once-1.4.0.tgz",
      "integrity": "sha512-lNaJgI+2Q5URQBkccEKHTQOPaXdUxnZZElQTZY0MFUAuaEqe1E+Nyvgdz/aIyNi6Z9MzO5dv1H8n58/GELp3+w==",
      "license": "ISC",
      "dependencies": {
        "wrappy": "1"
      }
    },
    "node_modules/optionator": {
      "version": "0.9.4",
      "resolved": "https://registry.npmjs.org/optionator/-/optionator-0.9.4.tgz",
      "integrity": "sha512-6IpQ7mKUxRcZNLIObR0hz7lxsapSSIYNZJwXPGeF0mTVqGKFIXj1DQcMoT22S3ROcLyY/rz0PWaWZ9ayWmad9g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "deep-is": "^0.1.3",
        "fast-levenshtein": "^2.0.6",
        "levn": "^0.4.1",
        "prelude-ls": "^1.2.1",
        "type-check": "^0.4.0",
        "word-wrap": "^1.2.5"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/p-limit": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/p-limit/-/p-limit-3.1.0.tgz",
      "integrity": "sha512-TYOanM3wGwNGsZN2cVTYPArw454xnXj5qmWF1bEoAc4+cU/ol7GVh7odevjp1FNHduHc3KZMcFduxU5Xc6uJRQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "yocto-queue": "^0.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/p-locate": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/p-locate/-/p-locate-5.0.0.tgz",
      "integrity": "sha512-LaNjtRWUBY++zB5nE/NwcaoMylSPk+S+ZHNB1TzdbMJMny6dynpAGt7X/tl/QYq3TIeE6nxHppbo2LGymrG5Pw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "p-limit": "^3.0.2"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/path-exists": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/path-exists/-/path-exists-4.0.0.tgz",
      "integrity": "sha512-ak9Qy5Q7jYb2Wwcey5Fpvg2KoAc/ZIhLSLOSBmRmygPsGwkVVt0fZa0qrtMz+m6tJTAHfZQ8FnmB4MG4LWy7/w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/path-key": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/path-key/-/path-key-3.1.1.tgz",
      "integrity": "sha512-ojmeN0qd+y0jszEtoY48r0Peq5dwMEkIlCOu6Q5f41lfkswXuKtYrhgoTpLnyIcHm24Uhqx+5Tqm2InSwLhE6Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/pathe": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/pathe/-/pathe-2.0.3.tgz",
      "integrity": "sha512-WUjGcAqP1gQacoQe+OBJsFA7Ld4DyXuUIjZ5cc75cLHvJ7dtNsTugphxIADwspS+AraAUePCKrSVtPLFj/F88w==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/picocolors": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/picocolors/-/picocolors-1.1.1.tgz",
      "integrity": "sha512-xceH2snhtb5M9liqDsmEw56le376mTZkEX/jEb/RxNFyegNul7eNslCXP9FDj/Lcu0X8KEyMceP2ntpaHrDEVA==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/picomatch": {
      "version": "4.0.7",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-4.0.7.tgz",
      "integrity": "sha512-qcJu88Q2IWqJsDD529JKMdwGm/dvInW4HvQnRwiH9JtihJvzGOscDtHE3x1pBKeUOTysQ8kVmLnJ2kJu7yhcGA==",
      "dev": true,
      "license": "MIT",
      "peer": true,
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/pino": {
      "version": "10.4.0",
      "resolved": "https://registry.npmjs.org/pino/-/pino-10.4.0.tgz",
      "integrity": "sha512-bk1ZMTwG/Vymx+zPoa28MhNzucFvXJWp3csrSuxuHPSMeUettaCoQ5Jvg07mtC4JGNpcfTwz41oVCnNgBK9+vA==",
      "license": "MIT",
      "dependencies": {
        "@pinojs/redact": "^0.4.0",
        "atomic-sleep": "^1.0.0",
        "on-exit-leak-free": "^2.1.0",
        "pino-abstract-transport": "^3.0.0",
        "pino-std-serializers": "^7.0.0",
        "process-warning": "^5.0.0",
        "quick-format-unescaped": "^4.0.3",
        "real-require": "^1.0.0",
        "safe-stable-stringify": "^2.3.1",
        "sonic-boom": "^4.0.1",
        "thread-stream": "^4.0.0"
      },
      "bin": {
        "pino": "bin.js"
      }
    },
    "node_modules/pino-abstract-transport": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/pino-abstract-transport/-/pino-abstract-transport-3.0.0.tgz",
      "integrity": "sha512-wlfUczU+n7Hy/Ha5j9a/gZNy7We5+cXp8YL+X+PG8S0KXxw7n/JXA3c46Y0zQznIJ83URJiwy7Lh56WLokNuxg==",
      "license": "MIT",
      "dependencies": {
        "split2": "^4.0.0"
      }
    },
    "node_modules/pino-pretty": {
      "version": "13.2.0",
      "resolved": "https://registry.npmjs.org/pino-pretty/-/pino-pretty-13.2.0.tgz",
      "integrity": "sha512-jjghD1ML+Di/WxjJDz6j6Y4FT7hIXOlb8h27AyJ+ohtAXJXH4PS/xkv7si+RCCIW59HMgZsMKTDgzdr0RhuRrg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "colorette": "^2.0.7",
        "dateformat": "^4.6.3",
        "fast-copy": "^4.0.0",
        "fast-safe-stringify": "^2.1.1",
        "help-me": "^5.0.0",
        "joycon": "^3.1.1",
        "minimist": "^1.2.6",
        "on-exit-leak-free": "^2.1.2",
        "pino-abstract-transport": "^3.0.0",
        "pump": "^3.0.3",
        "secure-json-parse": "^4.1.0",
        "sonic-boom": "^5.0.0",
        "strip-json-comments": "^5.0.3"
      },
      "bin": {
        "pino-pretty": "bin.js"
      }
    },
    "node_modules/pino-pretty/node_modules/sonic-boom": {
      "version": "5.0.2",
      "resolved": "https://registry.npmjs.org/sonic-boom/-/sonic-boom-5.0.2.tgz",
      "integrity": "sha512-/JEruzo6yhNVhsLblTRchgTQHIt7SsdJP0YyrfWaNKjIOQDfrdZv9gwYraYCAsmKV39/LAdV31FLL5NCDpoL/A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "atomic-sleep": "^1.0.0"
      }
    },
    "node_modules/pino-pretty/node_modules/strip-json-comments": {
      "version": "5.0.3",
      "resolved": "https://registry.npmjs.org/strip-json-comments/-/strip-json-comments-5.0.3.tgz",
      "integrity": "sha512-1tB5mhVo7U+ETBKNf92xT4hrQa3pm0MZ0PQvuDnWgAAGHDsfp4lPSpiS6psrSiet87wyGPh9ft6wmhOMQ0hDiw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=14.16"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/pino-std-serializers": {
      "version": "7.1.0",
      "resolved": "https://registry.npmjs.org/pino-std-serializers/-/pino-std-serializers-7.1.0.tgz",
      "integrity": "sha512-BndPH67/JxGExRgiX1dX0w1FvZck5Wa4aal9198SrRhZjH3GxKQUKIBnYJTdj2HDN3UQAS06HlfcSbQj2OHmaw==",
      "license": "MIT"
    },
    "node_modules/pirates": {
      "version": "4.0.7",
      "resolved": "https://registry.npmjs.org/pirates/-/pirates-4.0.7.tgz",
      "integrity": "sha512-TfySrs/5nm8fQJDcBDuUng3VOUKsd7S+zqvbOTiGXHfxX4wK31ard+hoNuvkicM/2YFzlpDgABOevKSsB4G/FA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/pkg-types": {
      "version": "1.3.1",
      "resolved": "https://registry.npmjs.org/pkg-types/-/pkg-types-1.3.1.tgz",
      "integrity": "sha512-/Jm5M4RvtBFVkKWRu2BLUTNP8/M2a+UwuAX+ae4770q1qVGtfjG+WTCupoZixokjmHiry8uI+dlY8KXYV5HVVQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "confbox": "^0.1.8",
        "mlly": "^1.7.4",
        "pathe": "^2.0.1"
      }
    },
    "node_modules/postcss": {
      "version": "8.5.29",
      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.29.tgz",
      "integrity": "sha512-49cGhUbXj8Qenv0iTMxA1cFBzxXoctpC9Ujd77t1WcbJIr6nF/eI7g/8MgxrYldFRuAXvja7xQRwavoW7kgrxQ==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "peer": true,
      "dependencies": {
        "nanoid": "^3.3.19",
        "picocolors": "^1.1.1",
        "source-map-js": "^1.2.2"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/postcss-load-config": {
      "version": "6.0.1",
      "resolved": "https://registry.npmjs.org/postcss-load-config/-/postcss-load-config-6.0.1.tgz",
      "integrity": "sha512-oPtTM4oerL+UXmx+93ytZVN82RrlY/wPUV8IeDxFrzIjXOLF1pN+EmKPLbubvKHT2HC20xXsCAH2Z+CKV6Oz/g==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "lilconfig": "^3.1.1"
      },
      "engines": {
        "node": ">= 18"
      },
      "peerDependencies": {
        "jiti": ">=1.21.0",
        "postcss": ">=8.0.9",
        "tsx": "^4.8.1",
        "yaml": "^2.4.2"
      },
      "peerDependenciesMeta": {
        "jiti": {
          "optional": true
        },
        "postcss": {
          "optional": true
        },
        "tsx": {
          "optional": true
        },
        "yaml": {
          "optional": true
        }
      }
    },
    "node_modules/prebuild-install": {
      "version": "7.1.3",
      "resolved": "https://registry.npmjs.org/prebuild-install/-/prebuild-install-7.1.3.tgz",
      "integrity": "sha512-8Mf2cbV7x1cXPUILADGI3wuhfqWvtiLA1iclTDbFRZkgRQS0NqsPZphna9V+HyTEadheuPmjaJMsbzKQFOzLug==",
      "deprecated": "No longer maintained. Please contact the author of the relevant native addon; alternatives are available.",
      "license": "MIT",
      "dependencies": {
        "detect-libc": "^2.0.0",
        "expand-template": "^2.0.3",
        "github-from-package": "0.0.0",
        "minimist": "^1.2.3",
        "mkdirp-classic": "^0.5.3",
        "napi-build-utils": "^2.0.0",
        "node-abi": "^3.3.0",
        "pump": "^3.0.0",
        "rc": "^1.2.7",
        "simple-get": "^4.0.0",
        "tar-fs": "^2.0.0",
        "tunnel-agent": "^0.6.0"
      },
      "bin": {
        "prebuild-install": "bin.js"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/prelude-ls": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/prelude-ls/-/prelude-ls-1.2.1.tgz",
      "integrity": "sha512-vkcDPrRZo1QZLbn5RLGPpg/WmIQ65qoWWhcGKf/b5eplkkarX0m9z8ppCat4mlOqUsWpyNuYgO3VRyrYHSzX5g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/prettier": {
      "version": "3.9.10",
      "resolved": "https://registry.npmjs.org/prettier/-/prettier-3.9.10.tgz",
      "integrity": "sha512-skGHTH1Yb9QvaTC4hWnRTzEYtCpApF0UMBPz+t/0ZPzP8ihefo/btKd+QA7pUE0fEwA1SbS/NmhyEcstdXOIdA==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "prettier": "bin/prettier.cjs"
      },
      "engines": {
        "node": ">=14"
      },
      "funding": {
        "url": "https://github.com/prettier/prettier?sponsor=1"
      }
    },
    "node_modules/process-warning": {
      "version": "5.1.1",
      "resolved": "https://registry.npmjs.org/process-warning/-/process-warning-5.1.1.tgz",
      "integrity": "sha512-oCkNVj4OKnKEcocVBcDfiIugN1/cE6rgfT3nCtzeqZPA8+rIxMaQ0xXzIkGP8Gj2qUaP1UR7uhJ1VD8lUCpzCg==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/fastify"
        },
        {
          "type": "opencollective",
          "url": "https://opencollective.com/fastify"
        }
      ],
      "license": "MIT"
    },
    "node_modules/pump": {
      "version": "3.0.4",
      "resolved": "https://registry.npmjs.org/pump/-/pump-3.0.4.tgz",
      "integrity": "sha512-VS7sjc6KR7e1ukRFhQSY5LM2uBWAUPiOPa/A3mkKmiMwSmRFUITt0xuj+/lesgnCv+dPIEYlkzrcyXgquIHMcA==",
      "license": "MIT",
      "dependencies": {
        "end-of-stream": "^1.1.0",
        "once": "^1.3.1"
      }
    },
    "node_modules/punycode": {
      "version": "2.3.1",
      "resolved": "https://registry.npmjs.org/punycode/-/punycode-2.3.1.tgz",
      "integrity": "sha512-vYt7UD1U9Wg6138shLtLOvdAu+8DsC/ilFtEVHcH+wydcSpNE20AfSOduf6MkRFahL5FY7X1oU7nKVZFtfq8Fg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/qified": {
      "version": "0.10.1",
      "resolved": "https://registry.npmjs.org/qified/-/qified-0.10.1.tgz",
      "integrity": "sha512-+Owyggi9IxT1ePKGafcI87ubSmxol6smwJ+RAHDQlx9+9cPwFWDiKFFCPuWhr9ignlGpZ9vDQLw67N4dcTVFEA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hookified": "^2.1.1"
      },
      "engines": {
        "node": ">=20"
      }
    },
    "node_modules/qified/node_modules/hookified": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/hookified/-/hookified-2.2.0.tgz",
      "integrity": "sha512-p/LgFzRN5FeoD3DLS6bkUapeye6E4SI6yJs6KetENd18S+FBthqYq2amJUWpt5z0EQwwHemidjY5OqJGEKm5uA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/quick-format-unescaped": {
      "version": "4.0.4",
      "resolved": "https://registry.npmjs.org/quick-format-unescaped/-/quick-format-unescaped-4.0.4.tgz",
      "integrity": "sha512-tYC1Q1hgyRuHgloV/YXs2w15unPVh8qfu/qCTfhTYamaw7fyhumKa2yGpdSo87vY32rIclj+4fWYQXUMs9EHvg==",
      "license": "MIT"
    },
    "node_modules/rc": {
      "version": "1.2.8",
      "resolved": "https://registry.npmjs.org/rc/-/rc-1.2.8.tgz",
      "integrity": "sha512-y3bGgqKj3QBdxLbLkomlohkvsA8gdAiUQlSBJnBhfn+BPxg4bc62d8TcBW15wavDfgexCgccckhcZvywyQYPOw==",
      "license": "(BSD-2-Clause OR MIT OR Apache-2.0)",
      "dependencies": {
        "deep-extend": "^0.6.0",
        "ini": "~1.3.0",
        "minimist": "^1.2.0",
        "strip-json-comments": "~2.0.1"
      },
      "bin": {
        "rc": "cli.js"
      }
    },
    "node_modules/rc/node_modules/strip-json-comments": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/strip-json-comments/-/strip-json-comments-2.0.1.tgz",
      "integrity": "sha512-4gB8na07fecVVkOI6Rs4e7T6NOTki5EmL7TUduTs6bu3EdnSycntVJ4re8kgZA+wx9IueI2Y11bfbgwtzuE0KQ==",
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/readable-stream": {
      "version": "3.6.2",
      "resolved": "https://registry.npmjs.org/readable-stream/-/readable-stream-3.6.2.tgz",
      "integrity": "sha512-9u/sniCrY3D5WdsERHzHE4G2YCXqoG5FTHUiCC4SIbr6XcLZBY05ya9EKjYek9O5xOAwjGq+1JdGBAS7Q9ScoA==",
      "license": "MIT",
      "dependencies": {
        "inherits": "^2.0.3",
        "string_decoder": "^1.1.1",
        "util-deprecate": "^1.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/readdirp": {
      "version": "4.1.2",
      "resolved": "https://registry.npmjs.org/readdirp/-/readdirp-4.1.2.tgz",
      "integrity": "sha512-GDhwkLfywWL2s6vEjyhri+eXmfH6j1L7JE27WhqLeYzoh/A3DBaYGEj2H/HFZCn/kMfim73FXxEJTw06WtxQwg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 14.18.0"
      },
      "funding": {
        "type": "individual",
        "url": "https://paulmillr.com/funding/"
      }
    },
    "node_modules/real-require": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/real-require/-/real-require-1.0.0.tgz",
      "integrity": "sha512-P4nbQYQfePJxRSmY+v/KINxVucm4NF3p3s7pJveMTtom52FR4YGltUQLB8idDXwDDWW+eYrWDFbuzUnjoWHF7g==",
      "license": "MIT"
    },
    "node_modules/redis-errors": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/redis-errors/-/redis-errors-1.2.0.tgz",
      "integrity": "sha512-1qny3OExCf0UvUV/5wpYKf2YwPcOqXzkwKKSmKHiE6ZMQs5heeE/c8eXK+PNllPvmjgAbfnsbpkGZWy8cBpn9w==",
      "license": "MIT",
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/resolve-pkg-maps": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/resolve-pkg-maps/-/resolve-pkg-maps-1.0.0.tgz",
      "integrity": "sha512-seS2Tj26TBVOC2NIc2rOe2y2ZO7efxITtLZcGSOnHHNOQ7CkiUBfw0Iw2ck6xkIhPwLhKNLS8BO+hEpngQlqzw==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/privatenumber/resolve-pkg-maps?sponsor=1"
      }
    },
    "node_modules/rollup": {
      "version": "4.64.5",
      "resolved": "https://registry.npmjs.org/rollup/-/rollup-4.64.5.tgz",
      "integrity": "sha512-EAP5ZHcz2ijbgCWwPkpI7zh6bfsri2Ez5FtCy2dCp1k62duXzfG7DLGGh7RU2QQXWwavT+u4qpvDF/TWOiiGTw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@types/estree": "1.0.9"
      },
      "bin": {
        "rollup": "dist/bin/rollup"
      },
      "engines": {
        "node": ">=18.0.0",
        "npm": ">=8.0.0"
      },
      "optionalDependencies": {
        "@napi-rs/lzma-linux-x64-gnu": "1.5.1",
        "@rollup/rollup-android-arm-eabi": "4.64.5",
        "@rollup/rollup-android-arm64": "4.64.5",
        "@rollup/rollup-darwin-arm64": "4.64.5",
        "@rollup/rollup-darwin-x64": "4.64.5",
        "@rollup/rollup-freebsd-arm64": "4.64.5",
        "@rollup/rollup-freebsd-x64": "4.64.5",
        "@rollup/rollup-linux-arm-gnueabihf": "4.64.5",
        "@rollup/rollup-linux-arm-musleabihf": "4.64.5",
        "@rollup/rollup-linux-arm64-gnu": "4.64.5",
        "@rollup/rollup-linux-arm64-musl": "4.64.5",
        "@rollup/rollup-linux-loong64-gnu": "4.64.5",
        "@rollup/rollup-linux-loong64-musl": "4.64.5",
        "@rollup/rollup-linux-ppc64-gnu": "4.64.5",
        "@rollup/rollup-linux-ppc64-musl": "4.64.5",
        "@rollup/rollup-linux-riscv64-gnu": "4.64.5",
        "@rollup/rollup-linux-riscv64-musl": "4.64.5",
        "@rollup/rollup-linux-s390x-gnu": "4.64.5",
        "@rollup/rollup-linux-x64-gnu": "4.64.5",
        "@rollup/rollup-linux-x64-musl": "4.64.5",
        "@rollup/rollup-openbsd-x64": "4.64.5",
        "@rollup/rollup-openharmony-arm64": "4.64.5",
        "@rollup/rollup-win32-arm64-msvc": "4.64.5",
        "@rollup/rollup-win32-ia32-msvc": "4.64.5",
        "@rollup/rollup-win32-x64-gnu": "4.64.5",
        "@rollup/rollup-win32-x64-msvc": "4.64.5",
        "fsevents": "~2.3.2"
      }
    },
    "node_modules/safe-buffer": {
      "version": "5.2.1",
      "resolved": "https://registry.npmjs.org/safe-buffer/-/safe-buffer-5.2.1.tgz",
      "integrity": "sha512-rp3So07KcdmmKbGvgaNxQSJr7bGVSVk5S9Eq1F+ppbRo70+YeaDxkw5Dd8NPN+GD6bjnYm2VuPuCXmpuYvmCXQ==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/safe-stable-stringify": {
      "version": "2.5.0",
      "resolved": "https://registry.npmjs.org/safe-stable-stringify/-/safe-stable-stringify-2.5.0.tgz",
      "integrity": "sha512-b3rppTKm9T+PsVCBEOUR46GWI7fdOs00VKZ1+9c1EWDaDMvjQc6tUwuFyIprgGgTcWoVHSKrU8H31ZHA2e0RHA==",
      "license": "MIT",
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/secure-json-parse": {
      "version": "4.1.1",
      "resolved": "https://registry.npmjs.org/secure-json-parse/-/secure-json-parse-4.1.1.tgz",
      "integrity": "sha512-lnd81MQEZKjhW/Gd2TQqdd4XP6QYNdDW/EP+I7nTrFHP9y2LmaGPIHk9xsnzcOiEr1c39c/e84xFgGviQKBTRw==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/fastify"
        },
        {
          "type": "opencollective",
          "url": "https://opencollective.com/fastify"
        }
      ],
      "license": "BSD-3-Clause"
    },
    "node_modules/semver": {
      "version": "7.8.5",
      "resolved": "https://registry.npmjs.org/semver/-/semver-7.8.5.tgz",
      "integrity": "sha512-Y7/KDsb8LjooZpwaqGyulO6DQlksgCncchHGk+sZIY4SBvUocMBEFH5Ur1fI4dV+Jvl0w6cjvucaIi40puRioA==",
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/shebang-command": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/shebang-command/-/shebang-command-2.0.0.tgz",
      "integrity": "sha512-kHxr2zZpYtdmrN1qDjrrX/Z1rR1kG8Dx+gkpK1G4eXmvXswmcE1hTWBWYUzlraYw1/yZp6YuDY77YtvbN0dmDA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "shebang-regex": "^3.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/shebang-regex": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/shebang-regex/-/shebang-regex-3.0.0.tgz",
      "integrity": "sha512-7++dFhtcx3353uBaq8DDR4NuxBetBzC7ZQOhmTQInHEd6bSrXdiEyzCvG07Z44UYdLShWUyXt5M/yhz8ekcb1A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/siginfo": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/siginfo/-/siginfo-2.0.0.tgz",
      "integrity": "sha512-ybx0WO1/8bSBLEWXZvEd7gMW3Sn3JFlW3TvX1nREbDLRNQNaeNN8WK0meBwPdAaOI7TtRRRJn/Es1zhrrCHu7g==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/simple-concat": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/simple-concat/-/simple-concat-1.0.1.tgz",
      "integrity": "sha512-cSFtAPtRhljv69IK0hTVZQ+OfE9nePi/rtJmw5UjHeVyVroEqJXP1sFztKUy1qU+xvz3u/sfYJLa947b7nAN2Q==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/simple-get": {
      "version": "4.0.1",
      "resolved": "https://registry.npmjs.org/simple-get/-/simple-get-4.0.1.tgz",
      "integrity": "sha512-brv7p5WgH0jmQJr1ZDDfKDOSeWWg+OVypG99A/5vYGPqJ6pxiaHLy8nxtFjBA7oMa01ebA9gfh1uMCFqOuXxvA==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "decompress-response": "^6.0.0",
        "once": "^1.3.1",
        "simple-concat": "^1.0.0"
      }
    },
    "node_modules/sonic-boom": {
      "version": "4.2.1",
      "resolved": "https://registry.npmjs.org/sonic-boom/-/sonic-boom-4.2.1.tgz",
      "integrity": "sha512-w6AxtubXa2wTXAUsZMMWERrsIRAdrK0Sc+FUytWvYAhBJLyuI4llrMIC1DtlNSdI99EI86KZum2MMq3EAZlF9Q==",
      "license": "MIT",
      "dependencies": {
        "atomic-sleep": "^1.0.0"
      }
    },
    "node_modules/source-map": {
      "version": "0.6.1",
      "resolved": "https://registry.npmjs.org/source-map/-/source-map-0.6.1.tgz",
      "integrity": "sha512-UjgapumWlbMhkBgzT7Ykc5YXUT46F0iKu8SGXq0bcwP5dz/h0Plj6enJqjz1Zbq2l5WaqYnrVbwWOWMyF3F47g==",
      "dev": true,
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/source-map-js": {
      "version": "1.2.2",
      "resolved": "https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.2.tgz",
      "integrity": "sha512-KGj/8Y43x35aZVDtt+J4mK1hoLGHULMYfSkODJNQjNDC3oW1PqPoxMwo0pLUsWM/UEGzON/NxeHywEfNXNP3Vw==",
      "dev": true,
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/source-map-support": {
      "version": "0.5.21",
      "resolved": "https://registry.npmjs.org/source-map-support/-/source-map-support-0.5.21.tgz",
      "integrity": "sha512-uBHU3L3czsIyYXKX88fdrGovxdSCoTGDRZ6SYXtSRxLZUzHg5P/66Ht6uoUlHu9EZod+inXhKo3qQgwXUT/y1w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "buffer-from": "^1.0.0",
        "source-map": "^0.6.0"
      }
    },
    "node_modules/split2": {
      "version": "4.2.0",
      "resolved": "https://registry.npmjs.org/split2/-/split2-4.2.0.tgz",
      "integrity": "sha512-UcjcJOWknrNkF6PLX83qcHM6KHgVKNkV62Y8a5uYDVv9ydGQVwAHMKqHdJje1VTWpljG0WYpCDhrCdAOYH4TWg==",
      "license": "ISC",
      "engines": {
        "node": ">= 10.x"
      }
    },
    "node_modules/stackback": {
      "version": "0.0.2",
      "resolved": "https://registry.npmjs.org/stackback/-/stackback-0.0.2.tgz",
      "integrity": "sha512-1XMJE5fQo1jGH6Y/7ebnwPOBEkIEnT4QF32d5R1+VXdXveM0IBMJt8zfaxX1P3QhVwrYe+576+jkANtSS2mBbw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/standard-as-callback": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/standard-as-callback/-/standard-as-callback-2.1.0.tgz",
      "integrity": "sha512-qoRRSyROncaz1z0mvYqIE4lCd9p2R90i6GxW3uZv5ucSu8tU7B5HXUP1gG8pVZsYNVaXjk8ClXHPttLyxAL48A==",
      "license": "MIT"
    },
    "node_modules/std-env": {
      "version": "4.3.0",
      "resolved": "https://registry.npmjs.org/std-env/-/std-env-4.3.0.tgz",
      "integrity": "sha512-OtU/EgQ1kIm5KwqQpBC6ZEMXrZRui11w8zgfTWp8cdO9B8OaPsbA8bTHO2P+HNo1VlUTGMVBwPhydu6poeXiag==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/string_decoder": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/string_decoder/-/string_decoder-1.3.0.tgz",
      "integrity": "sha512-hkRX8U1WjJFd8LsDJ2yQ/wWWxaopEsABU1XfkM8A+j0+85JAGppt16cr1Whg6KIbb4okU6Mql6BOj+uup/wKeA==",
      "license": "MIT",
      "dependencies": {
        "safe-buffer": "~5.2.0"
      }
    },
    "node_modules/sucrase": {
      "version": "3.35.1",
      "resolved": "https://registry.npmjs.org/sucrase/-/sucrase-3.35.1.tgz",
      "integrity": "sha512-DhuTmvZWux4H1UOnWMB3sk0sbaCVOoQZjv8u1rDoTV0HTdGem9hkAZtl4JZy8P2z4Bg0nT+YMeOFyVr4zcG5Tw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/gen-mapping": "^0.3.2",
        "commander": "^4.0.0",
        "lines-and-columns": "^1.1.6",
        "mz": "^2.7.0",
        "pirates": "^4.0.1",
        "tinyglobby": "^0.2.11",
        "ts-interface-checker": "^0.1.9"
      },
      "bin": {
        "sucrase": "bin/sucrase",
        "sucrase-node": "bin/sucrase-node"
      },
      "engines": {
        "node": ">=16 || 14 >=14.17"
      }
    },
    "node_modules/tar-fs": {
      "version": "2.1.5",
      "resolved": "https://registry.npmjs.org/tar-fs/-/tar-fs-2.1.5.tgz",
      "integrity": "sha512-OboTd8mmMhZDNPV+UjQcK9yKAatXu2aJ+r1w4im1Otd4M4fl2hwvdoXUxIYHFTHWK/3y3FarBP70v3vwmGlOxw==",
      "license": "MIT",
      "dependencies": {
        "chownr": "^1.1.1",
        "mkdirp-classic": "^0.5.2",
        "pump": "^3.0.0",
        "tar-stream": "^2.1.4"
      }
    },
    "node_modules/tar-stream": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/tar-stream/-/tar-stream-2.2.0.tgz",
      "integrity": "sha512-ujeqbceABgwMZxEJnk2HDY2DlnUZ+9oEcb1KzTVfYHio0UE6dG71n60d8D2I4qNvleWrrXpmjpt7vZeF1LnMZQ==",
      "license": "MIT",
      "dependencies": {
        "bl": "^4.0.3",
        "end-of-stream": "^1.4.1",
        "fs-constants": "^1.0.0",
        "inherits": "^2.0.3",
        "readable-stream": "^3.1.1"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/thenify": {
      "version": "3.3.1",
      "resolved": "https://registry.npmjs.org/thenify/-/thenify-3.3.1.tgz",
      "integrity": "sha512-RVZSIV5IG10Hk3enotrhvz0T9em6cyHBLkH/YAZuKqd8hRkKhSfCGIcP2KUY0EPxndzANBmNllzWPwak+bheSw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "any-promise": "^1.0.0"
      }
    },
    "node_modules/thenify-all": {
      "version": "1.6.0",
      "resolved": "https://registry.npmjs.org/thenify-all/-/thenify-all-1.6.0.tgz",
      "integrity": "sha512-RNxQH/qI8/t3thXJDwcstUO4zeqo64+Uy/+sNVRBx4Xn2OX+OZ9oP+iJnNFqplFra2ZUVeKCSa2oVWi3T4uVmA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "thenify": ">= 3.1.0 < 4"
      },
      "engines": {
        "node": ">=0.8"
      }
    },
    "node_modules/thread-stream": {
      "version": "4.2.0",
      "resolved": "https://registry.npmjs.org/thread-stream/-/thread-stream-4.2.0.tgz",
      "integrity": "sha512-e2zZ96wSChazBsbENf/Pcm/4swHt2cEKQ92rhUjkL9GCKiTDJIaTBenjE/m9DXi0QBmTMDkFDdOomUy20A1tDQ==",
      "license": "MIT",
      "dependencies": {
        "real-require": "^1.0.0"
      },
      "engines": {
        "node": ">=20"
      }
    },
    "node_modules/tinybench": {
      "version": "2.9.0",
      "resolved": "https://registry.npmjs.org/tinybench/-/tinybench-2.9.0.tgz",
      "integrity": "sha512-0+DUvqWMValLmha6lr4kD8iAMK1HzV0/aKnCtWb9v9641TnP/MFb7Pc2bxoxQjTXAErryXVgUOfv2YqNllqGeg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/tinyexec": {
      "version": "0.3.2",
      "resolved": "https://registry.npmjs.org/tinyexec/-/tinyexec-0.3.2.tgz",
      "integrity": "sha512-KQQR9yN7R5+OSwaK0XQoj22pwHoTlgYqmUscPYoknOoWCWfj/5/ABTMRi69FrKU5ffPVh5QcFikpWJI/P1ocHA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/tinyglobby": {
      "version": "0.2.17",
      "resolved": "https://registry.npmjs.org/tinyglobby/-/tinyglobby-0.2.17.tgz",
      "integrity": "sha512-wXR/dYpcqKmfWpEdZjiKJOwCNFndD0DMnrW/cYjVGttEkBfVgcLFHoNrlj47mjOVic9yyNu65alsgF4NQyTa2g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fdir": "^6.5.0",
        "picomatch": "^4.0.4"
      },
      "engines": {
        "node": ">=12.0.0"
      },
      "funding": {
        "url": "https://github.com/sponsors/SuperchupuDev"
      }
    },
    "node_modules/tinyrainbow": {
      "version": "3.2.0",
      "resolved": "https://registry.npmjs.org/tinyrainbow/-/tinyrainbow-3.2.0.tgz",
      "integrity": "sha512-LgO3D9yZJjApUiuUfl9iFAwrtaX4+lok3wJIqttGoKCHlWUqHqbQpnxCf82L8FjgKsh4iGo78hqJwgL8F6To2A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=14.0.0"
      }
    },
    "node_modules/tree-kill": {
      "version": "1.2.2",
      "resolved": "https://registry.npmjs.org/tree-kill/-/tree-kill-1.2.2.tgz",
      "integrity": "sha512-L0Orpi8qGpRG//Nd+H90vFB+3iHnue1zSSGmNOOCh1GLJ7rUKVwV2HvijphGQS2UmhUZewS9VgvxYIdgr+fG1A==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "tree-kill": "cli.js"
      }
    },
    "node_modules/ts-api-utils": {
      "version": "2.5.0",
      "resolved": "https://registry.npmjs.org/ts-api-utils/-/ts-api-utils-2.5.0.tgz",
      "integrity": "sha512-OJ/ibxhPlqrMM0UiNHJ/0CKQkoKF243/AEmplt3qpRgkW8VG7IfOS41h7V8TjITqdByHzrjcS/2si+y4lIh8NA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18.12"
      },
      "peerDependencies": {
        "typescript": ">=4.8.4"
      }
    },
    "node_modules/ts-interface-checker": {
      "version": "0.1.13",
      "resolved": "https://registry.npmjs.org/ts-interface-checker/-/ts-interface-checker-0.1.13.tgz",
      "integrity": "sha512-Y/arvbn+rrz3JCKl9C4kVNfTfSm2/mEp5FSz5EsZSANGPSlQrpRI5M4PKF+mJnE52jOO90PnPSc3Ur3bTQw0gA==",
      "dev": true,
      "license": "Apache-2.0"
    },
    "node_modules/ts-mixer": {
      "version": "6.0.4",
      "resolved": "https://registry.npmjs.org/ts-mixer/-/ts-mixer-6.0.4.tgz",
      "integrity": "sha512-ufKpbmrugz5Aou4wcr5Wc1UUFWOLhq+Fm6qa6P0w0K5Qw2yhaUoiWszhCVuNQyNwrlGiscHOmqYoAox1PtvgjA==",
      "license": "MIT"
    },
    "node_modules/tslib": {
      "version": "2.8.1",
      "resolved": "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz",
      "integrity": "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==",
      "license": "0BSD"
    },
    "node_modules/tsup": {
      "version": "8.5.1",
      "resolved": "https://registry.npmjs.org/tsup/-/tsup-8.5.1.tgz",
      "integrity": "sha512-xtgkqwdhpKWr3tKPmCkvYmS9xnQK3m3XgxZHwSUjvfTjp7YfXe5tT3GgWi0F2N+ZSMsOeWeZFh7ZZFg5iPhing==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "bundle-require": "^5.1.0",
        "cac": "^6.7.14",
        "chokidar": "^4.0.3",
        "consola": "^3.4.0",
        "debug": "^4.4.0",
        "esbuild": "^0.27.0",
        "fix-dts-default-cjs-exports": "^1.0.0",
        "joycon": "^3.1.1",
        "picocolors": "^1.1.1",
        "postcss-load-config": "^6.0.1",
        "resolve-from": "^5.0.0",
        "rollup": "^4.34.8",
        "source-map": "^0.7.6",
        "sucrase": "^3.35.0",
        "tinyexec": "^0.3.2",
        "tinyglobby": "^0.2.11",
        "tree-kill": "^1.2.2"
      },
      "bin": {
        "tsup": "dist/cli-default.js",
        "tsup-node": "dist/cli-node.js"
      },
      "engines": {
        "node": ">=18"
      },
      "peerDependencies": {
        "@microsoft/api-extractor": "^7.36.0",
        "@swc/core": "^1",
        "postcss": "^8.4.12",
        "typescript": ">=4.5.0"
      },
      "peerDependenciesMeta": {
        "@microsoft/api-extractor": {
          "optional": true
        },
        "@swc/core": {
          "optional": true
        },
        "postcss": {
          "optional": true
        },
        "typescript": {
          "optional": true
        }
      }
    },
    "node_modules/tsup/node_modules/resolve-from": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/resolve-from/-/resolve-from-5.0.0.tgz",
      "integrity": "sha512-qYg9KP24dD5qka9J47d0aVky0N+b4fTU89LN9iDnjB5waksiC49rvMB0PrUJQGoTmH50XPiqOvAjDfaijGxYZw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/tsup/node_modules/source-map": {
      "version": "0.7.6",
      "resolved": "https://registry.npmjs.org/source-map/-/source-map-0.7.6.tgz",
      "integrity": "sha512-i5uvt8C3ikiWeNZSVZNWcfZPItFQOsYTUAOkcUPGd8DqDy1uOUikjt5dG+uRlwyvR108Fb9DOd4GvXfT0N2/uQ==",
      "dev": true,
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">= 12"
      }
    },
    "node_modules/tsx": {
      "version": "4.23.15",
      "resolved": "https://registry.npmjs.org/tsx/-/tsx-4.23.15.tgz",
      "integrity": "sha512-Yiex1Ovn8z2xPpOWckIiysV1SSyRMY9BkLF++q0yKiDxCqRhosKfMg3janKkiLBwZ5c/YryloKwGZcrEmtwxKw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "esbuild": "~0.28.0"
      },
      "bin": {
        "tsx": "dist/cli.mjs"
      },
      "engines": {
        "node": ">=18.0.0"
      },
      "optionalDependencies": {
        "fsevents": "~2.3.3"
      }
    },
    "node_modules/tunnel-agent": {
      "version": "0.6.0",
      "resolved": "https://registry.npmjs.org/tunnel-agent/-/tunnel-agent-0.6.0.tgz",
      "integrity": "sha512-McnNiV1l8RYeY8tBgEpuodCC1mLUdbSN+CYBL7kJsJNInOP8UjDDEwdk6Mw60vdLLrr5NHKZhMAOSrR2NZuQ+w==",
      "license": "Apache-2.0",
      "dependencies": {
        "safe-buffer": "^5.0.1"
      },
      "engines": {
        "node": "*"
      }
    },
    "node_modules/type-check": {
      "version": "0.4.0",
      "resolved": "https://registry.npmjs.org/type-check/-/type-check-0.4.0.tgz",
      "integrity": "sha512-XleUoc9uwGXqjWwXaUTZAmzMcFZ5858QA2vvx1Ur5xIcixXIP+8LnFDgRplU30us6teqdlskFfu+ae4K79Ooew==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "prelude-ls": "^1.2.1"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/typescript": {
      "version": "5.9.3",
      "resolved": "https://registry.npmjs.org/typescript/-/typescript-5.9.3.tgz",
      "integrity": "sha512-jl1vZzPDinLr9eUt3J/t7V6FgNEw9QjvBPdysz9KfQDD41fQrC2Y4vKQdiaUpFT4bXlb1RHhLpp8wtm6M5TgSw==",
      "dev": true,
      "license": "Apache-2.0",
      "peer": true,
      "bin": {
        "tsc": "bin/tsc",
        "tsserver": "bin/tsserver"
      },
      "engines": {
        "node": ">=14.17"
      }
    },
    "node_modules/typescript-eslint": {
      "version": "8.71.1",
      "resolved": "https://registry.npmjs.org/typescript-eslint/-/typescript-eslint-8.71.1.tgz",
      "integrity": "sha512-oiNVPC3/NbV1FpaHU07l8O6ynqG9v4PAiW2WvTrAmZdR0f2HI/gE668ElMLCK7Xbsu5k2fK5C4fXNiq05j7/nQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/eslint-plugin": "8.71.1",
        "@typescript-eslint/parser": "8.71.1",
        "@typescript-eslint/typescript-estree": "8.71.1",
        "@typescript-eslint/utils": "8.71.1"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0",
        "typescript": ">=4.8.4 <6.1.0"
      }
    },
    "node_modules/ufo": {
      "version": "1.6.4",
      "resolved": "https://registry.npmjs.org/ufo/-/ufo-1.6.4.tgz",
      "integrity": "sha512-JFNbkD1Svwe0KvGi8GOeLcP4kAWQ609twvCdcHxq1oSL8svv39ZuSvajcD8B+5D0eL4+s1Is2D/O6KN3qcTeRA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/undici": {
      "version": "6.29.0",
      "resolved": "https://registry.npmjs.org/undici/-/undici-6.29.0.tgz",
      "integrity": "sha512-R+RODBqp6i2pPflGdq+xIOUkl+RNfGgHwoinecKu/JCuf2uO06cOKoDbI2P7Dn6KcswdKwrczbU6IYJ6K8X+wg==",
      "license": "MIT",
      "engines": {
        "node": ">=18.17"
      }
    },
    "node_modules/undici-types": {
      "version": "6.21.0",
      "resolved": "https://registry.npmjs.org/undici-types/-/undici-types-6.21.0.tgz",
      "integrity": "sha512-iwDZqg0QAGrg9Rav5H4n0M64c3mkR59cJ6wQp+7C4nI0gsmExaedaYLNO44eT4AtBBwjbTiGPMlt2Md0T9H9JQ==",
      "license": "MIT"
    },
    "node_modules/uri-js": {
      "version": "4.4.1",
      "resolved": "https://registry.npmjs.org/uri-js/-/uri-js-4.4.1.tgz",
      "integrity": "sha512-7rKUyy33Q1yc98pQ1DAmLtwX109F7TIfWlW1Ydo8Wl1ii1SeHieeh0HHfPeL2fMXK6z0s8ecKs9frCuLJvndBg==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "punycode": "^2.1.0"
      }
    },
    "node_modules/util-deprecate": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/util-deprecate/-/util-deprecate-1.0.2.tgz",
      "integrity": "sha512-EPD5q1uXyFxJpCrLnCc1nHnq3gOa6DZBocAIiI2TaSCA7VCJ1UJDMagCzIkXNsUYfD1daK//LTEQ8xiIbrHtcw==",
      "license": "MIT"
    },
    "node_modules/vite": {
      "version": "7.3.7",
      "resolved": "https://registry.npmjs.org/vite/-/vite-7.3.7.tgz",
      "integrity": "sha512-AHEzTORMbi7/7aXp7w7KZ5+DCUdSeLsJz0grY8xHpc9DHdYb0vQu6DqJfm2tOw3gDExNgPgnJTXxM6syYFHaCA==",
      "dev": true,
      "license": "MIT",
      "peer": true,
      "dependencies": {
        "esbuild": "^0.27.0 || ^0.28.0",
        "fdir": "^6.5.0",
        "picomatch": "^4.0.3",
        "postcss": "^8.5.6",
        "rollup": "^4.43.0",
        "tinyglobby": "^0.2.15"
      },
      "bin": {
        "vite": "bin/vite.js"
      },
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      },
      "funding": {
        "url": "https://github.com/vitejs/vite?sponsor=1"
      },
      "optionalDependencies": {
        "fsevents": "~2.3.3"
      },
      "peerDependencies": {
        "@types/node": "^20.19.0 || >=22.12.0",
        "jiti": ">=1.21.0",
        "less": "^4.0.0",
        "lightningcss": "^1.21.0",
        "sass": "^1.70.0",
        "sass-embedded": "^1.70.0",
        "stylus": ">=0.54.8",
        "sugarss": "^5.0.0",
        "terser": "^5.16.0",
        "tsx": "^4.8.1",
        "yaml": "^2.4.2"
      },
      "peerDependenciesMeta": {
        "@types/node": {
          "optional": true
        },
        "jiti": {
          "optional": true
        },
        "less": {
          "optional": true
        },
        "lightningcss": {
          "optional": true
        },
        "sass": {
          "optional": true
        },
        "sass-embedded": {
          "optional": true
        },
        "stylus": {
          "optional": true
        },
        "sugarss": {
          "optional": true
        },
        "terser": {
          "optional": true
        },
        "tsx": {
          "optional": true
        },
        "yaml": {
          "optional": true
        }
      }
    },
    "node_modules/vitest": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/vitest/-/vitest-4.1.11.tgz",
      "integrity": "sha512-fhACrNXUidIbGSBr5FlbuBkO7VWC1ZyLl0DO4CU2DrQoAPxX84Ysxs+HeGQpii5lZWV1Q4gBZTTu49mF+A6Edw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@vitest/expect": "4.1.11",
        "@vitest/mocker": "4.1.11",
        "@vitest/pretty-format": "4.1.11",
        "@vitest/runner": "4.1.11",
        "@vitest/snapshot": "4.1.11",
        "@vitest/spy": "4.1.11",
        "@vitest/utils": "4.1.11",
        "es-module-lexer": "^2.0.0",
        "expect-type": "^1.3.0",
        "magic-string": "^0.30.21",
        "obug": "^2.1.1",
        "pathe": "^2.0.3",
        "picomatch": "^4.0.3",
        "std-env": "^4.0.0-rc.1",
        "tinybench": "^2.9.0",
        "tinyexec": "^1.0.2",
        "tinyglobby": "^0.2.15",
        "tinyrainbow": "^3.1.0",
        "vite": "^6.0.0 || ^7.0.0 || ^8.0.0",
        "why-is-node-running": "^2.3.0"
      },
      "bin": {
        "vitest": "vitest.mjs"
      },
      "engines": {
        "node": "^20.0.0 || ^22.0.0 || >=24.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/vitest"
      },
      "peerDependencies": {
        "@edge-runtime/vm": "*",
        "@opentelemetry/api": "^1.9.0",
        "@types/node": "^20.0.0 || ^22.0.0 || >=24.0.0",
        "@vitest/browser-playwright": "4.1.11",
        "@vitest/browser-preview": "4.1.11",
        "@vitest/browser-webdriverio": "4.1.11",
        "@vitest/coverage-istanbul": "4.1.11",
        "@vitest/coverage-v8": "4.1.11",
        "@vitest/ui": "4.1.11",
        "happy-dom": "*",
        "jsdom": "*",
        "vite": "^6.0.0 || ^7.0.0 || ^8.0.0"
      },
      "peerDependenciesMeta": {
        "@edge-runtime/vm": {
          "optional": true
        },
        "@opentelemetry/api": {
          "optional": true
        },
        "@types/node": {
          "optional": true
        },
        "@vitest/browser-playwright": {
          "optional": true
        },
        "@vitest/browser-preview": {
          "optional": true
        },
        "@vitest/browser-webdriverio": {
          "optional": true
        },
        "@vitest/coverage-istanbul": {
          "optional": true
        },
        "@vitest/coverage-v8": {
          "optional": true
        },
        "@vitest/ui": {
          "optional": true
        },
        "happy-dom": {
          "optional": true
        },
        "jsdom": {
          "optional": true
        },
        "vite": {
          "optional": false
        }
      }
    },
    "node_modules/vitest/node_modules/tinyexec": {
      "version": "1.3.1",
      "resolved": "https://registry.npmjs.org/tinyexec/-/tinyexec-1.3.1.tgz",
      "integrity": "sha512-GCvB3aoys96IuDFBMcTB46JOR6mdMtAToqwiW8JlWhsoh1mhHi/xn9ss/Dg7N555GiJyEt2qzoG/NHCwM6h1EA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/which": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/which/-/which-2.0.2.tgz",
      "integrity": "sha512-BLI3Tl1TW3Pvl70l3yq3Y64i+awpwXqsGBYWkkqMtnbXgrMD+yj7rhW0kuEDxzJaYXGjEW5ogapKNMEKNMjibA==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "isexe": "^2.0.0"
      },
      "bin": {
        "node-which": "bin/node-which"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/why-is-node-running": {
      "version": "2.3.0",
      "resolved": "https://registry.npmjs.org/why-is-node-running/-/why-is-node-running-2.3.0.tgz",
      "integrity": "sha512-hUrmaWBdVDcxvYqnyh09zunKzROWjbZTiNy8dBEjkS7ehEDQibXJ7XvlmtbwuTclUiIyN+CyXQD4Vmko8fNm8w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "siginfo": "^2.0.0",
        "stackback": "0.0.2"
      },
      "bin": {
        "why-is-node-running": "cli.js"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/word-wrap": {
      "version": "1.2.5",
      "resolved": "https://registry.npmjs.org/word-wrap/-/word-wrap-1.2.5.tgz",
      "integrity": "sha512-BN22B5eaMMI9UMtjrGd5g5eCYPpCPDUy0FJXbYsaT5zYxjFOckS53SQDE3pWkVoWpHXVb3BrYcEN4Twa55B5cA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/wrappy": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/wrappy/-/wrappy-1.0.2.tgz",
      "integrity": "sha512-l4Sp/DRseor9wL6EvV2+TuQn63dMkPjZ/sp9XkghTEbV9KlPS1xUsZ3u7/IQO4wxtcFB4bgpQPRcR3QCvezPcQ==",
      "license": "ISC"
    },
    "node_modules/ws": {
      "version": "8.22.0",
      "resolved": "https://registry.npmjs.org/ws/-/ws-8.22.0.tgz",
      "integrity": "sha512-Ydggc987+RO0AnWtZ/7Wq9FtNvcrL1b/RO0ud9mWjUPgDrsAAwQSF51sm2hm1XofbU/4jkpGEsLFsZZxU+1DOg==",
      "license": "MIT",
      "engines": {
        "node": ">=10.0.0"
      },
      "peerDependencies": {
        "bufferutil": "^4.0.1",
        "utf-8-validate": ">=5.0.2"
      },
      "peerDependenciesMeta": {
        "bufferutil": {
          "optional": true
        },
        "utf-8-validate": {
          "optional": true
        }
      }
    },
    "node_modules/yaml": {
      "version": "2.9.1",
      "resolved": "https://registry.npmjs.org/yaml/-/yaml-2.9.1.tgz",
      "integrity": "sha512-3NxN8+78OdzbT7C/WjGsyfPAtJaN3FNDsWxv7Y7mcDsT/oOmgW8BpyQQFFBnvZE3j9Y2Sdz1ULFLezL7Eb2yFw==",
      "dev": true,
      "license": "ISC",
      "peer": true,
      "bin": {
        "yaml": "bin.mjs"
      },
      "engines": {
        "node": ">= 14.6"
      },
      "funding": {
        "url": "https://github.com/sponsors/eemeli"
      }
    },
    "node_modules/yocto-queue": {
      "version": "0.1.0",
      "resolved": "https://registry.npmjs.org/yocto-queue/-/yocto-queue-0.1.0.tgz",
      "integrity": "sha512-rVksvsnNCdJ/ohGc6xgPwyN8eheCxsiLM8mxuE/t/mOVqJewPuO1miLpTHQiRgTKCLexL4MeAFVagts7HmNZ2Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/zod": {
      "version": "4.6.6",
      "resolved": "https://registry.npmjs.org/zod/-/zod-4.6.6.tgz",
      "integrity": "sha512-4UmzQUF5fxvfcYHlbjBmejU+w+hbDnWFx4aS8kBx7nPBHcO2SqPbpAG8snbdg+Xse4pRefR98hgjFgIMCI/UhA==",
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/colinhacks"
      }
    }
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/.gitattributes

````text
* text=auto eol=lf
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/.gitignore

````text
node_modules/
dist/
coverage/
.env
.env.*
!.env.example
data/
logs/
media-cache/
lavalink/plugins/
lavalink/logs/
*.sqlite
*.sqlite-shm
*.sqlite-wal
*.db
*.db-shm
*.db-wal
*.log
*.tsbuildinfo
.DS_Store
Thumbs.db
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/.dockerignore

````text
node_modules
dist
coverage
.git
.github
.env
.env.*
!.env.example
data
logs
media-cache
lavalink/plugins
lavalink/logs
docs
*.sqlite*
*.db*
*.log
*.tsbuildinfo
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/.prettierignore

````text
node_modules/
dist/
coverage/
data/
logs/
media-cache/
lavalink/plugins/
lavalink/logs/
package-lock.json
src/lib/db/migrations/meta/
docs/phase-*-files.md
.env
.env.*
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/.prettierrc.json

````json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf"
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/tsconfig.json

````json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts", "*.config.ts"],
  "exclude": ["node_modules", "dist", "coverage"]
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/tsup.config.ts

````typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  // Bot, sharding, migration, and registration entries arrive in their implementation phases.
  entry: {
    'config/env': 'src/config/env.ts',
    'scripts/check-env': 'scripts/check-env.ts',
    'scripts/healthcheck': 'scripts/healthcheck.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  dts: false,
  treeshake: true,
  external: ['better-sqlite3', 'pino-pretty'],
  noExternal: ['yaml'],
});
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/vitest.config.ts

````typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
    maxWorkers: 2,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10_000,
  },
});
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/eslint.config.mjs

````javascript
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'data/**',
      'logs/**',
      'media-cache/**',
      'src/lib/db/migrations/meta/**',
    ],
  },
  {
    files: ['**/*.mjs', '**/*.cjs'],
    ...js.configs.recommended,
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/drizzle.config.ts

````typescript
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ quiet: true });

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dbCredentials: { url: process.env.DATABASE_PATH?.trim() || './data/music.sqlite' },
  strict: true,
  verbose: false,
});
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/ecosystem.config.cjs

````javascript
module.exports = {
  apps: [
    {
      name: 'discord-music-stream',
      cwd: __dirname,
      script: 'dist/index.js',
      interpreter: 'node',
      node_args: '--enable-source-maps',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      exp_backoff_restart_delay: 1000,
      max_memory_restart: '512M',
      kill_timeout: 20000,
      env: { NODE_ENV: 'production' },
    },
  ],
};
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/.env.example

````dotenv
# Copy to .env. Replace required placeholders; never commit .env.
NODE_ENV=development
DISCORD_TOKEN=replace_with_your_discord_bot_token
DISCORD_CLIENT_ID=replace_with_your_application_id
# Optional guild ID for instant development slash-command registration.
DISCORD_GUILD_ID=
# Comma-separated bot-owner IDs; only owners can administer global blacklists.
OWNER_IDS=
# JSON array of extra bot tokens, not user account tokens. Maximum 10.
EXTRA_BOT_TOKENS=[]
SHARD_COUNT=auto

# Generate a password with: node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
LAVALINK_HOST=127.0.0.1
LAVALINK_PORT=2333
LAVALINK_PASSWORD=replace_with_a_random_32_character_password
LAVALINK_SECURE=false
# Optional JSON array. When nonempty, overrides the four single-node settings above.
# Each node: {"id":"primary","host":"127.0.0.1","port":2333,"authorization":"YOUR_RANDOM_PASSWORD","secure":false}
LAVALINK_NODES=[]
LAVALINK_RESUME_TIMEOUT_SECONDS=120
LAVALINK_REQUEST_TIMEOUT_MS=30000

DATABASE_PATH=./data/music.sqlite
# Blank disables Redis. Local and container deployments can use different URLs.
REDIS_URL=
DOCKER_REDIS_URL=
# Set before enabling Docker Compose's redis profile. Use a URL-safe random hex password.
REDIS_PASSWORD=

LOG_LEVEL=info
LOG_PRETTY=true
DEFAULT_PREFIX=!
EMBED_COLOR="#5865F2"
DEFAULT_LANGUAGE=en
DEFAULT_VOLUME=80
MAX_QUEUE_SIZE=2000
MAX_PLAYLIST_IMPORT=2000
MAX_TRACK_LENGTH_SECONDS=7200
AUTO_LEAVE_TIMEOUT_SECONDS=120
COMMAND_COOLDOWN_MS=1500
CONTROLLER_UPDATE_INTERVAL_MS=10000
IMPORT_CONCURRENCY=3
SUPPORT_URL=

HEALTH_PORT=3000
MEDIA_BRIDGE_PORT=3001
MEDIA_BRIDGE_BIND=127.0.0.1
# Must be reachable from every Lavalink node; compose replaces this with http://bot:3001.
MEDIA_BRIDGE_PUBLIC_URL=http://127.0.0.1:3001
MEDIA_MAX_BYTES=104857600
MEDIA_REQUEST_TIMEOUT_MS=30000

# Booleans use true/false. Sources requiring credentials remain disabled until configured.
SOURCE_COUNTRY_CODE=PH
SPOTIFY_ENABLED=false
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
# Optional lyrics cookie and operator-managed HTTPS anonymous-token service.
SPOTIFY_SP_DC=
SPOTIFY_TOKEN_ENDPOINT=
APPLE_MUSIC_ENABLED=false
APPLE_MUSIC_TOKEN=
# The bot's public Deezer metadata adapter does not require these playback credentials.
# These enable the optional LavaSrc direct Deezer source only.
DEEZER_ENABLED=false
DEEZER_ARL=
DEEZER_MASTER_DECRYPTION_KEY=
YANDEX_MUSIC_ENABLED=false
YANDEX_MUSIC_ACCESS_TOKEN=

# OAuth without a refresh token initiates a device flow in Lavalink's logs.
# TV is included as the last YouTube client for OAuth playback fallback.
YOUTUBE_OAUTH_ENABLED=false
YOUTUBE_OAUTH_REFRESH_TOKEN=
YOUTUBE_OAUTH_SKIP_INITIALIZATION=false
# Provide BOTH values when using poToken. Docker bootstrap binds them only when nonempty.
YOUTUBE_PO_TOKEN=
YOUTUBE_VISITOR_DATA=
# Off by default; guilds may opt into sponsor skipping when globally permitted.
SPONSORBLOCK_ENABLED=false

# Lavalink-only configuration, also passed by Compose.
LAVALINK_JAVA_OPTIONS=-Xms128m -Xmx512m
YOUTUBE_PLAYLIST_PAGES=20
SPOTIFY_PLAYLIST_PAGES=20
SPOTIFY_ALBUM_PAGES=40
APPLE_MUSIC_PLAYLIST_PAGES=7
APPLE_MUSIC_ALBUM_PAGES=7
YANDEX_PLAYLIST_PAGES=20
YANDEX_ALBUM_PAGES=40
YANDEX_ARTIST_PAGES=10
YOUTUBE_LYRICS_ENABLED=true
SPOTIFY_LYRICS_ENABLED=false
DEEZER_LYRICS_ENABLED=false
YANDEX_LYRICS_ENABLED=false
# Set higher if your VPS needs more time to load source metadata.
LAVALINK_SOURCE_SOCKET_TIMEOUT_MS=30000
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/config/env.ts

````typescript
import { config as loadDotenv } from 'dotenv';
import { isIP } from 'node:net';
import { z } from 'zod';

const blankToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalText = z.preprocess(blankToUndefined, z.string().trim().optional());
const snowflake = z.string().regex(/^\d{17,20}$/, 'Use a Discord snowflake ID.');
const placeholder = /^(?:replace(?:_|-)|change(?:me|_|-)|your(?:_|-)|example(?:_|-))/i;
const secret = z
  .string()
  .trim()
  .min(16)
  .refine((value) => !placeholder.test(value), {
    message: 'Replace the example value with your own secret.',
  });
const token = secret.min(50).regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, {
  message: 'Use a Discord bot token from the Developer Portal.',
});
const optionalSecret = z.preprocess(blankToUndefined, secret.optional());
const optionalSnowflake = z.preprocess(blankToUndefined, snowflake.optional());
const integer = (fallback: number, min: number, max: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().int().min(min).max(max).default(fallback));
const boolean = (fallback: boolean) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? blankToUndefined(value.trim().toLowerCase()) : value),
    z
      .enum(['true', 'false'])
      .default(fallback ? 'true' : 'false')
      .transform((value) => value === 'true'),
  );
const json = <T>(schema: z.ZodType<T>, fallback: string) =>
  z
    .preprocess(blankToUndefined, z.string().default(fallback))
    .transform((value, context): unknown => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        context.addIssue({ code: 'custom', message: 'Use valid JSON; values are not logged.' });
        return z.NEVER;
      }
    })
    .pipe(schema);
const hostname = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .refine(
    (value) =>
      isIP(value) !== 0 ||
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(
        value,
      ),
    'Use a hostname or IP address without a scheme, path, or port.',
  );
const httpsUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
}, 'Use an HTTPS URL without credentials.');

export const lavalinkNodeSchema = z.strictObject({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  host: hostname,
  port: z.number().int().min(1).max(65_535).default(2333),
  authorization: secret,
  secure: z.boolean().default(false),
  retryAmount: z.number().int().min(1).max(1000).default(100),
  retryDelay: z.number().int().min(1000).max(60_000).default(5000),
});

export type LavalinkNodeConfig = z.infer<typeof lavalinkNodeSchema>;

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DISCORD_TOKEN: token,
    DISCORD_CLIENT_ID: snowflake,
    DISCORD_GUILD_ID: optionalSnowflake,
    OWNER_IDS: z
      .string()
      .default('')
      .transform((value) => [
        ...new Set(
          value
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ])
      .pipe(z.array(snowflake).max(20)),
    EXTRA_BOT_TOKENS: json(z.array(token).max(10), '[]').refine(
      (values) => new Set(values).size === values.length,
      'Extra bot tokens must be unique.',
    ),
    SHARD_COUNT: z
      .union([z.literal('auto'), z.coerce.number().int().min(1).max(1000)])
      .default('auto'),
    LAVALINK_HOST: hostname.default('127.0.0.1'),
    LAVALINK_PORT: integer(2333, 1, 65_535),
    LAVALINK_PASSWORD: optionalSecret,
    LAVALINK_SECURE: boolean(false),
    LAVALINK_NODES: json(z.array(lavalinkNodeSchema).max(20), '[]'),
    LAVALINK_RESUME_TIMEOUT_SECONDS: integer(120, 30, 3600),
    LAVALINK_REQUEST_TIMEOUT_MS: integer(30_000, 1000, 120_000),
    DATABASE_PATH: z.preprocess(blankToUndefined, z.string().min(1).default('./data/music.sqlite')),
    REDIS_URL: z.preprocess(
      blankToUndefined,
      z
        .url()
        .refine((value) => ['redis:', 'rediss:'].includes(new URL(value).protocol), {
          message: 'Use a redis:// or rediss:// URL.',
        })
        .optional(),
    ),
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
      .default('info'),
    LOG_PRETTY: boolean(true),
    DEFAULT_PREFIX: z
      .string()
      .trim()
      .min(1)
      .max(10)
      .refine(
        (value) => !/[\s@<>`]/.test(value),
        'Use a prefix without whitespace, mentions, or backticks.',
      )
      .default('!'),
    EMBED_COLOR: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#5865F2'),
    DEFAULT_LANGUAGE: z.enum(['en', 'tl']).default('en'),
    DEFAULT_VOLUME: integer(80, 1, 200),
    MAX_QUEUE_SIZE: integer(2000, 5, 10_000),
    MAX_PLAYLIST_IMPORT: integer(2000, 5, 10_000),
    MAX_TRACK_LENGTH_SECONDS: integer(7200, 30, 86_400),
    AUTO_LEAVE_TIMEOUT_SECONDS: integer(120, 10, 86_400),
    COMMAND_COOLDOWN_MS: integer(1500, 100, 60_000),
    CONTROLLER_UPDATE_INTERVAL_MS: integer(10_000, 10_000, 60_000),
    IMPORT_CONCURRENCY: integer(3, 1, 8),
    HEALTH_PORT: integer(3000, 1, 65_535),
    MEDIA_BRIDGE_PORT: integer(3001, 1, 65_535),
    MEDIA_BRIDGE_BIND: hostname.default('127.0.0.1'),
    MEDIA_BRIDGE_PUBLIC_URL: z.preprocess(
      blankToUndefined,
      z
        .url()
        .refine((value) => {
          const url = new URL(value);
          return (
            ['http:', 'https:'].includes(url.protocol) &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash &&
            url.pathname === '/'
          );
        }, 'Use an HTTP(S) origin without credentials, path, query, or fragment.')
        .default('http://127.0.0.1:3001'),
    ),
    MEDIA_MAX_BYTES: integer(100 * 1024 * 1024, 1024, 1024 * 1024 * 1024),
    MEDIA_REQUEST_TIMEOUT_MS: integer(30_000, 1000, 120_000),
    SUPPORT_URL: z.preprocess(blankToUndefined, httpsUrl.optional()),
    SOURCE_COUNTRY_CODE: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .default('PH'),
    SPOTIFY_ENABLED: boolean(false),
    SPOTIFY_CLIENT_ID: optionalText,
    SPOTIFY_CLIENT_SECRET: optionalSecret,
    SPOTIFY_SP_DC: optionalText,
    SPOTIFY_TOKEN_ENDPOINT: z.preprocess(blankToUndefined, httpsUrl.optional()),
    APPLE_MUSIC_ENABLED: boolean(false),
    APPLE_MUSIC_TOKEN: optionalText,
    DEEZER_ENABLED: boolean(false),
    DEEZER_ARL: optionalText,
    DEEZER_MASTER_DECRYPTION_KEY: optionalText,
    YANDEX_MUSIC_ENABLED: boolean(false),
    YANDEX_MUSIC_ACCESS_TOKEN: optionalText,
    YOUTUBE_OAUTH_ENABLED: boolean(false),
    YOUTUBE_OAUTH_REFRESH_TOKEN: optionalText,
    YOUTUBE_OAUTH_SKIP_INITIALIZATION: boolean(false),
    YOUTUBE_PO_TOKEN: optionalText,
    YOUTUBE_VISITOR_DATA: optionalText,
    SPONSORBLOCK_ENABLED: boolean(false),
    YOUTUBE_PLAYLIST_PAGES: integer(20, 1, 100),
    SPOTIFY_PLAYLIST_PAGES: integer(20, 1, 100),
    SPOTIFY_ALBUM_PAGES: integer(40, 1, 200),
    APPLE_MUSIC_PLAYLIST_PAGES: integer(7, 1, 100),
    APPLE_MUSIC_ALBUM_PAGES: integer(7, 1, 100),
    YANDEX_PLAYLIST_PAGES: integer(20, 1, 100),
    YANDEX_ALBUM_PAGES: integer(40, 1, 200),
    YANDEX_ARTIST_PAGES: integer(10, 1, 100),
    YOUTUBE_LYRICS_ENABLED: boolean(true),
    SPOTIFY_LYRICS_ENABLED: boolean(false),
    DEEZER_LYRICS_ENABLED: boolean(false),
    YANDEX_LYRICS_ENABLED: boolean(false),
    LAVALINK_SOURCE_SOCKET_TIMEOUT_MS: integer(30_000, 1000, 120_000),
  })
  .superRefine((value, context) => {
    const issue = (key: string, message: string) =>
      context.addIssue({ code: 'custom', path: [key], message });
    if (value.LAVALINK_NODES.length === 0 && !value.LAVALINK_PASSWORD) {
      issue('LAVALINK_PASSWORD', 'Set a Lavalink password or provide LAVALINK_NODES.');
    }
    if (new Set(value.LAVALINK_NODES.map((node) => node.id)).size !== value.LAVALINK_NODES.length) {
      issue('LAVALINK_NODES', 'Each node needs a unique ID.');
    }
    if (value.EXTRA_BOT_TOKENS.includes(value.DISCORD_TOKEN)) {
      issue('EXTRA_BOT_TOKENS', 'Do not repeat the primary bot token.');
    }
    if (value.HEALTH_PORT === value.MEDIA_BRIDGE_PORT) {
      issue('MEDIA_BRIDGE_PORT', 'Health and media bridge ports must differ.');
    }
    if (value.MAX_PLAYLIST_IMPORT > value.MAX_QUEUE_SIZE) {
      issue('MAX_PLAYLIST_IMPORT', 'The import limit must not exceed the queue limit.');
    }
    if (value.SPOTIFY_ENABLED && (!value.SPOTIFY_CLIENT_ID || !value.SPOTIFY_CLIENT_SECRET)) {
      issue('SPOTIFY_ENABLED', 'Enable Spotify only after setting its client ID and secret.');
    }
    if (value.APPLE_MUSIC_ENABLED && !value.APPLE_MUSIC_TOKEN) {
      issue(
        'APPLE_MUSIC_TOKEN',
        'Provide an Apple Music media API token when enabling this source.',
      );
    }
    if (value.DEEZER_ENABLED && (!value.DEEZER_ARL || !value.DEEZER_MASTER_DECRYPTION_KEY)) {
      issue(
        'DEEZER_ENABLED',
        'The optional LavaSrc Deezer source requires its ARL and decryption key.',
      );
    }
    if (value.YANDEX_MUSIC_ENABLED && !value.YANDEX_MUSIC_ACCESS_TOKEN) {
      issue('YANDEX_MUSIC_ACCESS_TOKEN', 'Provide a Yandex token when enabling this source.');
    }
    if (value.SPOTIFY_LYRICS_ENABLED && !value.SPOTIFY_SP_DC) {
      issue('SPOTIFY_SP_DC', 'Spotify lyrics require an explicitly configured cookie.');
    }
    if (value.DEEZER_LYRICS_ENABLED && !value.DEEZER_ARL) {
      issue('DEEZER_ARL', 'Deezer lyrics require an explicitly configured ARL.');
    }
    if (value.YANDEX_LYRICS_ENABLED && !value.YANDEX_MUSIC_ACCESS_TOKEN) {
      issue('YANDEX_MUSIC_ACCESS_TOKEN', 'Yandex lyrics require an explicitly configured token.');
    }
    if (Boolean(value.YOUTUBE_PO_TOKEN) !== Boolean(value.YOUTUBE_VISITOR_DATA)) {
      issue('YOUTUBE_PO_TOKEN', 'Set both poToken and visitorData, or leave both empty.');
    }
    if (
      value.YOUTUBE_OAUTH_ENABLED &&
      value.YOUTUBE_OAUTH_SKIP_INITIALIZATION &&
      !value.YOUTUBE_OAUTH_REFRESH_TOKEN
    ) {
      issue(
        'YOUTUBE_OAUTH_REFRESH_TOKEN',
        'Skipping OAuth initialization requires a refresh token.',
      );
    }
  });

export class ConfigurationError extends Error {
  constructor(
    issues: ReadonlyArray<{ path: readonly PropertyKey[]; message: string; code?: string }>,
  ) {
    super(
      `Invalid configuration:\n${issues.map((issue) => `- ${issue.path.map(String).join('.')}: ${issue.code === 'unrecognized_keys' ? 'Remove unrecognized configuration keys.' : issue.message}`).join('\n')}\nSee .env.example. Secret values are never included.`,
    );
    this.name = 'ConfigurationError';
  }
}

export type Env = z.infer<typeof envSchema> & { lavalinkNodes: LavalinkNodeConfig[] };

/** Pure parser: safe to use in tests without reading .env or contacting services. */
export function parseEnv(source: Readonly<Record<string, string | undefined>>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) throw new ConfigurationError(result.error.issues);
  const values = result.data;
  const lavalinkNodes =
    values.LAVALINK_NODES.length > 0
      ? values.LAVALINK_NODES
      : [
          lavalinkNodeSchema.parse({
            id: 'primary',
            host: values.LAVALINK_HOST,
            port: values.LAVALINK_PORT,
            authorization: values.LAVALINK_PASSWORD,
            secure: values.LAVALINK_SECURE,
          }),
        ];
  return {
    ...values,
    LOG_PRETTY: values.NODE_ENV === 'development' && values.LOG_PRETTY,
    lavalinkNodes,
  };
}

/** Call at boot; environment variables override .env values. */
export function loadEnv(): Env {
  loadDotenv({ quiet: true });
  return parseEnv(process.env);
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/scripts/check-env.ts

````typescript
import { readFile } from 'node:fs/promises';
import { parseDocument } from 'yaml';
import { ConfigurationError, loadEnv } from '../src/config/env.js';

try {
  const env = loadEnv();
  for (const path of ['docker-compose.yml', 'lavalink/application.yml']) {
    const document = parseDocument(await readFile(path, 'utf8'), { uniqueKeys: true });
    if (document.errors.length > 0) {
      // Parser diagnostics can contain input, so only the filename is reported.
      throw new Error(`Invalid YAML in ${path}.`);
    }
  }
  console.info(`Configuration valid. ${env.lavalinkNodes.length} Lavalink node(s).`);
  console.info(
    `Redis ${env.REDIS_URL ? 'configured' : 'disabled'}; language ${env.DEFAULT_LANGUAGE}.`,
  );
  console.info('This validates local configuration; it does not authenticate or test playback.');
} catch (error) {
  console.error(
    error instanceof ConfigurationError
      ? error.message
      : 'Configuration file validation failed. Check that both YAML files exist and parse correctly.',
  );
  process.exitCode = 1;
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/scripts/healthcheck.ts

````typescript
import { z } from 'zod';

try {
  const port = z.coerce
    .number()
    .int()
    .min(1)
    .max(65_535)
    .parse(process.env.HEALTH_PORT || 3000);
  const response = await fetch(`http://127.0.0.1:${port}/health`, {
    signal: AbortSignal.timeout(4000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Not ready.');
  const body: unknown = await response.json();
  z.object({ status: z.literal('ready') }).parse(body);
} catch {
  console.error('Bot health check failed: the process is not ready.');
  process.exitCode = 1;
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/Dockerfile

````dockerfile
FROM node:24-bookworm-slim AS base
WORKDIR /app

FROM base AS build
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run typecheck && npm run build

FROM base AS production-dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Runtime migration and localization assets; populated in Phases 3 and 6.
COPY src ./src
RUN mkdir -p /app/data /app/media-cache && chown -R node:node /app/data /app/media-cache
USER node
EXPOSE 3000 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["node", "dist/scripts/healthcheck.js"]
CMD ["node", "--enable-source-maps", "dist/index.js"]
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/docker-compose.yml

````yaml
name: discord-music-stream

services:
  bot:
    build:
      context: .
      dockerfile: Dockerfile
      target: runtime
    restart: unless-stopped
    init: true
    env_file:
      - .env
    environment:
      NODE_ENV: production
      LOG_PRETTY: 'false'
      LAVALINK_HOST: lavalink
      LAVALINK_PORT: '2333'
      LAVALINK_SECURE: 'false'
      DATABASE_PATH: /app/data/music.sqlite
      REDIS_URL: '${DOCKER_REDIS_URL:-}'
      HEALTH_PORT: '3000'
      MEDIA_BRIDGE_PORT: '3001'
      MEDIA_BRIDGE_BIND: 0.0.0.0
      MEDIA_BRIDGE_PUBLIC_URL: http://bot:3001
    depends_on:
      lavalink:
        condition: service_healthy
    volumes:
      - bot-data:/app/data
      - bot-media:/app/media-cache
    expose:
      - '3000'
      - '3001'
    read_only: true
    tmpfs:
      - /tmp:size=128m
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    stop_grace_period: 20s
    healthcheck:
      test: ['CMD', 'node', 'dist/scripts/healthcheck.js']
      interval: 30s
      timeout: 5s
      start_period: 60s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: '3'
    networks:
      - music

  lavalink:
    build:
      context: .
      dockerfile: lavalink/Dockerfile
    restart: unless-stopped
    environment:
      LAVALINK_PASSWORD: '${LAVALINK_PASSWORD:?Set LAVALINK_PASSWORD in .env}'
      JAVA_TOOL_OPTIONS: '${LAVALINK_JAVA_OPTIONS:--Xms128m -Xmx512m}'
      SOURCE_COUNTRY_CODE: '${SOURCE_COUNTRY_CODE:-PH}'
      SPOTIFY_ENABLED: '${SPOTIFY_ENABLED:-false}'
      SPOTIFY_CLIENT_ID: '${SPOTIFY_CLIENT_ID:-}'
      SPOTIFY_CLIENT_SECRET: '${SPOTIFY_CLIENT_SECRET:-}'
      SPOTIFY_SP_DC: '${SPOTIFY_SP_DC:-}'
      SPOTIFY_TOKEN_ENDPOINT: '${SPOTIFY_TOKEN_ENDPOINT:-}'
      APPLE_MUSIC_ENABLED: '${APPLE_MUSIC_ENABLED:-false}'
      APPLE_MUSIC_TOKEN: '${APPLE_MUSIC_TOKEN:-}'
      DEEZER_ENABLED: '${DEEZER_ENABLED:-false}'
      DEEZER_ARL: '${DEEZER_ARL:-}'
      DEEZER_MASTER_DECRYPTION_KEY: '${DEEZER_MASTER_DECRYPTION_KEY:-}'
      YANDEX_MUSIC_ENABLED: '${YANDEX_MUSIC_ENABLED:-false}'
      YANDEX_MUSIC_ACCESS_TOKEN: '${YANDEX_MUSIC_ACCESS_TOKEN:-}'
      YOUTUBE_OAUTH_ENABLED: '${YOUTUBE_OAUTH_ENABLED:-false}'
      YOUTUBE_OAUTH_REFRESH_TOKEN: '${YOUTUBE_OAUTH_REFRESH_TOKEN:-}'
      YOUTUBE_OAUTH_SKIP_INITIALIZATION: '${YOUTUBE_OAUTH_SKIP_INITIALIZATION:-false}'
      YOUTUBE_PO_TOKEN: '${YOUTUBE_PO_TOKEN:-}'
      YOUTUBE_VISITOR_DATA: '${YOUTUBE_VISITOR_DATA:-}'
      YOUTUBE_PLAYLIST_PAGES: '${YOUTUBE_PLAYLIST_PAGES:-20}'
      SPOTIFY_PLAYLIST_PAGES: '${SPOTIFY_PLAYLIST_PAGES:-20}'
      SPOTIFY_ALBUM_PAGES: '${SPOTIFY_ALBUM_PAGES:-40}'
      APPLE_MUSIC_PLAYLIST_PAGES: '${APPLE_MUSIC_PLAYLIST_PAGES:-7}'
      APPLE_MUSIC_ALBUM_PAGES: '${APPLE_MUSIC_ALBUM_PAGES:-7}'
      YANDEX_PLAYLIST_PAGES: '${YANDEX_PLAYLIST_PAGES:-20}'
      YANDEX_ALBUM_PAGES: '${YANDEX_ALBUM_PAGES:-40}'
      YANDEX_ARTIST_PAGES: '${YANDEX_ARTIST_PAGES:-10}'
      YOUTUBE_LYRICS_ENABLED: '${YOUTUBE_LYRICS_ENABLED:-true}'
      SPOTIFY_LYRICS_ENABLED: '${SPOTIFY_LYRICS_ENABLED:-false}'
      DEEZER_LYRICS_ENABLED: '${DEEZER_LYRICS_ENABLED:-false}'
      YANDEX_LYRICS_ENABLED: '${YANDEX_LYRICS_ENABLED:-false}'
      LAVALINK_SOURCE_SOCKET_TIMEOUT_MS: '${LAVALINK_SOURCE_SOCKET_TIMEOUT_MS:-30000}'
    volumes:
      - ./lavalink/application.yml:/opt/Lavalink/application.yml:ro
      - lavalink-plugins:/opt/Lavalink/plugins
      - lavalink-logs:/opt/Lavalink/logs
    ports:
      - '127.0.0.1:2333:2333'
    read_only: true
    tmpfs:
      - /tmp:size=256m
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    stop_grace_period: 20s
    healthcheck:
      test:
        - CMD-SHELL
        - 'curl --fail --silent --show-error --max-time 4 -H "Authorization: $${LAVALINK_PASSWORD}" http://127.0.0.1:2333/v4/info > /dev/null'
      interval: 15s
      timeout: 5s
      start_period: 120s
      retries: 5
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: '3'
    networks:
      - music

  redis:
    image: redis:7.4-alpine
    profiles:
      - redis
    restart: unless-stopped
    environment:
      REDIS_PASSWORD: '${REDIS_PASSWORD:-}'
      REDISCLI_AUTH: '${REDIS_PASSWORD:-}'
    command:
      - /bin/sh
      - -ec
      - |
        [ -n "$$REDIS_PASSWORD" ] || { echo 'Set REDIS_PASSWORD before enabling the redis profile.' >&2; exit 1; }
        exec redis-server --appendonly yes --requirepass "$$REDIS_PASSWORD"
    volumes:
      - redis-data:/data
    expose:
      - '6379'
    healthcheck:
      test: ['CMD-SHELL', 'test "$$(redis-cli ping)" = "PONG"']
      interval: 15s
      timeout: 5s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: '3'
    networks:
      - music

networks:
  music:
    driver: bridge

volumes:
  bot-data:
  bot-media:
  lavalink-plugins:
  lavalink-logs:
  redis-data:
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/lavalink/Dockerfile

````dockerfile
FROM ghcr.io/lavalink-devs/lavalink:4.2.2
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /opt/Lavalink/plugins /opt/Lavalink/logs \
    && chown -R 322:322 /opt/Lavalink/plugins /opt/Lavalink/logs
COPY lavalink/bootstrap.sh /opt/Lavalink/bootstrap.sh
RUN chmod 755 /opt/Lavalink/bootstrap.sh
USER 322:322
ENTRYPOINT ["/bin/sh", "/opt/Lavalink/bootstrap.sh"]
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/lavalink/bootstrap.sh

````sh
#!/bin/sh
set -eu

# Only names are printed on configuration errors, never supplied credentials.
fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

require_enabled() {
  case "$1" in
    true) [ -n "$2" ] || fail "Set $3 before enabling its source." ;;
    false) ;;
    *) fail "Source toggles must be true or false; check $3." ;;
  esac
}

ll_password=${LAVALINK_PASSWORD:-}
[ "${#ll_password}" -ge 16 ] || fail 'Set LAVALINK_PASSWORD to at least 16 characters.'
case "$ll_password" in
  replace_*|replace-*|changeme*|your_*|youshallnotpass)
    fail 'Replace the example LAVALINK_PASSWORD with your own random secret.' ;;
esac

require_enabled "${SPOTIFY_ENABLED:-false}" "${SPOTIFY_CLIENT_ID:-}" SPOTIFY_CLIENT_ID
require_enabled "${SPOTIFY_ENABLED:-false}" "${SPOTIFY_CLIENT_SECRET:-}" SPOTIFY_CLIENT_SECRET
require_enabled "${APPLE_MUSIC_ENABLED:-false}" "${APPLE_MUSIC_TOKEN:-}" APPLE_MUSIC_TOKEN
require_enabled "${DEEZER_ENABLED:-false}" "${DEEZER_ARL:-}" DEEZER_ARL
require_enabled "${DEEZER_ENABLED:-false}" "${DEEZER_MASTER_DECRYPTION_KEY:-}" DEEZER_MASTER_DECRYPTION_KEY
require_enabled "${YANDEX_MUSIC_ENABLED:-false}" "${YANDEX_MUSIC_ACCESS_TOKEN:-}" YANDEX_MUSIC_ACCESS_TOKEN
require_enabled "${SPOTIFY_LYRICS_ENABLED:-false}" "${SPOTIFY_SP_DC:-}" SPOTIFY_SP_DC
require_enabled "${DEEZER_LYRICS_ENABLED:-false}" "${DEEZER_ARL:-}" DEEZER_ARL
require_enabled "${YANDEX_LYRICS_ENABLED:-false}" "${YANDEX_MUSIC_ACCESS_TOKEN:-}" YANDEX_MUSIC_ACCESS_TOKEN

# Empty strings must not be bound as real poTokens, refresh tokens, or endpoint URLs.
if [ -n "${YOUTUBE_OAUTH_REFRESH_TOKEN:-}" ]; then
  export PLUGINS_YOUTUBE_OAUTH_REFRESHTOKEN="$YOUTUBE_OAUTH_REFRESH_TOKEN"
elif [ "${YOUTUBE_OAUTH_ENABLED:-false}" = true ] && [ "${YOUTUBE_OAUTH_SKIP_INITIALIZATION:-false}" = true ]; then
  fail 'Set YOUTUBE_OAUTH_REFRESH_TOKEN before skipping OAuth initialization.'
fi

if [ -n "${YOUTUBE_PO_TOKEN:-}" ] || [ -n "${YOUTUBE_VISITOR_DATA:-}" ]; then
  [ -n "${YOUTUBE_PO_TOKEN:-}" ] && [ -n "${YOUTUBE_VISITOR_DATA:-}" ] \
    || fail 'Set both YOUTUBE_PO_TOKEN and YOUTUBE_VISITOR_DATA.'
  export PLUGINS_YOUTUBE_POT_TOKEN="$YOUTUBE_PO_TOKEN"
  export PLUGINS_YOUTUBE_POT_VISITORDATA="$YOUTUBE_VISITOR_DATA"
fi

if [ -n "${SPOTIFY_TOKEN_ENDPOINT:-}" ]; then
  case "$SPOTIFY_TOKEN_ENDPOINT" in
    https://*) export PLUGINS_LAVASRC_SPOTIFY_CUSTOMTOKENENDPOINT="$SPOTIFY_TOKEN_ENDPOINT" ;;
    *) fail 'SPOTIFY_TOKEN_ENDPOINT must use HTTPS.' ;;
  esac
fi

exec java -jar /opt/Lavalink/Lavalink.jar "$@"
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/lavalink/application.yml

````yaml
server:
  port: 2333
  address: 0.0.0.0
  http2:
    enabled: false

lavalink:
  pluginsDir: ./plugins
  plugins:
    - dependency: 'dev.lavalink.youtube:youtube-plugin:1.18.2'
      repository: https://maven.lavalink.dev/releases
      snapshot: false
    - dependency: 'com.github.topi314.lavalyrics:lavalyrics-plugin:1.1.0'
      repository: https://maven.lavalink.dev/releases
      snapshot: false
    - dependency: 'com.github.topi314.lavasrc:lavasrc-plugin:4.8.3'
      repository: https://maven.lavalink.dev/releases
      snapshot: false
    - dependency: 'com.github.topi314.sponsorblock:sponsorblock-plugin:3.0.1'
      repository: https://maven.lavalink.dev/releases
      snapshot: false
  server:
    password: '${LAVALINK_PASSWORD}'
    sources:
      youtube: false
      bandcamp: true
      soundcloud: true
      twitch: true
      vimeo: true
      nico: false
      # Only trusted application-generated media-bridge URLs reach this source.
      http: true
      local: false
    filters:
      volume: true
      equalizer: true
      karaoke: true
      timescale: true
      tremolo: true
      vibrato: true
      distortion: true
      rotation: true
      channelMix: true
      lowPass: true
    nonAllocatingFrameBuffer: false
    bufferDurationMs: 400
    frameBufferDurationMs: 5000
    opusEncodingQuality: 10
    resamplingQuality: MEDIUM
    trackStuckThresholdMs: 10000
    useSeekGhosting: true
    youtubePlaylistLoadLimit: '${YOUTUBE_PLAYLIST_PAGES:20}'
    playerUpdateInterval: 5
    youtubeSearchEnabled: true
    soundcloudSearchEnabled: true
    soundcloudFilterOutPreviewTracks: true
    gc-warnings: true
    timeouts:
      connectTimeoutMs: 10000
      connectionRequestTimeoutMs: 10000
      socketTimeoutMs: '${LAVALINK_SOURCE_SOCKET_TIMEOUT_MS:30000}'

# Plugin configuration belongs at the YAML root, outside lavalink.server.
plugins:
  youtube:
    enabled: true
    allowSearch: true
    allowDirectVideoIds: false
    allowDirectPlaylistIds: false
    clients:
      - MUSIC
      - ANDROID_VR
      - WEB
      - WEBEMBEDDED
      - TV
    oauth:
      enabled: '${YOUTUBE_OAUTH_ENABLED:false}'
      skipInitialization: '${YOUTUBE_OAUTH_SKIP_INITIALIZATION:false}'
      # bootstrap.sh supplies PLUGINS_YOUTUBE_OAUTH_REFRESHTOKEN only when configured.
      # For a standalone JAR with a token, uncomment:
      # refreshToken: '${YOUTUBE_OAUTH_REFRESH_TOKEN}'
    # bootstrap.sh supplies POT_TOKEN/POT_VISITORDATA only when both are nonempty.
    # For a standalone JAR using poToken, uncomment:
    # pot:
    #   token: '${YOUTUBE_PO_TOKEN}'
    #   visitorData: '${YOUTUBE_VISITOR_DATA}'
  lavasrc:
    # The bot applies stricter duration/version matching before playback.
    # These providers are fallback configuration for catalog tracks on Lavalink.
    providers:
      - 'ytmsearch:"%ISRC%"'
      - 'ytsearch:"%ISRC%"'
      - 'ytmsearch:%QUERY%'
      - 'ytsearch:%QUERY%'
      - 'scsearch:%QUERY%'
    sources:
      spotify: '${SPOTIFY_ENABLED:false}'
      applemusic: '${APPLE_MUSIC_ENABLED:false}'
      deezer: '${DEEZER_ENABLED:false}'
      yandexmusic: '${YANDEX_MUSIC_ENABLED:false}'
      youtube: false
      flowerytts: false
      vkmusic: false
      tidal: false
      qobuz: false
      ytdlp: false
      jiosaavn: false
    lyrics-sources:
      spotify: '${SPOTIFY_LYRICS_ENABLED:false}'
      youtube: '${YOUTUBE_LYRICS_ENABLED:true}'
      deezer: '${DEEZER_LYRICS_ENABLED:false}'
      yandexmusic: '${YANDEX_LYRICS_ENABLED:false}'
      vkmusic: false
      lrcLib: true
    spotify:
      clientId: '${SPOTIFY_CLIENT_ID:}'
      clientSecret: '${SPOTIFY_CLIENT_SECRET:}'
      spDc: '${SPOTIFY_SP_DC:}'
      countryCode: '${SOURCE_COUNTRY_CODE:PH}'
      playlistLoadLimit: '${SPOTIFY_PLAYLIST_PAGES:20}'
      albumLoadLimit: '${SPOTIFY_ALBUM_PAGES:40}'
      resolveArtistsInSearch: false
      localFiles: false
      preferPartnerApi: false
      preferV1SearchApi: false
      # bootstrap.sh binds CUSTOMTOKENENDPOINT only when a URL is provided.
    applemusic:
      countryCode: '${SOURCE_COUNTRY_CODE:PH}'
      mediaAPIToken: '${APPLE_MUSIC_TOKEN:}'
      playlistLoadLimit: '${APPLE_MUSIC_PLAYLIST_PAGES:7}'
      albumLoadLimit: '${APPLE_MUSIC_ALBUM_PAGES:7}'
    deezer:
      arl: '${DEEZER_ARL:}'
      masterDecryptionKey: '${DEEZER_MASTER_DECRYPTION_KEY:}'
      formats: ['MP3_320', 'MP3_128']
    yandexmusic:
      accessToken: '${YANDEX_MUSIC_ACCESS_TOKEN:}'
      playlistLoadLimit: '${YANDEX_PLAYLIST_PAGES:20}'
      albumLoadLimit: '${YANDEX_ALBUM_PAGES:40}'
      artistLoadLimit: '${YANDEX_ARTIST_PAGES:10}'
    youtube:
      countryCode: '${SOURCE_COUNTRY_CODE:PH}'
      language: en
  lavalyrics:
    sources:
      - youtube
      - spotify
      - deezer
      - yandexmusic
      # LavaSrc's LRCLIB provider participates as a fallback.

# SponsorBlock is installed but inactive until categories are enabled on a player.
metrics:
  prometheus:
    enabled: false
    endpoint: /metrics

logging:
  level:
    root: INFO
    lavalink: INFO
    dev.lavalink.youtube.http.YoutubeOauth2Handler: INFO
  file:
    path: ./logs
  request:
    enabled: false
    includeHeaders: false
    includeQueryString: false
    includePayload: false
  logback:
    rollingpolicy:
      max-file-size: 10MB
      max-history: 7
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/docs/phase-1-overview.md

````markdown
# Phase 1: Project overview, folder tree, and dependencies

This project will implement a self-hosted Discord music bot in strict TypeScript, with slash commands, prefix commands, a shared command execution layer, persistent settings, and an interactive Now Playing controller. Files will be written into this workspace and printed in full as their implementation phase is delivered.

Phase 1 defines the implementation. The bot is not implemented or runnable yet. Subsequent phases will supply working code, migrations, deployment configuration, tests, and the final README.

## Architecture

1. Discord messages, slash commands, and controller interactions enter a shared command context. Argument parsing, cooldowns, blacklist checks, voice membership, DJ permissions, and guild restrictions run before command execution.
2. SourceResolver loads catalog metadata and playable sources. Spotify and Apple Music metadata is mirrored to playable YouTube, YouTube Music, or SoundCloud tracks. Deezer and Yandex receive source-specific adapters rather than being assumed to behave like Spotify.
3. MirrorMatcher rejects previews and candidates outside the requested duration tolerance, scores title and artist similarity, prefers official audio, and excludes unrequested alternate versions. No preview URL is used as a fallback. If no acceptable full-track match exists, the bot reports that the track is unavailable.
4. QueueManager owns queue edits, ordering, undo, deduplication, limits, and persistence. PlayerManager adapts that state to Lavalink and serializes player mutations so rapid commands cannot race.
5. SQLite stores settings, favorites, playlists, history, queue snapshots, and blacklists. Repository interfaces keep application logic independent of the SQLite driver; a PostgreSQL implementation requires its own schema, migrations, and repository adapter.
6. Event handlers coordinate track transitions, playback failures, voice changes, recovery, and announcements. UI builders produce embeds and components with expiring, authorized interaction sessions and message edits coalesced into approximately ten-second progress updates.

The audio client will be **lavalink-client**. Its documented Discord gateway integration, player events, queue-store extension points, and disconnect options fit this project. The application will add durable snapshots and recovery coordination around those APIs. See the [official lavalink-client README](https://github.com/Tomato6966/lavalink-client/blob/main/README.md).

LavaSrc exposes preview information as well as catalog metadata. Preview rejection will explicitly check those fields, and application-side matching will enforce the duration and version rules before a mirror is queued. See the [official LavaSrc documentation](https://github.com/topi314/LavaSrc).

Session resumption covers a temporary client connection loss while a Lavalink session survives. A Lavalink process restart requires rebuilding players from persisted state. Recovery will distinguish those cases and preserve queue order, current track, position, pause state, volume, filters, loop mode, and unfinished import jobs. See the [Lavalink session API](https://lavalink.dev/api/rest#update-session).

## Defaults and command decisions

| Setting                              | Default                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------- |
| Application name                     | Discord Music Stream                                                    |
| Runtime compatibility                | Node.js 20.19+; Docker uses Node.js 24                                  |
| Prefix                               | `!`, plus mention prefix                                                |
| Theme                                | `#5865F2`                                                               |
| Language                             | English; Tagalog example included                                       |
| Initial volume                       | 80%, configurable from 1% to 200%                                       |
| Queue size                           | 2,000 tracks per player                                                 |
| Playlist import limit                | 2,000 tracks per import                                                 |
| Maximum finite track length          | 2 hours, configurable                                                   |
| Live streams                         | Allowed; seeking and finite-duration limits do not apply                |
| Initial playlist resolution batch    | First 5 tracks; remaining mirrors resolve in bounded background batches |
| Mirror duration tolerance            | At most 10 seconds shorter or longer than catalog duration              |
| Voice auto-leave timeout             | 120 seconds when idle or empty                                          |
| 24/7 mode                            | Off                                                                     |
| Autoplay                             | Off                                                                     |
| Loop                                 | Off                                                                     |
| Vote-skip                            | Off; 50% of eligible human listeners when enabled, rounded up           |
| Now Playing announcements            | On                                                                      |
| Controller progress updates          | Approximately every 10 seconds while playing                            |
| Search selection timeout             | 60 seconds                                                              |
| Queue/help/lyrics pagination timeout | 120 seconds                                                             |
| Queue undo depth                     | 20 mutations                                                            |
| Clean mode                           | Off; deletes the bot's own command responses after a configurable delay |
| SponsorBlock                         | Off; opt-in sponsor segments only                                       |
| Redis                                | Optional cache and coordination support; SQLite remains durable storage |
| Extra bot tokens                     | Optional; each player and snapshot is scoped by bot ID and guild ID     |

`move` has two forms: `/move` or `!move` joins the invoker's voice channel; `/move from:2 to:5` or `!move 2 5` moves a queue entry. `skipto` and `jump` share one operation. `playnow` accepts the `forceplay` prefix alias. Other prefix aliases map to the same command executor as their slash command.

Current source capabilities and credentials will be documented accurately. Large imports lazily resolve playable mirrors; the initial metadata request can still take time when an upstream Lavalink source returns an aggregated playlist. Stage channels require permission to speak or moderator approval. Local attachments mean uploaded audio, not arbitrary filesystem paths.

Direct audio and attachment requests will pass through a bounded media bridge that validates public destinations, pins validated DNS addresses during fetching, and revalidates redirects. User-supplied internal URLs and local paths will be rejected. Lavalink's local-file source will remain disabled.

## Planned folder tree

This is the complete planned source layout. Only this Phase 1 document exists at this stage. Generated artifacts are identified below the tree.

```text
discord-music-stream/
  .dockerignore
  .env.example
  .gitignore
  .prettierignore
  .prettierrc.json
  Dockerfile
  docker-compose.yml
  package.json
  tsconfig.json
  tsup.config.ts
  vitest.config.ts
  eslint.config.mjs
  drizzle.config.ts
  ecosystem.config.cjs
  README.md
  docs/
    phase-1-overview.md
  lavalink/
    application.yml
  scripts/
    register-commands.ts
    migrate.ts
    healthcheck.ts
  src/
    index.ts
    bot.ts
    shard.ts
    types.ts
    config/
      env.ts
    framework/
      Command.ts
      CommandContext.ts
      CommandRegistry.ts
      CommandHandler.ts
      ArgumentParser.ts
      InteractionRouter.ts
    commands/
      playback/
        play.ts
        playnext.ts
        playnow.ts
        search.ts
        pause.ts
        resume.ts
        stop.ts
        skip.ts
        skipto.ts
        previous.ts
        replay.ts
        seek.ts
        forward.ts
        rewind.ts
        join.ts
        leave.ts
      queue/
        queue.ts
        nowplaying.ts
        remove.ts
        move.ts
        swap.ts
        clear.ts
        shuffle.ts
        undo.ts
        dedupe.ts
        loop.ts
        autoplay.ts
      audio/
        volume.ts
        bassboost.ts
        nightcore.ts
        vaporwave.ts
        eightd.ts
        karaoke.ts
        tremolo.ts
        vibrato.ts
        rotation.ts
        lowpass.ts
        equalizer.ts
        filters.ts
        speed.ts
        pitch.ts
        rate.ts
      extras/
        lyrics.ts
        grab.ts
        favorites.ts
        playlists.ts
        history.ts
        stats.ts
        ping.ts
        help.ts
        invite.ts
        support.ts
        about.ts
      admin/
        settings.ts
        prefix.ts
        djrole.ts
        musicchannel.ts
        stay.ts
        defaultvolume.ts
        voteskip.ts
        announce.ts
        autoleave.ts
        language.ts
        clean.ts
        maxqueue.ts
        maxtracklength.ts
        sponsorblock.ts
        blacklist.ts
    events/
      ready.ts
      interactionCreate.ts
      messageCreate.ts
      voiceStateUpdate.ts
      trackStart.ts
      trackEnd.ts
      queueEnd.ts
      trackError.ts
      trackStuck.ts
      playerDisconnect.ts
      nodeEvents.ts
    lib/
      music/
        PlayerManager.ts
        QueueManager.ts
        SourceResolver.ts
        MirrorMatcher.ts
        FilterPresets.ts
        ProgressBar.ts
        AutoplayEngine.ts
        ImportScheduler.ts
        RecoveryManager.ts
        LyricsService.ts
        Track.ts
        sources/
          SourceCatalog.ts
          SpotifyCatalog.ts
          DeezerCatalog.ts
          YandexCatalog.ts
      db/
        client.ts
        schema.ts
        migrate.ts
        contracts.ts
        migrations/
          0000_initial.sql
          meta/
            _journal.json
            0000_snapshot.json
        repositories/
          guildSettings.ts
          userFavorites.ts
          playlists.ts
          history.ts
          queueSnapshots.ts
          blacklist.ts
      cache/
        Cache.ts
        MemoryCache.ts
        RedisCache.ts
      ui/
        embeds.ts
        components.ts
        paginator.ts
        NowPlayingController.ts
        SearchController.ts
        MessageEditor.ts
      utils/
        time.ts
        permissions.ts
        cooldowns.ts
        logger.ts
        i18n.ts
        errors.ts
        AsyncLock.ts
      security/
        UrlGuard.ts
        SafeHttpClient.ts
        MediaBridge.ts
    advanced/
      MultiBotCoordinator.ts
    locales/
      en.json
      tl.json
  tests/
    time.test.ts
    progress-bar.test.ts
    mirror-matcher.test.ts
    queue-manager.test.ts
    permissions.test.ts
    argument-parser.test.ts
    url-guard.test.ts
    recovery.test.ts
    fixtures.ts
  .github/
    workflows/
      ci.yml
```

`package-lock.json` will be generated by npm and committed for reproducible installation. `node_modules/`, `dist/`, `coverage/`, SQLite database files, media-cache files, Lavalink plugin downloads, and logs are generated runtime/build artifacts and will be ignored. Drizzle's migration metadata will be generated alongside the initial migration.

## Dependency list

The following npm versions were checked against registry metadata before this phase was written. Phase 2 will pin dependencies and generate the lockfile. Engine compatibility has been inspected; installation, type checking, and integration compatibility remain to be verified during implementation.

| Runtime package   | Version   | Purpose                                                             |
| ----------------- | --------- | ------------------------------------------------------------------- |
| `discord.js`      | `14.27.0` | Discord gateway, REST, slash builders, embeds, components, sharding |
| `lavalink-client` | `2.11.0`  | Lavalink v4 nodes, players, search, filters, events                 |
| `better-sqlite3`  | `12.11.1` | SQLite driver                                                       |
| `drizzle-orm`     | `0.45.4`  | Typed SQL schema and queries                                        |
| `dotenv`          | `18.0.7`  | Environment-file loading                                            |
| `zod`             | `4.6.6`   | Environment, persisted-state, and argument validation               |
| `pino`            | `10.4.0`  | Structured logging                                                  |
| `ioredis`         | `6.0.0`   | Optional Redis adapter                                              |
| `ipaddr.js`       | `2.5.0`   | IPv4/IPv6 address classification for URL protection                 |

| Development package     | Version    | Purpose                                      |
| ----------------------- | ---------- | -------------------------------------------- |
| `typescript`            | `5.9.3`    | Strict type checking                         |
| `tsx`                   | `4.23.15`  | Development runner and maintenance scripts   |
| `tsup`                  | `8.5.1`    | Production builds                            |
| `vitest`                | `3.2.7`    | Unit and recovery tests                      |
| `eslint`                | `9.39.5`   | ESLint flat configuration                    |
| `@eslint/js`            | `9.39.5`   | Core recommended ESLint rules                |
| `typescript-eslint`     | `8.71.1`   | TypeScript lint rules                        |
| `prettier`              | `3.9.10`   | Formatting                                   |
| `pino-pretty`           | `13.2.0`   | Readable development logs                    |
| `drizzle-kit`           | `0.31.11`  | Migration generation and schema tooling      |
| `@types/node`           | `20.19.43` | Node.js API types at the compatibility floor |
| `@types/better-sqlite3` | `9.6.0`    | SQLite driver types                          |

Lavalink runs as a separate service. These server components are not npm dependencies:

| Component           | Version            | Purpose and source                                                                                                   |
| ------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Lavalink            | `4.2.2`            | Audio service; [official release](https://github.com/lavalink-devs/Lavalink/releases/tag/4.2.2)                      |
| LavaSrc             | `4.8.3`            | Additional catalog sources; [official release](https://github.com/topi314/LavaSrc/releases/tag/4.8.3)                |
| youtube-source      | `1.18.2`           | YouTube playback and search; [official release](https://github.com/lavalink-devs/youtube-source/releases/tag/1.18.2) |
| LavaLyrics          | `1.1.0`            | Lyrics REST API and synced events; [official release](https://github.com/topi314/LavaLyrics/releases/tag/1.1.0)      |
| SponsorBlock plugin | `3.0.1`            | Optional segment skipping; [official release](https://github.com/topi314/Sponsorblock-Plugin/releases/tag/3.0.1)     |
| Redis               | `7.4` image series | Optional Docker Compose profile                                                                                      |

YouTube OAuth and poToken settings will be exposed as optional environment configuration and explained using the [youtube-source authentication documentation](https://github.com/lavalink-devs/youtube-source#using-oauth-tokens). Availability depends on upstream services, account permissions, and region restrictions; unavailable sources will produce actionable errors.

## Delivery and verification

The remaining phases follow the requested order: configuration and deployment; database; music engine; command framework and commands; events and UI; tests; README.

The final verification will run installation, strict TypeScript checking, ESLint, Prettier, Vitest, and the production build. Docker and authenticated Discord/Lavalink playback checks will be run when the required runtime and credentials are available. Any checks that cannot run will be identified explicitly; a successful build will not be presented as proof of live playback.

Phase 1 is complete. Reply `continue` for Phase 2: configuration, environment validation, Docker, and Lavalink setup.
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/docs/phase-2-setup.md

````markdown
# Phase 2: Configuration, tooling, Docker, and Lavalink

Phase 2 supplies working configuration validation, build and lint tooling, a container health-check client, deployment files, and pinned Lavalink plugins. The Discord bot entry point and database schema arrive in later phases. `npm run build` currently builds the configuration tools; `npm start`, migration generation against the application schema, and the bot container become usable after their implementation phases.

## Local configuration

Use Node.js 20.19 or newer. The Docker build uses Node.js 24. The current workspace was checked with Node.js 24.13.0.

In PowerShell:

```powershell
Copy-Item -LiteralPath .env.example -Destination .env
npm ci
```

Edit `.env` and set `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and a random `LAVALINK_PASSWORD`. `DISCORD_GUILD_ID` is optional and will scope command registration to a development server. Generate a Lavalink password with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Then validate:

```powershell
npm run config:check
npm run typecheck
npm run lint
npm run format:check
npm run build
```

The configuration check validates `.env` and parses both YAML files. It does not authenticate with Discord, Spotify, or Lavalink. Invalid configuration reports field names and explanations without printing supplied values. Configuration is loaded explicitly at boot; importing the parser does not read `.env` or contact a service.

Booleans use `true` or `false`. Blank optional credentials and URLs are treated as unset. The embed color is quoted in `.env.example` because dotenv treats an unquoted `#` as the start of a comment. Production logging always disables pretty output.

The application will enforce bounded queue/import sizes, track lengths, source metadata page counts, request timeouts, and import concurrency. The source page settings are separate from the application import cap; source plugins can return more metadata than the bot will accept into the queue.

## Source credentials

YouTube, SoundCloud, Bandcamp, Twitch, and Vimeo are enabled in Lavalink. Its built-in YouTube source is disabled in favor of youtube-source. SoundCloud preview filtering is enabled, and the application resolver will add explicit preview and mirror-duration checks in Phase 4.

To enable Spotify, set `SPOTIFY_ENABLED=true`, `SPOTIFY_CLIENT_ID`, and `SPOTIFY_CLIENT_SECRET`. Apple Music requires `APPLE_MUSIC_ENABLED=true` and `APPLE_MUSIC_TOKEN`. Yandex requires its enable flag and access token. Unsupported or unavailable catalog entries will be reported rather than replaced with previews.

The optional LavaSrc direct Deezer source requires `DEEZER_ARL` and `DEEZER_MASTER_DECRYPTION_KEY`. The bot's Deezer metadata-and-mirroring adapter will work independently of enabling that source. No account credentials or decryption key are distributed with this project.

Spotify, Deezer, and Yandex lyrics are disabled until explicitly configured with their respective cookie/ARL/token. YouTube lyrics and the LavaSrc LRCLIB fallback are enabled. The application lyrics service will also provide an independent fallback.

The configuration follows the upstream [Lavalink server example](https://github.com/lavalink-devs/Lavalink/blob/4.2.2/LavalinkServer/application.yml.example), [LavaSrc source options](https://github.com/topi314/LavaSrc/blob/4.8.3/application.example.yml), and [LavaLyrics setup](https://github.com/topi314/LavaLyrics/blob/1.1.0/README.md).

## YouTube authentication

For OAuth, set `YOUTUBE_OAUTH_ENABLED=true`. With no refresh token, Lavalink initiates the device authorization flow and logs its instructions. After obtaining a refresh token, set `YOUTUBE_OAUTH_REFRESH_TOKEN` and restart Lavalink. Set `YOUTUBE_OAUTH_SKIP_INITIALIZATION=true` only when a refresh token is configured. The TV client is included as a fallback for OAuth-capable playback.

For poToken, provide both `YOUTUBE_PO_TOKEN` and `YOUTUBE_VISITOR_DATA`. Leave both blank when unused. The wrapper exports Spring properties only for nonempty values; this avoids accidentally binding empty strings as actual authentication tokens. The upstream [youtube-source authentication guide](https://github.com/lavalink-devs/youtube-source/blob/1.18.2/README.md#using-oauth-tokens) describes provider limitations and account considerations.

`SPOTIFY_TOKEN_ENDPOINT` optionally points to an operator-managed HTTPS token service. The wrapper binds it only when configured. It is not required for the default client-credential setup; some generated/private catalog data may require additional authorization.

For a standalone Java launch, uncomment the relevant optional token blocks in `application.yml` or set the equivalent `PLUGINS_YOUTUBE_OAUTH_REFRESHTOKEN`, `PLUGINS_YOUTUBE_POT_TOKEN`, `PLUGINS_YOUTUBE_POT_VISITORDATA`, and `PLUGINS_LAVASRC_SPOTIFY_CUSTOMTOKENENDPOINT` environment variables yourself. A standalone JAR does not automatically load the bot's `.env` file. Docker Compose supplies these through the wrapper.

## Docker Compose

Once the bot implementation is complete, start the deployment with:

```powershell
docker compose up --build -d
docker compose logs -f bot lavalink
```

To run Lavalink alone during development:

```powershell
docker compose up --build -d lavalink
```

Compose makes Lavalink available at `127.0.0.1:2333` on the host. The bot container connects using the `lavalink` service hostname. The Lavalink image is pinned to `4.2.2`; the small derived image adds curl for authenticated health checks and the optional-credential wrapper. Plugin downloads and logs use named volumes. The image's UID/GID 322 owns those directories.

The bot runs as the Node image's non-root user. Its filesystem is read-only apart from data/media volumes and `/tmp`. Lavalink also uses a read-only root filesystem with separate writable plugin/log volumes. Both services drop Linux capabilities and enable `no-new-privileges`. SQLite data, queue snapshots, and imported-playlist state will use the persistent bot data volume.

The bot waits for Lavalink's authenticated `/v4/info` health check. Its own health-check client requires an HTTP 200 response containing `{"status":"ready"}` from `/health`; the server for that endpoint arrives with bot bootstrap. Container restarts use `unless-stopped`.

Direct user URLs will be validated and fetched through the application media bridge in Phase 4. Compose advertises that bridge as `http://bot:3001`. When the bot runs on the host and Lavalink runs in Docker Desktop, set `MEDIA_BRIDGE_BIND=0.0.0.0` and `MEDIA_BRIDGE_PUBLIC_URL=http://host.docker.internal:3001`. A remote Lavalink node needs a reachable bridge origin appropriate to that deployment.

Keep the Lavalink REST password private: its HTTP source is intentionally enabled for the media bridge, and an operator with Lavalink API access can request URLs outside the bot's command-validation layer. Local filesystem playback remains disabled.

## Optional Redis

Leave `REDIS_URL` and `DOCKER_REDIS_URL` blank to use the in-memory cache. To enable the Compose Redis profile, set a random, URL-safe hexadecimal `REDIS_PASSWORD` and set:

```dotenv
DOCKER_REDIS_URL=redis://:YOUR_RANDOM_HEX_PASSWORD@redis:6379
```

Replace the placeholder with that password, then run:

```powershell
docker compose --profile redis up --build -d
```

Redis requires a nonempty password when the profile is enabled and has no published host port. Its append-only data is persisted in a named volume. `REDIS_URL` is for a bot running outside Compose; configure it for your separately reachable Redis server. Redis is a cache/coordination option and does not replace durable SQLite storage.

## Multiple nodes and PM2

`LAVALINK_NODES` accepts a JSON array with each node's `id`, `host`, `port`, `authorization`, and `secure` values. Optional `retryAmount` and `retryDelay` default to 100 attempts and five seconds. Node IDs must be unique. When this array is nonempty, it overrides the single-node connection settings for the bot. Compose still needs `LAVALINK_PASSWORD` for its managed local Lavalink service.

When configuring explicit nodes for Compose, use `lavalink` for the included service's host rather than `127.0.0.1`. Other hosts must be reachable from the container. The recovery manager will distinguish reconnecting to a surviving session from recreating a player after a server restart.

`ecosystem.config.cjs` supplies a single-process PM2 deployment with automatic restarts and a 20-second shutdown window. It becomes usable after the bot entry point is built. The later sharding entry will be used for Discord sharding rather than duplicating the same bot with PM2 cluster mode.

## Dependency changes from Phase 1

Installation and auditing identified newer compatible tool versions and affected transitive dependencies. Phase 2 uses Vitest `4.1.11`, Vite `7.3.7`, ESLint `10.12.0`, and `@eslint/js` `10.0.1`. `globals` and `yaml` support the lint and configuration-check tools.

The lockfile overrides esbuild to `0.28.2` and tinypool to `2.1.2`. These replace vulnerable transitive versions without moving the runtime floor beyond Node.js 20.19. A clean `npm ci`, a build, configuration checks, and migration-tool execution were used to check compatibility. The relevant upstream advisories are [Vitest's patched release](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), [tinypool's patched versions](https://github.com/advisories/GHSA-85c8-ppgw-ccpr), and [esbuild's development-server fix](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr).

## Verification boundary

The Phase 2 verification covers installation, strict TypeScript checking, linting, formatting, the configuration-tool build, 21 temporary configuration/health smoke checks, native SQLite loading, migration-tool operation on an isolated fixture, and Compose model validation. The fixture files and downloaded verification JAR live under ignored `data/phase-2-verification/`.

The official Lavalink `4.2.2` JAR was started locally with the project's YAML. It loaded youtube-source `1.18.2`, LavaSrc `4.8.3`, LavaLyrics `1.1.0`, and SponsorBlock `3.0.1`, and returned its authenticated `/v4/info` response. That temporary server was stopped after verification.

The Docker engine is stopped on this host, so image builds and container startup were not tested. Compose syntax was validated with `.env.example` interpolation and `--no-env-resolution`; no actual `.env` file or account credentials were created. Authenticated Discord voice playback, real source resolution, queue restoration, and the permanent test suite remain for later phases.

Phase 2 is complete. Reply `continue` for Phase 3: database schema, migrations, and typed repositories.
````
