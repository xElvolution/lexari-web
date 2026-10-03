use anchor_lang::prelude::*;

#[account]
pub struct Agent {
    pub owner: Pubkey,
    pub asset: Pubkey,
    pub name: String,
    pub role: String,
    pub dna: String,
    pub bump: u8,
}

impl Agent {
    pub const MAX_NAME: usize = 32;
    pub const MAX_ROLE: usize = 32;
    pub const MAX_DNA: usize = 180;
    pub const SIZE: usize = 32 + 32 + 4 + Self::MAX_NAME + 4 + Self::MAX_ROLE + 4 + Self::MAX_DNA + 1;
}

#[account]
pub struct Memory {
    pub owner: Pubkey,
    pub agent: Pubkey,
    pub content_hash: [u8; 32],
    pub uri: String,
    pub revoked: bool,
    pub bump: u8,
}

impl Memory {
    pub const MAX_URI: usize = 200;
    pub const SIZE: usize = 32 + 32 + 32 + 4 + Self::MAX_URI + 1 + 1;
}

#[account]
pub struct Config {
    pub authority: Pubkey,
    pub bump: u8,
}

impl Config {
    pub const SIZE: usize = 32 + 1;
}

#[account]
pub struct Player {
    pub owner: Pubkey,
    pub coins: u64,
    pub streak: u16,
    pub last_check_in: i64,
    pub referrer: Option<Pubkey>,
    pub lifetime: u64,
    pub bump: u8,
}

impl Player {
    pub const SIZE: usize = 32 + 8 + 2 + 8 + 1 + 32 + 8 + 1;
}

#[account]
pub struct AgentLevel {
    pub agent: Pubkey,
    pub owner: Pubkey,
    pub level: u8,
    pub xp: u32,
    pub bump: u8,
}

impl AgentLevel {
    pub const SIZE: usize = 32 + 32 + 1 + 4 + 1;
    pub const MAX_LEVEL: u8 = 10;
}

#[account]
pub struct QuestClaim {
    pub player: Pubkey,
    pub quest_id: u16,
    pub period: u32,
    pub coins: u64,
    pub bump: u8,
}

impl QuestClaim {
    pub const SIZE: usize = 32 + 2 + 4 + 8 + 1;
}

#[account]
pub struct ReferralClaim {
    pub player: Pubkey,
    pub tier: u8,
    pub bump: u8,
}

impl ReferralClaim {
    pub const SIZE: usize = 32 + 1 + 1;
}

#[account]
pub struct BoxClaim {
    pub player: Pubkey,
    pub day: u32,
    pub coins: u64,
    pub bump: u8,
}

impl BoxClaim {
    pub const SIZE: usize = 32 + 4 + 8 + 1;
}

pub const STREAK_PAY: [u64; 7] = [10, 15, 20, 25, 30, 40, 75];
pub const TIER_FRIENDS: [u8; 4] = [1, 3, 5, 10];
pub const TIER_REWARD: [u64; 4] = [100, 300, 600, 1500];

pub fn utc_day(ts: i64) -> i64 {
    ts.div_euclid(86_400)
}

pub fn xp_for(level: u8) -> u32 {
    60 + u32::from(level.saturating_sub(1)) * 40
}
