/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/lexari.json`.
 */
export type Lexari = {
  "address": "BbnD28xf3kwfQRiRA6VQmw4p2R55WivUgozSoo81M6Po",
  "metadata": {
    "name": "lexari",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Lexari agent registry and memory records"
  },
  "docs": [
    "Agent registry, memory records, and Hub (coins, check-in, quests, levels).",
    "The ID card itself is a Metaplex Core asset."
  ],
  "instructions": [
    {
      "name": "checkIn",
      "discriminator": [
        209,
        253,
        4,
        217,
        250,
        241,
        207,
        50
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "player"
          ]
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "claimQuest",
      "discriminator": [
        38,
        197,
        33,
        123,
        0,
        108,
        206,
        161
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "player"
          ]
        },
        {
          "name": "attestor",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "claim",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "player"
              },
              {
                "kind": "arg",
                "path": "questId"
              },
              {
                "kind": "arg",
                "path": "period"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "questId",
          "type": "u16"
        },
        {
          "name": "period",
          "type": "u32"
        },
        {
          "name": "coins",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claimReferralTier",
      "discriminator": [
        197,
        164,
        29,
        180,
        105,
        249,
        176,
        130
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "player"
          ]
        },
        {
          "name": "attestor",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "claim",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tier",
          "type": "u8"
        }
      ]
    },
    {
      "name": "deleteMemory",
      "discriminator": [
        197,
        189,
        203,
        106,
        20,
        99,
        209,
        134
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "memory"
          ]
        },
        {
          "name": "memory",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  109,
                  111,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "memory.agent",
                "account": "memory"
              },
              {
                "kind": "account",
                "path": "memory.content_hash",
                "account": "memory"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initConfig",
      "discriminator": [
        23,
        235,
        115,
        232,
        168,
        96,
        1,
        231
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "program",
          "address": "BbnD28xf3kwfQRiRA6VQmw4p2R55WivUgozSoo81M6Po"
        },
        {
          "name": "programData"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "authority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initPlayer",
      "discriminator": [
        114,
        27,
        219,
        144,
        50,
        15,
        228,
        66
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "referrerPlayer",
          "optional": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "levelUp",
      "docs": [
        "Spends coins as XP on an agent. Never spends more than it takes to reach the max level."
      ],
      "discriminator": [
        128,
        64,
        197,
        116,
        226,
        129,
        119,
        234
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "player",
            "agent"
          ]
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "agent"
        },
        {
          "name": "asset",
          "relations": [
            "agent"
          ]
        },
        {
          "name": "level",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  118,
                  101,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "coins",
          "type": "u64"
        }
      ]
    },
    {
      "name": "openBox",
      "discriminator": [
        225,
        220,
        10,
        104,
        173,
        151,
        214,
        199
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "player"
          ]
        },
        {
          "name": "attestor",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "claim",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  120
                ]
              },
              {
                "kind": "account",
                "path": "player"
              },
              {
                "kind": "arg",
                "path": "day"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "day",
          "type": "u32"
        },
        {
          "name": "coins",
          "type": "u64"
        }
      ]
    },
    {
      "name": "registerAgent",
      "docs": [
        "Registers the agent record for a Metaplex Core asset. The signer must own the asset."
      ],
      "discriminator": [
        135,
        157,
        66,
        195,
        2,
        113,
        175,
        30
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "asset"
        },
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "role",
          "type": "string"
        },
        {
          "name": "dna",
          "type": "string"
        }
      ]
    },
    {
      "name": "revokeMemory",
      "discriminator": [
        43,
        184,
        66,
        119,
        163,
        164,
        140,
        17
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "memory"
          ]
        },
        {
          "name": "memory",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "syncAgentOwner",
      "docs": [
        "After the ID card (Core asset) changes hands, its new owner takes over the agent record."
      ],
      "discriminator": [
        50,
        57,
        89,
        198,
        215,
        253,
        169,
        226
      ],
      "accounts": [
        {
          "name": "newOwner",
          "signer": true
        },
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset"
              }
            ]
          }
        },
        {
          "name": "asset",
          "relations": [
            "agent"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "updateAgent",
      "discriminator": [
        85,
        2,
        178,
        9,
        119,
        139,
        102,
        164
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "agent"
          ]
        },
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset"
              }
            ]
          }
        },
        {
          "name": "asset",
          "relations": [
            "agent"
          ]
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "role",
          "type": "string"
        },
        {
          "name": "dna",
          "type": "string"
        }
      ]
    },
    {
      "name": "updateConfig",
      "docs": [
        "Rotates the attestor. Only the program upgrade authority can call it."
      ],
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "program",
          "address": "BbnD28xf3kwfQRiRA6VQmw4p2R55WivUgozSoo81M6Po"
        },
        {
          "name": "programData"
        }
      ],
      "args": [
        {
          "name": "authority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "writeMemory",
      "discriminator": [
        230,
        48,
        240,
        225,
        213,
        184,
        250,
        80
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "agent"
          ]
        },
        {
          "name": "agent"
        },
        {
          "name": "asset",
          "relations": [
            "agent"
          ]
        },
        {
          "name": "memory",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  109,
                  111,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              },
              {
                "kind": "arg",
                "path": "contentHash"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "contentHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "uri",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "agent",
      "discriminator": [
        47,
        166,
        112,
        147,
        155,
        197,
        86,
        7
      ]
    },
    {
      "name": "agentLevel",
      "discriminator": [
        11,
        252,
        123,
        44,
        39,
        165,
        103,
        40
      ]
    },
    {
      "name": "boxClaim",
      "discriminator": [
        79,
        28,
        230,
        133,
        205,
        27,
        1,
        114
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "memory",
      "discriminator": [
        14,
        198,
        85,
        183,
        235,
        32,
        242,
        208
      ]
    },
    {
      "name": "player",
      "discriminator": [
        205,
        222,
        112,
        7,
        165,
        155,
        206,
        218
      ]
    },
    {
      "name": "questClaim",
      "discriminator": [
        247,
        137,
        236,
        171,
        161,
        173,
        200,
        231
      ]
    },
    {
      "name": "referralClaim",
      "discriminator": [
        216,
        60,
        207,
        48,
        188,
        213,
        100,
        13
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "badName",
      "msg": "Name is empty or longer than 32 bytes"
    },
    {
      "code": 6001,
      "name": "badRole",
      "msg": "Role is longer than 32 bytes"
    },
    {
      "code": 6002,
      "name": "badDna",
      "msg": "Face DNA is empty or longer than 180 bytes"
    },
    {
      "code": 6003,
      "name": "badUri",
      "msg": "Memory URI is longer than 200 bytes"
    },
    {
      "code": 6004,
      "name": "alreadyRevoked",
      "msg": "That memory is already revoked"
    },
    {
      "code": 6005,
      "name": "alreadyCheckedIn",
      "msg": "Already checked in today"
    },
    {
      "code": 6006,
      "name": "insufficientCoins",
      "msg": "Not enough coins"
    },
    {
      "code": 6007,
      "name": "maxLevel",
      "msg": "Agent is already at max level"
    },
    {
      "code": 6008,
      "name": "badAttestor",
      "msg": "Attestor does not match config authority"
    },
    {
      "code": 6009,
      "name": "selfReferral",
      "msg": "Cannot refer yourself"
    },
    {
      "code": 6010,
      "name": "badTier",
      "msg": "Referral tier is invalid or already claimed"
    },
    {
      "code": 6011,
      "name": "questClaimed",
      "msg": "Quest already claimed for this period"
    },
    {
      "code": 6012,
      "name": "boxOpened",
      "msg": "Mystery box already opened today"
    },
    {
      "code": 6013,
      "name": "zeroSpend",
      "msg": "Level-up spend must be greater than zero"
    },
    {
      "code": 6014,
      "name": "configExists",
      "msg": "Config already initialized"
    },
    {
      "code": 6015,
      "name": "notUpgradeAuthority",
      "msg": "Only the program upgrade authority can change config"
    },
    {
      "code": 6016,
      "name": "notCoreAsset",
      "msg": "Asset is not a Metaplex Core asset"
    },
    {
      "code": 6017,
      "name": "notAssetOwner",
      "msg": "Signer does not own this Core asset"
    },
    {
      "code": 6018,
      "name": "assetMismatch",
      "msg": "Asset account does not match the agent"
    },
    {
      "code": 6019,
      "name": "ownerUnchanged",
      "msg": "Agent owner is already up to date"
    },
    {
      "code": 6020,
      "name": "rewardTooLarge",
      "msg": "Reward is above the per-claim cap"
    }
  ],
  "types": [
    {
      "name": "agent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "role",
            "type": "string"
          },
          {
            "name": "dna",
            "type": "string"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "agentLevel",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "level",
            "type": "u8"
          },
          {
            "name": "xp",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "boxClaim",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "day",
            "type": "u32"
          },
          {
            "name": "coins",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "memory",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "contentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "uri",
            "type": "string"
          },
          {
            "name": "revoked",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "player",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "coins",
            "type": "u64"
          },
          {
            "name": "streak",
            "type": "u16"
          },
          {
            "name": "lastCheckIn",
            "type": "i64"
          },
          {
            "name": "referrer",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "lifetime",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "questClaim",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "questId",
            "type": "u16"
          },
          {
            "name": "period",
            "type": "u32"
          },
          {
            "name": "coins",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "referralClaim",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "tier",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
